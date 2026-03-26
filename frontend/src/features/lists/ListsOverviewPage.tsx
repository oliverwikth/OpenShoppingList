import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createList, fetchLists } from './api'
import { useActorName } from '../actor/useActorName'
import type { ShoppingListOverview } from '../../shared/types/api'
import '../../components/ui/ui.css'

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
  const [lists, setLists] = useState<ShoppingListOverview[]>([])
  const [newListName, setNewListName] = useState(getDefaultListTitle)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadLists()
  }, [])

  async function loadLists() {
    setIsLoading(true)
    setError(null)
    try {
      setLists(await fetchLists())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kunde inte hämta listor.')
    } finally {
      setIsLoading(false)
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
      navigate(`/${actorName}/lists/${createdList.id}`)
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
        {error ? <div className="info-banner">{error}</div> : null}

        <section className="screen-card screen-card--minimal">
          <div className="section-heading">
            <h1>Alla listor</h1>
            <button className="header-action" onClick={() => void loadLists()} type="button">
              Uppdatera
            </button>
          </div>

          {isLoading ? <p className="empty-state">Hamta listor...</p> : null}
          {!isLoading && lists.length === 0 ? <p className="empty-panel">Inga listor an. Tryck pa plus for att skapa den forsta.</p> : null}
          <div className="list-stack">
            {lists.map((list) => (
              <Link className="household-list-card household-list-card--minimal" key={list.id} to={`/${actorName}/lists/${list.id}`}>
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
      </section>

      {isCreateOpen ? (
        <div aria-modal="true" className="modal-backdrop" role="dialog">
          <form className="modal-card inline-form" onSubmit={handleCreateList}>
            <div className="modal-header">
              <h2>Ny lista</h2>
              <button aria-label="Stang" className="modal-close" onClick={closeCreateDialog} type="button">
                ×
              </button>
            </div>
            <input
              aria-label="Listnamn"
              autoFocus
              className="search-input"
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
