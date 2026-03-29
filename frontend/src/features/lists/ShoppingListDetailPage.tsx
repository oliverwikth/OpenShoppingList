import { useDeferredValue, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useActorName } from '../actor/useActorName'
import { addExternalItem, addManualItem, adjustItemQuantity, checkItem, fetchList, toggleItemClaim, uncheckItem } from './api'
import { openListRealtimeSocket, shouldUseRealtimeSocket } from './realtime'
import { searchRetailer } from '../retailer-search/api'
import type {
  RetailerSearchResponse,
  RetailerSearchResult,
  ShoppingListDetail,
  ShoppingListItem,
} from '../../shared/types/api'
import '../../components/ui/ui.css'

type ViewMode = 'items' | 'search' | 'search-expanded' | 'checklist'

interface ItemGroup {
  title: string
  items: ShoppingListItem[]
}

interface SearchResultsState {
  query: string
  pages: Record<number, RetailerSearchResponse>
}

interface PendingManualSearchAdd {
  kind: 'manual'
  note: string
  quantity: number
  title: string
}

interface PendingExternalSearchAdd {
  kind: 'external'
  quantity: number
  result: RetailerSearchResult
}

type PendingSearchAdd = PendingManualSearchAdd | PendingExternalSearchAdd

const ROOT_VIEW_ORDER: Exclude<ViewMode, 'search'>[] = ['items', 'checklist']
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

  const loadList = useEffectEvent(async (options: { background?: boolean } = {}) => {
    const requestId = ++listLoadRequestIdRef.current
    const mutationVersionAtStart = localMutationVersionRef.current

    if (!options.background || list === null) {
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
      if (!options.background || list === null) {
        setIsLoading(false)
      }
    }
  })

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
    void loadList()
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
        void loadList({ background: true })
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
        void loadList({ background: true })
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

  const flushPendingSearchAdd = useEffectEvent(async (actionKey: string) => {
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
        const { [actionKey]: _ignoredPendingAdd, ...remainingPendingSearchAdds } = pendingSearchAddsRef.current
        setPendingSearchAddsState(remainingPendingSearchAdds)
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

      const { [actionKey]: _ignoredInFlight, ...remainingInFlight } = inFlightSearchAddsRef.current
      inFlightSearchAddsRef.current = remainingInFlight

      if (remainingQuantity > 0) {
        scheduleSearchAddFlush(actionKey, 0)
      }
    } catch (flushError) {
      const { [actionKey]: _ignoredInFlight, ...remainingInFlight } = inFlightSearchAddsRef.current
      inFlightSearchAddsRef.current = remainingInFlight
      setError(flushError instanceof Error ? flushError.message : 'Kunde inte spara sökvalen.')
    } finally {
      setBusySearchActionKeys((current) => {
        const { [actionKey]: _ignoredBusyAction, ...remainingBusyActionKeys } = current
        return remainingBusyActionKeys
      })
    }
  })

  const flushAllPendingSearchAdds = useEffectEvent(async () => {
    const pendingActionKeys = Object.keys(pendingSearchAddsRef.current)
    for (const actionKey of pendingActionKeys) {
      await flushPendingSearchAdd(actionKey)
    }
  })

  const flushPendingVarorAdjustment = useEffectEvent(async (itemId: string) => {
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
        const { [itemId]: _ignoredAdjustment, ...remainingAdjustments } = pendingVarorAdjustmentsRef.current
        pendingVarorAdjustmentsRef.current = remainingAdjustments
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

      const { [itemId]: _ignoredInFlight, ...remainingInFlight } = inFlightVarorAdjustmentsRef.current
      inFlightVarorAdjustmentsRef.current = remainingInFlight

      if (remainingDelta !== 0) {
        scheduleVarorAdjustmentFlush(itemId, 0)
      }
    } catch (adjustError) {
      const { [itemId]: _ignoredInFlight, ...remainingInFlight } = inFlightVarorAdjustmentsRef.current
      inFlightVarorAdjustmentsRef.current = remainingInFlight
      setError(adjustError instanceof Error ? adjustError.message : 'Kunde inte uppdatera antalet.')
    }
  })

  const flushAllPendingVarorAdjustments = useEffectEvent(async () => {
    const pendingItemIds = Object.keys(pendingVarorAdjustmentsRef.current)
    for (const itemId of pendingItemIds) {
      await flushPendingVarorAdjustment(itemId)
    }
  })

  useEffect(() => {
    const previousView = previousViewRef.current
    previousViewRef.current = currentView

    if (previousView === 'items' && currentView !== 'items') {
      void flushAllPendingVarorAdjustments()
    }

    if (currentView === 'items' && (previousView === 'search' || previousView === 'search-expanded')) {
      searchInputRef.current?.blur()
    }
  }, [currentView, flushAllPendingVarorAdjustments])

  useEffect(() => {
    function handlePageHide() {
      void flushAllPendingSearchAdds()
      void flushAllPendingVarorAdjustments()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        void flushAllPendingSearchAdds()
        void flushAllPendingVarorAdjustments()
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
    const { [actionKey]: _ignoredTimeout, ...remainingTimeouts } = searchAddTimeoutsRef.current
    searchAddTimeoutsRef.current = remainingTimeouts
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
        void flushPendingSearchAdd(actionKey)
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
      const { [actionKey]: _ignored, ...remainingPendingSearchAdds } = pendingSearchAddsRef.current
      setPendingSearchAddsState(remainingPendingSearchAdds)
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
    const { [itemId]: _ignoredTimeout, ...remainingTimeouts } = varorAdjustmentTimeoutsRef.current
    varorAdjustmentTimeoutsRef.current = remainingTimeouts
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
        void flushPendingVarorAdjustment(itemId)
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
      const { [item.id]: _ignoredAdjustment, ...remainingAdjustments } = pendingVarorAdjustmentsRef.current
      pendingVarorAdjustmentsRef.current = remainingAdjustments
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
          <span className="app-header__eyebrow">Att handla som {actorName}</span>
          <strong>{list?.name ?? 'Hämtar lista...'}</strong>
        </div>
        <button
          className="header-action"
          onClick={() => {
            void (async () => {
              await flushAllPendingVarorAdjustments()
              await flushAllPendingSearchAdds()
              await loadList()
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
                          onClick={() => {
                            updateSearchValue('')
                            searchResultsStateRef.current = { query: '', pages: {} }
                            setSearchResultsState({ query: '', pages: {} })
                            searchInputRef.current?.focus()
                          }}
                          type="button"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </div>
                </section>

                {currentView === 'items' ? (
                  <>
                    {itemsInOrder.length === 0 ? <p className="empty-panel">Listan är tom än. Börja skriva i sökfältet för att lägga till dina första varor.</p> : null}

                    {itemsInOrder.length > 0 ? (
                      <>
                        <div className="catalog-list catalog-list--panel">
                          {itemsInOrder.map((item) => (
                            <article className="catalog-row catalog-row--minimal" key={item.id}>
                              <div className="catalog-row__media">{renderItemMedia(item)}</div>
                              <div className="catalog-row__content">
                                <strong>{item.title}</strong>
                                <div className="catalog-row__meta">
                                  <span>{itemSubtitle(item)}</span>
                                  <span>{formatQuantity(item.quantity)}</span>
                                  {item.externalSnapshot?.priceAmount !== null &&
                                  item.externalSnapshot?.priceAmount !== undefined ? (
                                    <span>{formatPrice(item.externalSnapshot.priceAmount, item.externalSnapshot.currency)}</span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="catalog-row__aside catalog-row__aside--stack">
                                <QuantityAction
                                  count={item.quantity}
                                  isPending={false}
                                  onDecrease={() => handleDecreaseItemFromVaror(item)}
                                  onIncrease={() => handleIncreaseItemFromVaror(item)}
                                  title={item.title}
                                />
                              </div>
                            </article>
                          ))}
                        </div>

                        <section className="total-bar" aria-label="Totalpris">
                          <span>Total</span>
                          <strong>{formatPrice(pricedItemsTotal.amount, pricedItemsTotal.currency)}</strong>
                        </section>
                      </>
                    ) : null}
                  </>
                ) : null}

                {isSearchView ? (
                  <div className="search-results-panel">
                    <div className="catalog-list catalog-list--search">
                      {manualSearchLabel ? (
                        <article className="catalog-row" key="manual-search-item">
                          <div className="catalog-row__media catalog-row__media--brand">TXT</div>
                          <div className="catalog-row__content">
                            <strong>{manualSearchLabel}</strong>
                            <p>Fritextartikel</p>
                          </div>
                          <div className="catalog-row__aside">
                            <QuantityAction
                              count={manualSearchQuantity}
                              isPending={busySearchActionKeys[manualSearchActionKey] === true}
                              onDecrease={manualSearchQuantity > 0 ? handleDecreaseManualFromSearch : undefined}
                              onIncrease={handleAddManualFromSearch}
                              title={manualSearchLabel}
                            />
                          </div>
                        </article>
                      ) : null}

                      {isSearching ? <p className="empty-state">Söker...</p> : null}
                      {searchResponse?.available === false && searchResponse.message ? <div className="info-banner">{searchResponse.message}</div> : null}
                      {!isSearching && searchInput.trim().length < 2 ? (
                        <p className="empty-state">Skriv minst två tecken för att söka artiklar.</p>
                      ) : null}
                      {!isSearching && searchInput.trim().length >= 2 && searchResponse !== null && !searchResponse.results.length ? (
                        <p className="empty-state">Inga butiksträffar just nu. Lägg till som fritext i stället.</p>
                      ) : null}

                      <div className="catalog-list">
                        {searchResults.map((result) => {
                          const matchingItem = findMatchingExternalSearchItem(list?.items ?? [], result)
                          const quantity = searchSelectionQuantity(matchingItem, pendingSearchAdds[externalSearchKey(result)])

                          return (
                            <article className="catalog-row" key={result.articleId}>
                              <div className="catalog-row__media">{renderSearchMedia(result)}</div>
                              <div className="catalog-row__content">
                                <strong>{result.title}</strong>
                                <p>{result.subtitle ?? result.category ?? 'Butiksartikel'}</p>
                                <div className="catalog-row__meta">
                                  {result.category ? <span>{result.category}</span> : null}
                                  {result.priceAmount !== null ? <span>{formatPrice(result.priceAmount, result.currency)}</span> : null}
                                </div>
                              </div>
                              <div className="catalog-row__aside">
                                <QuantityAction
                                  count={quantity}
                                  isPending={busySearchActionKeys[externalSearchKey(result)] === true}
                                  onDecrease={quantity > 0 ? () => void handleDecreaseRetailerItemFromSearch(result, matchingItem) : undefined}
                                  onIncrease={() => void handleAddRetailerItem(result)}
                                  title={result.title}
                                />
                              </div>
                            </article>
                          )
                        })}
                      </div>

                      {searchResponse?.hasMoreResults ? (
                        <button
                          aria-label="Visa fler träffar"
                          className="search-expand"
                          onClick={() =>
                            navigate(viewPath(actorName, listId, 'search-expanded', searchInput, currentSearchPage + 1))
                          }
                          type="button"
                        >
                          <span className="search-expand__icon">↓</span>
                          <span>Visa fler träffar</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {currentView === 'checklist' ? (
              <section className="checklist-screen">
                <div className="checklist-summary">
                  <strong>
                    {checkedCount} av {totalQuantity} klara
                  </strong>
                </div>

                {list.items.length === 0 ? (
                  <section className="checklist-section">
                    <p className="empty-state">Inga rader att pricka av än. Lägg till varor i sökvyn först.</p>
                  </section>
                ) : null}

                {uncheckedChecklistGroups.map((group) => (
                  <section className="checklist-section" key={group.title}>
                    <h2 className="checklist-section__title">{group.title}</h2>
                    <div className="checklist-list">
                      {group.items.map((item) => (
                        <ChecklistItemRow
                          isBusy={pendingActionKey === item.id || pendingActionKey === claimActionKey(item.id)}
                          item={item}
                          key={item.id}
                          onToggleCheck={handleToggleItem}
                          onToggleClaim={handleToggleClaim}
                        />
                      ))}
                    </div>
                  </section>
                ))}

                {checkedChecklistItems.length > 0 ? (
                  <section className="checklist-section checklist-section--checked">
                    <h2 className="checklist-section__title">Avprickade varor</h2>
                    <div className="checklist-list">
                      {checkedChecklistItems.map((item) => (
                        <article className="checklist-row checklist-row--minimal is-checked" key={item.id}>
                          <button
                            aria-label={`Avmarkera ${item.title}`}
                            className="square-check is-checked"
                            disabled={pendingActionKey === item.id}
                            onClick={() => void handleToggleItem(item)}
                            type="button"
                          >
                            ✓
                          </button>
                          <div className="catalog-row__media">{renderItemMedia(item)}</div>
                          <div className="catalog-row__content">
                            <strong>{item.title}</strong>
                            {itemSubtitle(item) ? <p>{itemSubtitle(item)}</p> : null}
                          </div>
                          <div className="catalog-row__aside">
                            <span className="checklist-quantity">{formatQuantity(item.quantity)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </section>
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

interface ChecklistItemRowProps {
  isBusy: boolean
  item: ShoppingListItem
  onToggleCheck: (item: ShoppingListItem) => Promise<void>
  onToggleClaim: (item: ShoppingListItem) => Promise<void>
}

function ChecklistItemRow({ isBusy, item, onToggleCheck, onToggleClaim }: ChecklistItemRowProps) {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const swipeStartXRef = useRef<number | null>(null)
  const isSwipingRef = useRef(false)
  const claimDisplayName = item.claimedByDisplayName ? toTitledName(item.claimedByDisplayName) : null

  const claimStyle = useMemo(() => {
    if (!item.claimedByDisplayName) {
      return undefined
    }
    return claimPaletteStyle(item.claimedByDisplayName)
  }, [item.claimedByDisplayName])

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (isBusy || item.checked) {
      return
    }

    const target = event.target
    if (target instanceof HTMLElement && target.closest('button')) {
      return
    }

    swipeStartXRef.current = event.clientX
    isSwipingRef.current = false
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (swipeStartXRef.current === null) {
      return
    }

    const deltaX = event.clientX - swipeStartXRef.current
    if (deltaX < -6) {
      isSwipingRef.current = true
    }

    if (!isSwipingRef.current) {
      return
    }

    setSwipeOffset(Math.max(deltaX, -92))
  }

  function handlePointerLeave() {
    if (swipeStartXRef.current === null) {
      return
    }

    swipeStartXRef.current = null
    isSwipingRef.current = false
    setSwipeOffset(0)
  }

  async function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (swipeStartXRef.current === null) {
      return
    }

    const deltaX = event.clientX - swipeStartXRef.current
    swipeStartXRef.current = null
    const shouldToggleClaim = deltaX <= -72
    isSwipingRef.current = false
    setSwipeOffset(0)

    if (shouldToggleClaim) {
      await onToggleClaim(item)
    }
  }

  return (
    <article
      className={`checklist-row checklist-row--minimal checklist-row--claimable ${item.claimedByDisplayName ? 'is-claimed' : ''}`}
      style={{
        ...(claimStyle ?? {}),
        transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerUp={(event) => void handlePointerUp(event)}
    >
      <button
        aria-label={item.checked ? `Avmarkera ${item.title}` : `Markera ${item.title}`}
        className={`square-check ${item.checked ? 'is-checked' : ''}`}
        disabled={isBusy}
        onClick={() => void onToggleCheck(item)}
        type="button"
      >
        {item.checked ? '✓' : ''}
      </button>
      <div className="catalog-row__media">{renderItemMedia(item)}</div>
      <div className="catalog-row__content">
        <strong>{item.title}</strong>
        {itemSubtitle(item) ? <p>{itemSubtitle(item)}</p> : null}
        {claimDisplayName ? <p className="claim-label">{claimDisplayName} hämtar</p> : null}
      </div>
      <div className="catalog-row__aside">
        <span className="checklist-quantity">{formatQuantity(item.quantity)}</span>
      </div>
    </article>
  )
}

function renderItemMedia(item: ShoppingListItem) {
  if (item.externalSnapshot?.imageUrl) {
    return <img alt="" src={item.externalSnapshot.imageUrl} />
  }

  return <span>TXT</span>
}

function renderSearchMedia(result: RetailerSearchResult) {
  if (result.imageUrl) {
    return <img alt="" src={result.imageUrl} />
  }

  return <span>W</span>
}

interface QuantityActionProps {
  count: number
  isPending: boolean
  onDecrease?: (() => void | Promise<void>) | undefined
  onIncrease: () => void | Promise<void>
  title: string
}

function QuantityAction({ count, isPending, onDecrease, onIncrease, title }: QuantityActionProps) {
  if (count < 1 || !onDecrease) {
    return (
      <button
        aria-label={`Lägg till ${title}`}
        className="circle-action"
        disabled={isPending}
        onClick={() => void onIncrease()}
        type="button"
      >
        {isPending ? '...' : '+'}
      </button>
    )
  }

  return (
    <div className="quantity-stepper" role="group" aria-label={`Antal för ${title}`}>
      <button
        aria-label={`Minska ${title}`}
        className="quantity-stepper__button"
        disabled={isPending}
        onClick={() => void onDecrease()}
        type="button"
      >
        -
      </button>
      <span className="quantity-stepper__count">{count}</span>
      <button
        aria-label={`Öka ${title}`}
        className="quantity-stepper__button"
        disabled={isPending}
        onClick={() => void onIncrease()}
        type="button"
      >
        +
      </button>
    </div>
  )
}

function labelForView(view: ViewMode) {
  if (view === 'items') {
    return 'Varor'
  }

  if (view === 'search' || view === 'search-expanded') {
    return 'Sök'
  }

  return 'Checklista'
}

function resolveView(pathname: string): ViewMode {
  if (pathname.endsWith('/varor/search/fler')) {
    return 'search-expanded'
  }

  if (pathname.endsWith('/varor/search')) {
    return 'search'
  }

  if (pathname.endsWith('/checklista')) {
    return 'checklist'
  }

  return 'items'
}

function viewPath(actorName: string, listId: string, view: ViewMode, searchQuery = '', page?: number) {
  const searchParams = new URLSearchParams()
  if (searchQuery) {
    searchParams.set('q', searchQuery)
  }
  if (page !== undefined && page > 0) {
    searchParams.set('page', String(page))
  }
  const searchSuffix = searchParams.size > 0 ? `?${searchParams.toString()}` : ''

  if (view === 'search-expanded') {
    return `/${actorName}/lists/${listId}/varor/search/fler${searchSuffix}`
  }

  if (view === 'search') {
    return `/${actorName}/lists/${listId}/varor/search${searchSuffix}`
  }

  if (view === 'checklist') {
    return `/${actorName}/lists/${listId}/checklista`
  }

  return `/${actorName}/lists/${listId}/varor`
}

function claimActionKey(itemId: string) {
  return `claim:${itemId}`
}

function upsertListItem(items: ShoppingListItem[], updatedItem: ShoppingListItem) {
  const existingItemIndex = items.findIndex((item) => item.id === updatedItem.id)
  if (existingItemIndex === -1) {
    return [...items, updatedItem]
  }

  return items.map((item) => (item.id === updatedItem.id ? updatedItem : item))
}

function compareItemsByCreatedAt(left: ShoppingListItem, right: ShoppingListItem) {
  const leftTimestamp = Date.parse(left.createdAt)
  const rightTimestamp = Date.parse(right.createdAt)

  if (Number.isFinite(leftTimestamp) && Number.isFinite(rightTimestamp) && leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp
  }

  if (left.position !== right.position) {
    return left.position - right.position
  }

  return left.id.localeCompare(right.id)
}

function groupItems(items: ShoppingListItem[]): ItemGroup[] {
  const grouped = new Map<string, ShoppingListItem[]>()

  for (const item of items) {
    const title = categoryTitle(item)
    grouped.set(title, [...(grouped.get(title) ?? []), item])
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => compareGroupNames(left, right))
    .map(([title, groupedItems]) => ({
      title,
      items: [...groupedItems].sort((left, right) => left.position - right.position),
    }))
}

function categoryTitle(item: ShoppingListItem) {
  if (item.externalSnapshot?.category?.trim()) {
    return item.externalSnapshot.category
  }

  if (item.itemType === 'MANUAL') {
    return 'Fritext'
  }

  return 'Övrigt'
}

function compareGroupNames(left: string, right: string) {
  if (left === 'Fritext') {
    return -1
  }

  if (right === 'Fritext') {
    return 1
  }

  return left.localeCompare(right, 'sv')
}

function itemSubtitle(item: ShoppingListItem) {
  if (item.manualNote?.trim()) {
    return item.manualNote
  }

  if (item.externalSnapshot?.subtitle?.trim()) {
    return item.externalSnapshot.subtitle
  }

  if (item.externalSnapshot?.category?.trim()) {
    return item.externalSnapshot.category
  }

  return 'Delad hushållsrad'
}

function formatQuantity(quantity: number) {
  return `${quantity} st`
}

function formatPrice(priceAmount: number, currency: string | null | undefined = 'SEK') {
  return `${priceAmount.toFixed(2)} ${currency ?? 'SEK'}`
}

function calculatePricedItemsTotal(items: ShoppingListItem[]) {
  const pricedItems = items.filter(
    (item) => item.externalSnapshot?.priceAmount !== null && item.externalSnapshot?.priceAmount !== undefined,
  )
  const amount = pricedItems.reduce(
    (sum, item) => sum + (item.externalSnapshot?.priceAmount ?? 0) * item.quantity,
    0,
  )
  const currency = pricedItems.find((item) => item.externalSnapshot?.currency)?.externalSnapshot?.currency ?? 'SEK'
  return { amount, currency }
}

function findMatchingManualSearchItem(items: ShoppingListItem[], title: string) {
  return (
    items.find(
      (item) =>
        item.itemType === 'MANUAL' &&
        item.title.trim().localeCompare(title.trim(), 'sv', { sensitivity: 'accent' }) === 0 &&
        !item.manualNote?.trim(),
    ) ?? null
  )
}

function findMatchingExternalSearchItem(items: ShoppingListItem[], result: RetailerSearchResult) {
  return (
    items.find(
      (item) =>
        item.itemType === 'EXTERNAL_ARTICLE' &&
        item.externalSnapshot?.provider === result.provider &&
        item.externalSnapshot?.articleId === result.articleId,
    ) ?? null
  )
}

function manualSearchKey(title: string) {
  return `manual:${title.trim().toLocaleLowerCase('sv-SE')}`
}

function externalSearchKey(result: RetailerSearchResult) {
  return `external:${result.provider}:${result.articleId}`
}

function searchSelectionQuantity(item: ShoppingListItem | null, pendingAdd: PendingSearchAdd | undefined) {
  return (item?.quantity ?? 0) + (pendingAdd?.quantity ?? 0)
}

function claimPaletteStyle(displayName: string): CSSProperties {
  const hue = hashString(displayName) % 360
  return {
    '--claim-bg': `hsla(${hue}, 78%, 92%, 0.98)`,
    '--claim-border': `hsla(${hue}, 48%, 48%, 0.45)`,
    '--claim-text': `hsl(${hue}, 48%, 28%)`,
  } as CSSProperties
}

function toTitledName(displayName: string) {
  if (!displayName) {
    return displayName
  }

  return displayName.charAt(0).toLocaleUpperCase('sv-SE') + displayName.slice(1)
}

function resolveSearchPage(view: ViewMode, searchParams: URLSearchParams) {
  if (view !== 'search-expanded') {
    return 0
  }

  const rawValue = Number(searchParams.get('page') ?? '1')
  if (!Number.isFinite(rawValue) || rawValue < 1) {
    return 1
  }

  return Math.floor(rawValue)
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}
