import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createList, fetchLists } from './api'
import { useActorName } from '../actor/useActorName'
import type { ShoppingListOverview } from '../../shared/types/api'
import '../../components/ui/ui.css'

export function ListsOverviewPage() {
  const actorName = useActorName()
  const navigate = useNavigate()
  const [lists, setLists] = useState<ShoppingListOverview[]>([])
  const [newListName, setNewListName] = useState('')
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
      setNewListName('')
      navigate(`/${actorName}/lists/${createdList.id}`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Kunde inte skapa listan.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="eyebrow">Hushållsläge · {actorName}</span>
        <h1 className="headline">Delade inköpslistor utan konton och krångel.</h1>
        <p className="subtle-text">
          Öppna appen via <code>/{actorName}</code> och börja direkt. Alla i hushållet ser samma data, och ditt namn
          används bara för att visa vem som checkade av eller ändrade något.
        </p>
      </section>

      <section className="section-card">
        <h2 style={{ marginTop: 0 }}>Skapa ny lista</h2>
        <p className="subtle-text" style={{ marginBottom: 14 }}>
          Exempel: Veckohandling, Helgmiddag, Födelsedag.
        </p>
        <form className="stack" onSubmit={handleCreateList}>
          <input
            aria-label="Listnamn"
            className="text-input"
            placeholder="Veckohandling"
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
          />
          <button className="button button-primary" type="submit" disabled={isSaving || !newListName.trim()}>
            {isSaving ? 'Skapar...' : 'Skapa lista'}
          </button>
        </form>
      </section>

      {error ? <div className="info-banner">{error}</div> : null}

      <section className="section-card">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0 }}>Alla listor</h2>
            <p className="subtle-text">Aktiva och arkiverade hushållslistor.</p>
          </div>
          <button className="button button-ghost" onClick={() => void loadLists()} type="button">
            Uppdatera
          </button>
        </div>

        {isLoading ? <p className="subtle-text">Hämtar listor...</p> : null}

        {!isLoading && lists.length === 0 ? (
          <p className="subtle-text">Inga listor än. Skapa den första ovan.</p>
        ) : null}

        <div className="grid">
          {lists.map((list) => (
            <Link className="list-card" key={list.id} to={`/${actorName}/lists/${list.id}`}>
              <div className="row-between">
                <strong>{list.name}</strong>
                <span className="meta-pill">{list.status === 'ACTIVE' ? 'Aktiv' : 'Arkiverad'}</span>
              </div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <span className="meta-pill">
                  {list.checkedItemCount} av {list.itemCount} klara
                </span>
                <span className="meta-pill">Senast av {list.lastModifiedByDisplayName}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
