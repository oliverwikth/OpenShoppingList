import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { archiveList, createList, fetchLists } from './api'
import { HomeViewSwitch } from './HomeViewSwitch'
import { useActorName } from '../actor/useActorName'
import { toTitledName } from '../../shared/displayName'
import type { ShoppingListOverview, ShoppingListOverviewPage, ShoppingListProvider } from '../../shared/types/api'
import '../../components/ui/ui.css'

type ListPageSize = 5 | 10 | 20 | 'all'

const PAGE_SIZE_OPTIONS: Array<{ value: ListPageSize; label: string }> = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 'all', label: 'Alla' },
]

type ProviderPickerOption =
  | { value: ShoppingListProvider; label: string; logoSrc: string; enabled: true }
  | { value: 'ica' | 'coop'; label: string; logoSrc: string; enabled: false }

const LIST_PROVIDER_OPTIONS: Array<ProviderPickerOption> = [
  { value: 'willys', label: 'Willys', logoSrc: '/willys-logo.svg', enabled: true },
  { value: 'lidl', label: 'Lidl', logoSrc: '/lidl-logo.svg', enabled: true },
  { value: 'ica', label: 'ICA', logoSrc: '/ica-logo.svg', enabled: false },
  { value: 'coop', label: 'Coop', logoSrc: '/coop-logo.svg', enabled: false },
]

function getDefaultListTitle() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

export function ListsOverviewPage() {
  const actorName = useActorName()
  const navigate = useNavigate()
  const [listPage, setListPage] = useState<ShoppingListOverviewPage | null>(null)
  const [newListName, setNewListName] = useState(getDefaultListTitle)
  const [newListProvider, setNewListProvider] = useState<ShoppingListProvider>('willys')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [pendingArchiveList, setPendingArchiveList] = useState<ShoppingListOverview | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<ListPageSize>(5)
  const newListInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setPage(1)
    void loadLists(1, pageSize, 'replace')
  }, [pageSize])

  useEffect(() => {
    if (!isCreateOpen) {
      setKeyboardInset(0)
      return
    }

    const viewport = window.visualViewport
    if (!viewport) {
      return
    }

    const updateKeyboardInset = () => {
      const nextInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      setKeyboardInset(nextInset)
    }

    updateKeyboardInset()
    viewport.addEventListener('resize', updateKeyboardInset)
    viewport.addEventListener('scroll', updateKeyboardInset)

    return () => {
      viewport.removeEventListener('resize', updateKeyboardInset)
      viewport.removeEventListener('scroll', updateKeyboardInset)
    }
  }, [isCreateOpen])

  useEffect(() => {
    if (!isCreateOpen) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      newListInputRef.current?.focus()
      newListInputRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' })
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [isCreateOpen])

  async function loadLists(nextPage: number, nextPageSize: ListPageSize, mode: 'replace' | 'append') {
    if (mode === 'append') {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }
    if (mode === 'replace') {
      setError(null)
    }
    try {
      const response = await fetchLists(nextPage, nextPageSize)
      setListPage((currentPage) => {
        if (mode === 'append' && currentPage) {
          return {
            ...response,
            items: [...currentPage.items, ...response.items],
          }
        }

        return response
      })
      setPage(response.page)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kunde inte hämta listor.')
    } finally {
      if (mode === 'append') {
        setIsLoadingMore(false)
      } else {
        setIsLoading(false)
      }
    }
  }

  async function handleCreateList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newListName.trim()) {
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const createdList = await createList(actorName, newListName.trim(), newListProvider)
      closeCreateDialog()
      navigate(`/${actorName}/lists/${createdList.id}/varor`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Kunde inte skapa listan.')
    } finally {
      setIsSaving(false)
    }
  }

  function openCreateDialog() {
    setNewListName(getDefaultListTitle())
    setNewListProvider('willys')
    setIsCreateOpen(true)
  }

  function closeCreateDialog() {
    setIsCreateOpen(false)
    setNewListName(getDefaultListTitle())
    setNewListProvider('willys')
  }

  function openArchiveDialog(list: ShoppingListOverview) {
    setArchiveError(null)
    setPendingArchiveList(list)
  }

  function closeArchiveDialog() {
    if (isArchiving) {
      return
    }

    setArchiveError(null)
    setPendingArchiveList(null)
  }

  function changePageSize(nextPageSize: ListPageSize) {
    setListPage(null)
    setPageSize(nextPageSize)
    setPage(1)
  }

  async function handleArchiveList() {
    if (!pendingArchiveList) {
      return
    }

    setIsArchiving(true)
    setArchiveError(null)
    setError(null)
    try {
      await archiveList(actorName, pendingArchiveList.id)
      setListPage((currentPage) => removeArchivedListFromPage(currentPage, pendingArchiveList.id))
      setPendingArchiveList(null)
    } catch (archiveListError) {
      setArchiveError(archiveListError instanceof Error ? archiveListError.message : 'Kunde inte arkivera listan.')
    } finally {
      setIsArchiving(false)
    }
  }

  const lists = listPage?.items ?? []
  const totalItems = listPage?.totalItems ?? 0
  const visibleCount = lists.length
  const progressWidth = totalItems === 0 ? 0 : Math.max((visibleCount / totalItems) * 100, visibleCount > 0 ? 4 : 0)

  return (
    <main className="app-frame">
      <header className="app-header app-header-home">
        <div className="app-header__title app-header__title--left">
          <span className="app-header__eyebrow">Mina listor</span>
          <strong>{toTitledName(actorName)}</strong>
        </div>
        <button aria-label="Skapa ny lista" className="header-plus" onClick={openCreateDialog} type="button">
          +
        </button>
      </header>

      <section className="screen-body overview-body overview-body--minimal">
        <HomeViewSwitch actorName={actorName} current="lists" />

        {error ? <div className="info-banner">{error}</div> : null}

        <section className="screen-card screen-card--minimal">
          <div className="section-heading">
            <h1>Listor</h1>
            <button className="header-action header-action--light" onClick={() => void loadLists(1, pageSize, 'replace')} type="button">
              Uppdatera
            </button>
          </div>

          <div className="lists-toolbar">
            <label className="lists-page-size">
              <span>Visa</span>
              <span className="lists-page-size__field">
                <select
                  aria-label="Listor per sida"
                  className="lists-page-size__select"
                  onChange={(event) => changePageSize(parsePageSize(event.target.value))}
                  value={String(pageSize)}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option.label} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true" className="lists-page-size__chevron" />
              </span>
            </label>
          </div>

          {isLoading ? <p className="empty-state">Hämtar listor...</p> : null}
          {!isLoading && lists.length === 0 ? <p className="empty-panel">Inga listor än. Tryck på plus för att skapa den första.</p> : null}
          <div className="list-stack">
            {lists.map((list) => (
              <SwipeableListCard
                actorName={actorName}
                disabled={isArchiving}
                key={list.id}
                list={list}
                onRequestArchive={openArchiveDialog}
              />
            ))}
          </div>

        </section>

          {!isLoading && totalItems > 0 ? (
            <section className="lists-load-more">
              <strong className="lists-load-more__summary">Visar {visibleCount} av {totalItems}</strong>
              <div aria-hidden="true" className="lists-load-more__track">
                <span className="lists-load-more__bar" style={{ width: `${progressWidth}%` }} />
              </div>
              {listPage?.hasNextPage ? (
                <button
                  className="primary-pill lists-load-more__button"
                  disabled={isLoadingMore}
                  onClick={() => {
                    void loadLists(page + 1, pageSize, 'append')
                  }}
                  type="button"
                >
                  {isLoadingMore ? 'Hämtar...' : 'Visa fler'}
                </button>
              ) : null}
            </section>
          ) : null}
      </section>

      {isCreateOpen ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
          style={{ '--keyboard-inset': `${keyboardInset}px` } as CSSProperties}
        >
          <form className="modal-card inline-form" onSubmit={handleCreateList}>
            <div className="modal-header">
              <h2>Ny lista</h2>
              <button aria-label="Stäng" className="modal-close" onClick={closeCreateDialog} type="button">
                ×
              </button>
            </div>
            <input
              aria-label="Listnamn"
              autoFocus
              className="search-input"
              ref={newListInputRef}
              value={newListName}
              onChange={(event) => setNewListName(event.target.value)}
            />
            <div className="provider-picker">
              <span className="provider-picker__label">Butik</span>
              <div aria-label="Butik" className="provider-picker__options" role="radiogroup">
                {LIST_PROVIDER_OPTIONS.map((option) => {
                  const isSelected = option.value === newListProvider
                  return (
                    <button
                      aria-checked={isSelected}
                      aria-disabled={!option.enabled}
                      aria-label={option.label}
                      className={`provider-option ${isSelected ? 'is-selected' : ''} ${option.enabled ? '' : 'is-disabled'}`}
                      disabled={!option.enabled}
                      key={option.value}
                      onClick={() => {
                        if (option.enabled) {
                          setNewListProvider(option.value)
                        }
                      }}
                      role="radio"
                      title={option.enabled ? option.label : `${option.label} kommer snart`}
                      type="button"
                    >
                      <img alt="" className="provider-option__logo" src={option.logoSrc} />
                    </button>
                  )
                })}
              </div>
            </div>
            <button className="primary-pill" disabled={isSaving || !newListName.trim()} type="submit">
              {isSaving ? 'Skapar...' : 'Skapa lista'}
            </button>
          </form>
        </div>
      ) : null}

      {pendingArchiveList ? (
        <div aria-modal="true" className="modal-backdrop" role="dialog">
          <div className="modal-card inline-form modal-card--compact">
            <div className="modal-header">
              <h2>Ta bort lista?</h2>
              <button aria-label="Stäng" className="modal-close" disabled={isArchiving} onClick={closeArchiveDialog} type="button">
                ×
              </button>
            </div>
            <p className="modal-copy">
              {pendingArchiveList.name} tas bort från översikten och arkiveras.
            </p>
            {archiveError ? <div className="info-banner">{archiveError}</div> : null}
            <div className="modal-actions">
              <button className="secondary-pill" disabled={isArchiving} onClick={closeArchiveDialog} type="button">
                Avbryt
              </button>
              <button className="danger-pill" disabled={isArchiving} onClick={() => void handleArchiveList()} type="button">
                {isArchiving ? 'Tar bort...' : 'Ja, ta bort'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

interface SwipeableListCardProps {
  actorName: string
  disabled: boolean
  list: ShoppingListOverview
  onRequestArchive: (list: ShoppingListOverview) => void
}

function SwipeableListCard({ actorName, disabled, list, onRequestArchive }: SwipeableListCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const swipeStartXRef = useRef<number | null>(null)
  const swipeStartYRef = useRef<number | null>(null)
  const isSwipingRef = useRef(false)
  const suppressClickRef = useRef(false)

  function resetSwipe() {
    swipeStartXRef.current = null
    swipeStartYRef.current = null
    isSwipingRef.current = false
    setSwipeOffset(0)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (disabled) {
      return
    }

    const target = event.target
    if (target instanceof HTMLElement && target.closest('button')) {
      return
    }

    swipeStartXRef.current = event.clientX
    swipeStartYRef.current = event.clientY
    isSwipingRef.current = false
    suppressClickRef.current = false
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) {
      return
    }

    const deltaX = event.clientX - swipeStartXRef.current
    const deltaY = event.clientY - swipeStartYRef.current

    if (!isSwipingRef.current && Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
      resetSwipe()
      return
    }

    if (deltaX < -8 && Math.abs(deltaX) > Math.abs(deltaY) + 6) {
      isSwipingRef.current = true
      suppressClickRef.current = true
    }

    if (!isSwipingRef.current) {
      return
    }

    setSwipeOffset(Math.max(deltaX, -112))
  }

  function handlePointerCancel() {
    resetSwipe()
  }

  function handlePointerLeave() {
    if (!isSwipingRef.current) {
      return
    }

    resetSwipe()
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) {
      return
    }

    const deltaX = event.clientX - swipeStartXRef.current
    const deltaY = event.clientY - swipeStartYRef.current
    const shouldArchive = isSwipingRef.current && deltaX <= -88 && Math.abs(deltaX) > Math.abs(deltaY)

    resetSwipe()

    if (shouldArchive) {
      onRequestArchive(list)
    }
  }

  function handleClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (!suppressClickRef.current) {
      return
    }

    event.preventDefault()
    suppressClickRef.current = false
  }

  return (
    <div className="list-swipe-card">
      <div aria-hidden="true" className="list-swipe-card__action">
        <Trash2 size={20} strokeWidth={2.25} />
      </div>
      <Link
        className="household-list-card household-list-card--minimal list-swipe-card__content"
        onClick={(event) => handleClick(event)}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined }}
        to={`/${actorName}/lists/${list.id}/varor`}
      >
        <div>
          <strong className="household-list-card__title">{list.name}</strong>
          <p className="household-list-card__meta">Senast av {toTitledName(list.lastModifiedByDisplayName)}</p>
        </div>
        <div className="household-list-card__aside">
          <span className="summary-pill">
            {list.checkedItemCount}/{list.itemCount}
          </span>
          <span className={`status-pill ${list.status === 'ACTIVE' ? 'is-live' : ''}`}>
            {list.status === 'ACTIVE' ? 'Aktiv' : 'Arkiverad'}
          </span>
        </div>
      </Link>
    </div>
  )
}

function parsePageSize(rawValue: string): ListPageSize {
  if (rawValue === 'all') {
    return 'all'
  }

  const parsed = Number.parseInt(rawValue, 10)
  return parsed === 10 || parsed === 20 ? parsed : 5
}

function removeArchivedListFromPage(currentPage: ShoppingListOverviewPage | null, listId: string) {
  if (!currentPage) {
    return currentPage
  }

  const items = currentPage.items.filter((item) => item.id !== listId)
  if (items.length === currentPage.items.length) {
    return currentPage
  }

  const totalItems = Math.max(0, currentPage.totalItems - 1)
  const totalPages = Math.max(1, Math.ceil(totalItems / currentPage.pageSize))
  const page = Math.min(currentPage.page, totalPages)

  return {
    ...currentPage,
    items,
    totalItems,
    totalPages,
    page,
    hasPreviousPage: page > 1,
    hasNextPage: items.length < totalItems,
  }
}
