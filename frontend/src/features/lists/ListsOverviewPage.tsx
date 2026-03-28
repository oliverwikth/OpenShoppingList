import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createList, fetchLists } from './api'
import { HomeViewSwitch } from './HomeViewSwitch'
import { useActorName } from '../actor/useActorName'
import type { ShoppingListOverviewPage } from '../../shared/types/api'
import '../../components/ui/ui.css'

type ListPageSize = 5 | 10 | 20 | 'all'

const PAGE_SIZE_OPTIONS: Array<{ value: ListPageSize; label: string }> = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 'all', label: 'Alla' },
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
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [error, setError] = useState<string | null>(null)
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
      const createdList = await createList(actorName, newListName.trim())
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
    setIsCreateOpen(true)
  }

  function closeCreateDialog() {
    setIsCreateOpen(false)
    setNewListName(getDefaultListTitle())
  }

  function changePageSize(nextPageSize: ListPageSize) {
    setListPage(null)
    setPageSize(nextPageSize)
    setPage(1)
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
          <strong>{actorName}</strong>
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
            <h1>Alla listor</h1>
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
                <span aria-hidden="true" className="lists-page-size__chevron">
                  ⌄
                </span>
              </span>
            </label>
          </div>

          {isLoading ? <p className="empty-state">Hämtar listor...</p> : null}
          {!isLoading && lists.length === 0 ? <p className="empty-panel">Inga listor än. Tryck på plus för att skapa den första.</p> : null}
          <div className="list-stack">
            {lists.map((list) => (
              <Link className="household-list-card household-list-card--minimal" key={list.id} to={`/${actorName}/lists/${list.id}/varor`}>
                <div>
                  <strong className="household-list-card__title">{list.name}</strong>
                  <p className="household-list-card__meta">Senast av {list.lastModifiedByDisplayName}</p>
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
            <button className="primary-pill" disabled={isSaving || !newListName.trim()} type="submit">
              {isSaving ? 'Skapar...' : 'Skapa lista'}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  )
}

function parsePageSize(rawValue: string): ListPageSize {
  if (rawValue === 'all') {
    return 'all'
  }

  const parsed = Number.parseInt(rawValue, 10)
  return parsed === 10 || parsed === 20 ? parsed : 5
}
