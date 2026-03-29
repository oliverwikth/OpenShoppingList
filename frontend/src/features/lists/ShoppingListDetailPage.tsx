import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useActorName } from '../actor/useActorName'
import { toTitledName } from '../../shared/displayName'
import { addExternalItem, addManualItem, adjustItemQuantity, checkItem, fetchList, toggleItemClaim, uncheckItem } from './api'
import { openListRealtimeSocket, shouldUseRealtimeSocket } from './realtime'
import { searchRetailer } from '../retailer-search/api'
import type { RetailerSearchResponse, RetailerSearchResult, ShoppingListDetail, ShoppingListItem } from '../../shared/types/api'
import { ChecklistPanel } from './detail/ChecklistPanel'
import {
  calculatePricedItemsTotal,
  claimActionKey,
  compareItemsByCreatedAt,
  externalSearchKey,
  findMatchingExternalSearchItem,
  findMatchingManualSearchItem,
  groupItems,
  labelForView,
  manualSearchKey,
  resolveSearchPage,
  resolveView,
  ROOT_VIEW_ORDER,
  searchSelectionQuantity,
  type PendingSearchAdd,
  type SearchResultsState,
  type ViewMode,
  upsertListItem,
  viewPath,
} from './detail/detailPageUtils'
import { SearchResultsPanel, VarorItemsPanel } from './detail/VarorPanels'
import '../../components/ui/ui.css'
const VAROR_ADJUSTMENT_DEBOUNCE_MS = 600
const SEARCH_ADD_DEBOUNCE_MS = 600

export function ShoppingListDetailPage() {
  const actorName = useActorName()
  const { listId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [list, setList] = useState<ShoppingListDetail | null>(null)
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const deferredSearchInput = useDeferredValue(searchInput)
  const [searchResultsState, setSearchResultsState] = useState<SearchResultsState>({ query: '', pages: {} })
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [pendingSearchAdds, setPendingSearchAdds] = useState<Record<string, PendingSearchAdd>>({})
  const [busySearchActionKeys, setBusySearchActionKeys] = useState<Record<string, boolean>>({})
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const pendingSearchAddsRef = useRef<Record<string, PendingSearchAdd>>({})
  const inFlightSearchAddsRef = useRef<Record<string, number>>({})
  const searchAddTimeoutsRef = useRef<Record<string, number>>({})
  const pendingVarorAdjustmentsRef = useRef<Record<string, number>>({})
  const inFlightVarorAdjustmentsRef = useRef<Record<string, number>>({})
  const varorAdjustmentTimeoutsRef = useRef<Record<string, number>>({})
  const searchResultsStateRef = useRef<SearchResultsState>({ query: '', pages: {} })
  const localMutationVersionRef = useRef(0)
  const listLoadRequestIdRef = useRef(0)
  const appliedListLoadRequestIdRef = useRef(0)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const pollingIntervalRef = useRef<number | null>(null)
  const listRef = useRef<ShoppingListDetail | null>(null)
  const loadListRef = useRef<(options?: { background?: boolean }) => Promise<void>>(async () => {})
  const flushPendingSearchAddRef = useRef<(actionKey: string) => Promise<void>>(async () => {})
  const flushAllPendingSearchAddsRef = useRef<() => Promise<void>>(async () => {})
  const flushPendingVarorAdjustmentRef = useRef<(itemId: string) => Promise<void>>(async () => {})
  const flushAllPendingVarorAdjustmentsRef = useRef<() => Promise<void>>(async () => {})

  listRef.current = list

  const currentView = resolveView(location.pathname)
  const isSearchView = currentView === 'search' || currentView === 'search-expanded'
  const currentRootView = isSearchView ? 'items' : currentView
  const currentSearchPage = resolveSearchPage(currentView, searchParams)
  const backPath = currentView === 'search-expanded'
    ? viewPath(actorName, listId, 'search', searchInput)
    : currentView === 'search'
      ? viewPath(actorName, listId, 'items')
      : `/${actorName}`
  const previousViewRef = useRef(currentView)

  async function loadList(options: { background?: boolean } = {}) {
    const requestId = ++listLoadRequestIdRef.current
    const mutationVersionAtStart = localMutationVersionRef.current

    if (!options.background || listRef.current === null) {
      setIsLoading(true)
    }

    setError(null)
    try {
      const loadedList = await fetchList(listId)
      if (mutationVersionAtStart < localMutationVersionRef.current || requestId < appliedListLoadRequestIdRef.current) {
        return
      }

      appliedListLoadRequestIdRef.current = requestId
      setList(applyPendingVarorAdjustmentsToList(loadedList))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kunde inte hämta listan.')
    } finally {
      if (!options.background || listRef.current === null) {
        setIsLoading(false)
      }
    }
  }

  loadListRef.current = loadList

  useEffect(() => {
    clearAllSearchAddTimeouts()
    clearAllVarorAdjustmentTimeouts()
    pendingVarorAdjustmentsRef.current = {}
    inFlightVarorAdjustmentsRef.current = {}
    pendingSearchAddsRef.current = {}
    inFlightSearchAddsRef.current = {}
    localMutationVersionRef.current = 0
    listLoadRequestIdRef.current = 0
    appliedListLoadRequestIdRef.current = 0
    setPendingSearchAdds({})
    setBusySearchActionKeys({})
    void loadListRef.current()
  }, [listId])

  useEffect(() => {
    if (!listId) {
      return
    }

    let isClosed = false
    let socket: WebSocket | null = null

    const stopPolling = () => {
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    const startPolling = () => {
      if (pollingIntervalRef.current !== null) {
        return
      }

      pollingIntervalRef.current = window.setInterval(() => {
        void loadListRef.current({ background: true })
      }, 5_000)
    }

    const connect = () => {
      if (isClosed) {
        return
      }

      if (!shouldUseRealtimeSocket()) {
        startPolling()
        return
      }

      try {
        socket = openListRealtimeSocket(listId)
      } catch {
        startPolling()
        return
      }

      socket.onopen = () => {
        stopPolling()
      }
      socket.onmessage = () => {
        void loadListRef.current({ background: true })
      }
      socket.onclose = () => {
        socket = null
        if (isClosed) {
          return
        }
        startPolling()
        reconnectTimeoutRef.current = window.setTimeout(connect, 1_000)
      }
      socket.onerror = () => {
        socket?.close()
      }
    }

    connect()

    return () => {
      isClosed = true
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      stopPolling()
      socket?.close()
    }
  }, [listId])

  useEffect(() => {
    setSearchInput(searchParams.get('q') ?? '')
  }, [searchParams])

  async function flushPendingSearchAdd(actionKey: string) {
    const pendingAdd = pendingSearchAddsRef.current[actionKey]
    if (!pendingAdd || inFlightSearchAddsRef.current[actionKey]) {
      return
    }

    clearSearchAddTimeout(actionKey)
    inFlightSearchAddsRef.current = {
      ...inFlightSearchAddsRef.current,
      [actionKey]: pendingAdd.quantity,
    }
    setBusySearchActionKeys((current) => ({
      ...current,
      [actionKey]: true,
    }))
    setError(null)
    try {
      const savedItem =
        pendingAdd.kind === 'manual'
          ? await addManualItem(actorName, listId, pendingAdd.title, pendingAdd.note, pendingAdd.quantity)
          : await addExternalItem(actorName, listId, pendingAdd.result, pendingAdd.quantity)
      const currentPendingQuantity = pendingSearchAddsRef.current[actionKey]?.quantity ?? 0
      const remainingQuantity = currentPendingQuantity - pendingAdd.quantity

      if (remainingQuantity <= 0) {
        setPendingSearchAddsState(omitRecordKey(pendingSearchAddsRef.current, actionKey))
      } else {
        setPendingSearchAddsState({
          ...pendingSearchAddsRef.current,
          [actionKey]: {
            ...pendingAdd,
            quantity: remainingQuantity,
          },
        })
      }

      patchItemInList(savedItem)

      inFlightSearchAddsRef.current = omitRecordKey(inFlightSearchAddsRef.current, actionKey)

      if (remainingQuantity > 0) {
        scheduleSearchAddFlush(actionKey, 0)
      }
    } catch (flushError) {
      inFlightSearchAddsRef.current = omitRecordKey(inFlightSearchAddsRef.current, actionKey)
      setError(flushError instanceof Error ? flushError.message : 'Kunde inte spara sökvalen.')
    } finally {
      setBusySearchActionKeys((current) => omitRecordKey(current, actionKey))
    }
  }

  flushPendingSearchAddRef.current = flushPendingSearchAdd

  async function flushAllPendingSearchAdds() {
    const pendingActionKeys = Object.keys(pendingSearchAddsRef.current)
    for (const actionKey of pendingActionKeys) {
      await flushPendingSearchAddRef.current(actionKey)
    }
  }

  flushAllPendingSearchAddsRef.current = flushAllPendingSearchAdds

  async function flushPendingVarorAdjustment(itemId: string) {
    const delta = pendingVarorAdjustmentsRef.current[itemId]
    if (!delta || inFlightVarorAdjustmentsRef.current[itemId]) {
      return
    }

    clearVarorAdjustmentTimeout(itemId)
    inFlightVarorAdjustmentsRef.current = {
      ...inFlightVarorAdjustmentsRef.current,
      [itemId]: delta,
    }
    setError(null)

    try {
      const result = await adjustItemQuantity(actorName, listId, itemId, delta)
      const remainingDelta = (pendingVarorAdjustmentsRef.current[itemId] ?? 0) - delta

      if (remainingDelta === 0) {
        pendingVarorAdjustmentsRef.current = omitRecordKey(pendingVarorAdjustmentsRef.current, itemId)
      } else {
        pendingVarorAdjustmentsRef.current = {
          ...pendingVarorAdjustmentsRef.current,
          [itemId]: remainingDelta,
        }
      }

      if (result.removed || !result.item) {
        removeItemFromList(result.itemId)
      } else {
        patchItemInList(result.item)
      }

      inFlightVarorAdjustmentsRef.current = omitRecordKey(inFlightVarorAdjustmentsRef.current, itemId)

      if (remainingDelta !== 0) {
        scheduleVarorAdjustmentFlush(itemId, 0)
      }
    } catch (adjustError) {
      inFlightVarorAdjustmentsRef.current = omitRecordKey(inFlightVarorAdjustmentsRef.current, itemId)
      setError(adjustError instanceof Error ? adjustError.message : 'Kunde inte uppdatera antalet.')
    }
  }

  flushPendingVarorAdjustmentRef.current = flushPendingVarorAdjustment

  async function flushAllPendingVarorAdjustments() {
    const pendingItemIds = Object.keys(pendingVarorAdjustmentsRef.current)
    for (const itemId of pendingItemIds) {
      await flushPendingVarorAdjustmentRef.current(itemId)
    }
  }

  flushAllPendingVarorAdjustmentsRef.current = flushAllPendingVarorAdjustments

  useEffect(() => {
    const previousView = previousViewRef.current
    previousViewRef.current = currentView

    if (previousView === 'items' && currentView !== 'items') {
      void flushAllPendingVarorAdjustmentsRef.current()
    }

    if (currentView === 'items' && (previousView === 'search' || previousView === 'search-expanded')) {
      searchInputRef.current?.blur()
    }
  }, [currentView])

  useEffect(() => {
    function handlePageHide() {
      void flushAllPendingSearchAddsRef.current()
      void flushAllPendingVarorAdjustmentsRef.current()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        void flushAllPendingSearchAddsRef.current()
        void flushAllPendingVarorAdjustmentsRef.current()
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearAllSearchAddTimeouts()
      clearAllVarorAdjustmentTimeouts()
    }
  }, [])

  useLayoutEffect(() => {
    if (!isSearchView) {
      return
    }

    const input = searchInputRef.current
    if (!input) {
      return
    }

    if (document.activeElement !== input) {
      input.focus()
    }

    try {
      const cursorPosition = input.value.length
      input.setSelectionRange(cursorPosition, cursorPosition)
    } catch {
      // Selection APIs are not available for every input implementation.
    }
  }, [isSearchView])

  useEffect(() => {
    if (deferredSearchInput.trim().length < 2) {
      const emptyState = { query: deferredSearchInput.trim(), pages: {} }
      searchResultsStateRef.current = emptyState
      setSearchResultsState(emptyState)
      setIsSearching(false)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true)
      try {
        const nextState =
          searchResultsStateRef.current.query === deferredSearchInput.trim()
            ? {
                query: deferredSearchInput.trim(),
                pages: { ...searchResultsStateRef.current.pages },
              }
            : {
                query: deferredSearchInput.trim(),
                pages: {},
              }

        for (let page = 0; page <= currentSearchPage; page += 1) {
          if (!nextState.pages[page]) {
            nextState.pages[page] = await searchRetailer(deferredSearchInput.trim(), page, controller.signal)
          }
        }

        searchResultsStateRef.current = nextState
        setSearchResultsState(nextState)
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === 'AbortError') {
          return
        }
        setError(searchError instanceof Error ? searchError.message : 'Kunde inte söka.')
      } finally {
        setIsSearching(false)
      }
    }, 240)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [deferredSearchInput, currentSearchPage])

  const itemsInOrder = useMemo(() => [...(list?.items ?? [])].sort(compareItemsByCreatedAt), [list?.items])
  const uncheckedChecklistGroups = useMemo(
    () => groupItems((list?.items ?? []).filter((item) => !item.checked)),
    [list?.items],
  )
  const checkedChecklistItems = useMemo(
    () => [...(list?.items ?? [])].filter((item) => item.checked).sort((left, right) => left.position - right.position),
    [list?.items],
  )
  const totalQuantity = list?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
  const checkedCount = list?.items.reduce((sum, item) => sum + (item.checked ? item.quantity : 0), 0) ?? 0
  const pricedItemsTotal = useMemo(() => calculatePricedItemsTotal(list?.items ?? []), [list?.items])
  const manualSearchLabel = searchInput.trim()
  const searchResponse = useMemo(() => {
    if (searchResultsState.query !== manualSearchLabel) {
      return null
    }

    const responses = Array.from({ length: currentSearchPage + 1 }, (_, page) => searchResultsState.pages[page]).filter(
      (response): response is RetailerSearchResponse => response !== undefined,
    )

    if (!responses.length) {
      return null
    }

    const latestResponse = responses[responses.length - 1]
    return {
      ...latestResponse,
      results: responses.flatMap((response) => response.results),
    }
  }, [currentSearchPage, manualSearchLabel, searchResultsState])
  const searchResults = searchResponse?.results ?? []
  const manualSearchItem = useMemo(
    () => (manualSearchLabel ? findMatchingManualSearchItem(list?.items ?? [], manualSearchLabel) : null),
    [list?.items, manualSearchLabel],
  )
  const manualSearchActionKey = manualSearchKey(manualSearchLabel)
  const manualSearchQuantity = searchSelectionQuantity(manualSearchItem, pendingSearchAdds[manualSearchActionKey])

  function setPendingSearchAddsState(nextPendingSearchAdds: Record<string, PendingSearchAdd>) {
    pendingSearchAddsRef.current = nextPendingSearchAdds
    setPendingSearchAdds(nextPendingSearchAdds)
  }

  function clearSearchAddTimeout(actionKey: string) {
    const timeoutId = searchAddTimeoutsRef.current[actionKey]
    if (timeoutId === undefined) {
      return
    }

    window.clearTimeout(timeoutId)
    searchAddTimeoutsRef.current = omitRecordKey(searchAddTimeoutsRef.current, actionKey)
  }

  function clearAllSearchAddTimeouts() {
    for (const timeoutId of Object.values(searchAddTimeoutsRef.current)) {
      window.clearTimeout(timeoutId)
    }
    searchAddTimeoutsRef.current = {}
  }

  function scheduleSearchAddFlush(actionKey: string, delay = SEARCH_ADD_DEBOUNCE_MS) {
    if (!pendingSearchAddsRef.current[actionKey]) {
      clearSearchAddTimeout(actionKey)
      return
    }

    clearSearchAddTimeout(actionKey)
    searchAddTimeoutsRef.current = {
      ...searchAddTimeoutsRef.current,
      [actionKey]: window.setTimeout(() => {
        clearSearchAddTimeout(actionKey)
        void flushPendingSearchAddRef.current(actionKey)
      }, delay),
    }
  }

  function markLocalMutationApplied() {
    localMutationVersionRef.current += 1
  }

  function incrementPendingSearchAdd(actionKey: string, pendingAdd: PendingSearchAdd) {
    const currentPendingAdd = pendingSearchAddsRef.current[actionKey]
    setPendingSearchAddsState({
      ...pendingSearchAddsRef.current,
      [actionKey]: {
        ...pendingAdd,
        quantity: (currentPendingAdd?.quantity ?? 0) + 1,
      },
    })
    scheduleSearchAddFlush(actionKey)
  }

  function decrementPendingSearchAdd(actionKey: string) {
    const currentPendingAdd = pendingSearchAddsRef.current[actionKey]
    if (!currentPendingAdd) {
      return
    }

    if (currentPendingAdd.quantity <= 1) {
      setPendingSearchAddsState(omitRecordKey(pendingSearchAddsRef.current, actionKey))
      clearSearchAddTimeout(actionKey)
      return
    }

    setPendingSearchAddsState({
      ...pendingSearchAddsRef.current,
      [actionKey]: {
        ...currentPendingAdd,
        quantity: currentPendingAdd.quantity - 1,
      },
    })
    scheduleSearchAddFlush(actionKey)
  }

  function patchItemInList(updatedItem: ShoppingListItem) {
    markLocalMutationApplied()
    setList((currentList) => {
      if (!currentList) {
        return currentList
      }

      return applyPendingVarorAdjustmentsToList({
        ...currentList,
        items: upsertListItem(currentList.items, updatedItem),
        lastModifiedByDisplayName: updatedItem.lastModifiedByDisplayName,
        updatedAt: updatedItem.updatedAt,
      })
    })
  }

  function removeItemFromList(itemId: string) {
    markLocalMutationApplied()
    setList((currentList) => {
      if (!currentList) {
        return currentList
      }

      return {
        ...currentList,
        items: currentList.items.filter((item) => item.id !== itemId),
      }
    })
  }

  function clearVarorAdjustmentTimeout(itemId: string) {
    const timeoutId = varorAdjustmentTimeoutsRef.current[itemId]
    if (timeoutId === undefined) {
      return
    }

    window.clearTimeout(timeoutId)
    varorAdjustmentTimeoutsRef.current = omitRecordKey(varorAdjustmentTimeoutsRef.current, itemId)
  }

  function clearAllVarorAdjustmentTimeouts() {
    for (const timeoutId of Object.values(varorAdjustmentTimeoutsRef.current)) {
      window.clearTimeout(timeoutId)
    }
    varorAdjustmentTimeoutsRef.current = {}
  }

  function scheduleVarorAdjustmentFlush(itemId: string, delay = VAROR_ADJUSTMENT_DEBOUNCE_MS) {
    if (!pendingVarorAdjustmentsRef.current[itemId]) {
      clearVarorAdjustmentTimeout(itemId)
      return
    }

    clearVarorAdjustmentTimeout(itemId)
    varorAdjustmentTimeoutsRef.current = {
      ...varorAdjustmentTimeoutsRef.current,
      [itemId]: window.setTimeout(() => {
        clearVarorAdjustmentTimeout(itemId)
        void flushPendingVarorAdjustmentRef.current(itemId)
      }, delay),
    }
  }

  function applyPendingVarorAdjustmentsToList(sourceList: ShoppingListDetail) {
    const pendingAdjustments = pendingVarorAdjustmentsRef.current
    if (!Object.keys(pendingAdjustments).length) {
      return sourceList
    }

    return {
      ...sourceList,
      items: sourceList.items.flatMap((item) => {
        const delta = pendingAdjustments[item.id] ?? 0
        if (delta === 0) {
          return [item]
        }

        const nextQuantity = item.quantity + delta
        if (nextQuantity < 1) {
          return []
        }

        return [{ ...item, quantity: nextQuantity }]
      }),
    }
  }

  function applyVarorQuantityDelta(itemId: string, delta: number) {
    if (delta === 0) {
      return
    }

    setList((currentList) => {
      if (!currentList) {
        return currentList
      }

      const item = currentList.items.find((candidate) => candidate.id === itemId)
      if (!item) {
        return currentList
      }

      const nextQuantity = item.quantity + delta
      return {
        ...currentList,
        items:
          nextQuantity < 1
            ? currentList.items.filter((candidate) => candidate.id !== itemId)
            : upsertListItem(currentList.items, {
                ...item,
                quantity: nextQuantity,
              }),
      }
    })
  }

  function queueVarorItemAdjustment(item: ShoppingListItem, delta: number) {
    applyVarorQuantityDelta(item.id, delta)
    const nextDelta = (pendingVarorAdjustmentsRef.current[item.id] ?? 0) + delta
    if (nextDelta === 0) {
      pendingVarorAdjustmentsRef.current = omitRecordKey(pendingVarorAdjustmentsRef.current, item.id)
      clearVarorAdjustmentTimeout(item.id)
      return
    }

    pendingVarorAdjustmentsRef.current = {
      ...pendingVarorAdjustmentsRef.current,
      [item.id]: nextDelta,
    }
    scheduleVarorAdjustmentFlush(item.id)
  }

  function updateSearchValue(value: string) {
    setSearchInput(value)

    if (currentView === 'items') {
      navigate(viewPath(actorName, listId, 'search', value), { replace: true })
      return
    }

    if (currentView === 'search-expanded') {
      navigate(viewPath(actorName, listId, 'search', value), { replace: true })
      return
    }

    const nextSearchParams = new URLSearchParams(searchParams)
    if (value) {
      nextSearchParams.set('q', value)
    } else {
      nextSearchParams.delete('q')
    }
    nextSearchParams.delete('page')
    setSearchParams(nextSearchParams, { replace: true })
  }

  function clearSearch() {
    updateSearchValue('')
    searchResultsStateRef.current = { query: '', pages: {} }
    setSearchResultsState({ query: '', pages: {} })
    searchInputRef.current?.focus()
  }

  function handleSearchFieldFocus() {
    if (currentView !== 'items') {
      return
    }

    navigate(viewPath(actorName, listId, 'search', searchInput))
  }

  function handleAddManualFromSearch() {
    if (!manualSearchLabel) {
      return
    }

    if (manualSearchItem) {
      queueVarorItemAdjustment(manualSearchItem, 1)
      return
    }

    incrementPendingSearchAdd(manualSearchActionKey, {
      kind: 'manual',
      note: '',
      quantity: 1,
      title: manualSearchLabel,
    })
  }

  function handleAddRetailerItem(result: RetailerSearchResult) {
    const matchingItem = findMatchingExternalSearchItem(list?.items ?? [], result)
    if (matchingItem) {
      queueVarorItemAdjustment(matchingItem, 1)
      return
    }

    incrementPendingSearchAdd(externalSearchKey(result), {
      kind: 'external',
      quantity: 1,
      result,
    })
  }

  async function handleDecreaseManualFromSearch() {
    if (pendingSearchAddsRef.current[manualSearchActionKey]) {
      decrementPendingSearchAdd(manualSearchActionKey)
      return
    }

    if (manualSearchItem) {
      queueVarorItemAdjustment(manualSearchItem, -1)
    }
  }

  async function handleDecreaseRetailerItemFromSearch(result: RetailerSearchResult, item: ShoppingListItem | null) {
    const actionKey = externalSearchKey(result)
    if (pendingSearchAddsRef.current[actionKey]) {
      decrementPendingSearchAdd(actionKey)
      return
    }

    if (item) {
      queueVarorItemAdjustment(item, -1)
    }
  }

  async function handleToggleItem(item: ShoppingListItem) {
    setPendingActionKey(item.id)
    setError(null)
    try {
      let updatedItem: ShoppingListItem
      if (item.checked) {
        updatedItem = await uncheckItem(actorName, listId, item.id)
      } else {
        updatedItem = await checkItem(actorName, listId, item.id)
      }
      patchItemInList(updatedItem)
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Kunde inte uppdatera raden.')
    } finally {
      setPendingActionKey(null)
    }
  }

  async function handleToggleClaim(item: ShoppingListItem) {
    const actionKey = claimActionKey(item.id)
    setPendingActionKey(actionKey)
    setError(null)
    try {
      patchItemInList(await toggleItemClaim(actorName, listId, item.id))
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : 'Kunde inte uppdatera hämtning.')
    } finally {
      setPendingActionKey(null)
    }
  }

  function switchView(view: Exclude<ViewMode, 'search'>) {
    navigate(viewPath(actorName, listId, view))
  }

  function handleIncreaseItemFromVaror(item: ShoppingListItem) {
    setError(null)
    queueVarorItemAdjustment(item, 1)
  }

  function handleDecreaseItemFromVaror(item: ShoppingListItem) {
    setError(null)
    queueVarorItemAdjustment(item, -1)
  }

  return (
    <main className="app-frame">
      <header className="app-header">
        <Link className="header-icon-button" to={backPath}>
          ←
        </Link>
        <div className="app-header__title">
          <span className="app-header__eyebrow">Att handla som {toTitledName(actorName)}</span>
          <strong>{list?.name ?? 'Hämtar lista...'}</strong>
        </div>
        <button
          className="header-action"
          onClick={() => {
            void (async () => {
              await flushAllPendingVarorAdjustmentsRef.current()
              await flushAllPendingSearchAddsRef.current()
              await loadListRef.current()
            })()
          }}
          type="button"
        >
          Uppdatera
        </button>
      </header>

      <section className="screen-body detail-body">
        {error ? <div className="info-banner">{error}</div> : null}
        {isLoading ? <div className="screen-card">Hämtar lista...</div> : null}

        {list ? (
          <>
            {currentRootView === 'items' ? (
              <section className="screen-stack">
                <section className={`search-stage ${isSearchView ? 'search-stage--active' : ''}`}>
                  <div className="search-shell search-shell--top">
                    <div className="search-input-wrap">
                      <input
                        ref={searchInputRef}
                        aria-label="Sök artikel"
                        className="search-input"
                        enterKeyHint="search"
                        placeholder="Sök eller lägg till vara"
                        value={searchInput}
                        onChange={(event) => updateSearchValue(event.target.value)}
                        onFocus={handleSearchFieldFocus}
                      />
                      {searchInput ? (
                        <button
                          aria-label="Rensa sökning"
                          className="search-clear"
                          onClick={clearSearch}
                          type="button"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </div>
                </section>

                {isSearchView ? (
                  <SearchResultsPanel
                    busySearchActionKeys={busySearchActionKeys}
                    isSearching={isSearching}
                    items={list.items}
                    manualSearchActionKey={manualSearchActionKey}
                    manualSearchLabel={manualSearchLabel}
                    manualSearchQuantity={manualSearchQuantity}
                    pendingSearchAdds={pendingSearchAdds}
                    searchInput={searchInput}
                    searchResponse={searchResponse}
                    searchResults={searchResults}
                    onAddManual={handleAddManualFromSearch}
                    onAddRetailerItem={handleAddRetailerItem}
                    onDecreaseManual={handleDecreaseManualFromSearch}
                    onDecreaseRetailerItem={handleDecreaseRetailerItemFromSearch}
                    onShowMore={() => navigate(viewPath(actorName, listId, 'search-expanded', searchInput, currentSearchPage + 1))}
                  />
                ) : (
                  <VarorItemsPanel
                    itemsInOrder={itemsInOrder}
                    pricedItemsTotal={pricedItemsTotal}
                    onDecreaseItem={handleDecreaseItemFromVaror}
                    onIncreaseItem={handleIncreaseItemFromVaror}
                  />
                )}
              </section>
            ) : null}

            {currentView === 'checklist' ? (
              <ChecklistPanel
                checkedChecklistItems={checkedChecklistItems}
                checkedCount={checkedCount}
                pendingActionKey={pendingActionKey}
                totalQuantity={totalQuantity}
                uncheckedChecklistGroups={uncheckedChecklistGroups}
                onToggleCheck={handleToggleItem}
                onToggleClaim={handleToggleClaim}
              />
            ) : null}
          </>
        ) : null}
      </section>

      <nav className="bottom-tabs" aria-label="Listvyer">
        {ROOT_VIEW_ORDER.map((view) => (
          <button
            className={`bottom-tab ${currentRootView === view ? 'is-active' : ''}`}
            key={view}
            onClick={() => switchView(view)}
            type="button"
          >
            {labelForView(view)}
          </button>
        ))}
      </nav>
    </main>
  )
}

function omitRecordKey<T>(record: Record<string, T>, key: string) {
  const nextRecord = { ...record }
  delete nextRecord[key]
  return nextRecord
}
