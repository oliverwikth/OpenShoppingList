import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useActorName } from '../actor/useActorName'
import { addExternalItem, addManualItem, checkItem, fetchList, renameList, uncheckItem } from './api'
import { searchRetailer } from '../retailer-search/api'
import type {
  ActivityEntry,
  RetailerSearchResponse,
  RetailerSearchResult,
  ShoppingListDetail,
  ShoppingListItem,
} from '../../shared/types/api'
import '../../components/ui/ui.css'

export function ShoppingListDetailPage() {
  const actorName = useActorName()
  const { listId = '' } = useParams()
  const [list, setList] = useState<ShoppingListDetail | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [manualTitle, setManualTitle] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const deferredSearchInput = useDeferredValue(searchInput)
  const [searchResponse, setSearchResponse] = useState<RetailerSearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingName, setIsSavingName] = useState(false)
  const [isAddingManual, setIsAddingManual] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadList()
  }, [listId])

  useEffect(() => {
    if (deferredSearchInput.trim().length < 2) {
      setSearchResponse(null)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true)
      try {
        setSearchResponse(await searchRetailer(deferredSearchInput.trim(), controller.signal))
      } catch (searchError) {
        setError(searchError instanceof Error ? searchError.message : 'Kunde inte söka.')
      } finally {
        setIsSearching(false)
      }
    }, 260)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [deferredSearchInput])

  const sortedItems = useMemo(() => {
    return [...(list?.items ?? [])].sort((left, right) => {
      if (left.checked !== right.checked) {
        return left.checked ? 1 : -1
      }
      return left.position - right.position
    })
  }, [list?.items])

  async function loadList() {
    setIsLoading(true)
    setError(null)
    try {
      const loadedList = await fetchList(listId)
      setList(loadedList)
      setNameDraft(loadedList.name)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kunde inte hämta listan.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRenameList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!nameDraft.trim()) {
      return
    }

    setIsSavingName(true)
    setError(null)
    try {
      await renameList(actorName, listId, nameDraft.trim())
      await loadList()
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Kunde inte byta namn.')
    } finally {
      setIsSavingName(false)
    }
  }

  async function handleAddManualItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!manualTitle.trim()) {
      return
    }

    setIsAddingManual(true)
    setError(null)
    try {
      await addManualItem(actorName, listId, manualTitle.trim(), manualNote.trim())
      setManualTitle('')
      setManualNote('')
      await loadList()
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Kunde inte lägga till manuellt objekt.')
    } finally {
      setIsAddingManual(false)
    }
  }

  async function handleAddRetailerItem(result: RetailerSearchResult) {
    setPendingItemId(result.articleId)
    setError(null)
    try {
      await addExternalItem(actorName, listId, result)
      await loadList()
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Kunde inte lägga till butiksversionen.')
    } finally {
      setPendingItemId(null)
    }
  }

  async function handleToggleItem(item: ShoppingListItem) {
    setPendingItemId(item.id)
    setError(null)
    try {
      if (item.checked) {
        await uncheckItem(actorName, listId, item.id)
      } else {
        await checkItem(actorName, listId, item.id)
      }
      await loadList()
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Kunde inte uppdatera raden.')
    } finally {
      setPendingItemId(null)
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="stack" style={{ gap: 10 }}>
          <span className="eyebrow">Aktör · {actorName}</span>
          <Link className="subtle-text" to={`/${actorName}`}>
            ← Till alla listor
          </Link>
        </div>
        {isLoading ? <p className="subtle-text">Hämtar lista...</p> : null}
        {list ? (
          <>
            <h1 className="headline" style={{ marginBottom: 8 }}>
              {list.name}
            </h1>
            <p className="subtle-text">Senast uppdaterad av {list.lastModifiedByDisplayName}.</p>
          </>
        ) : null}
      </section>

      {error ? <div className="info-banner">{error}</div> : null}

      {list ? (
        <div className="grid-two">
          <section className="stack">
            <section className="section-card">
              <h2 style={{ marginTop: 0 }}>Byt listnamn</h2>
              <p className="subtle-text" style={{ marginBottom: 12 }}>
                Bra när samma lista blir en ny veckohandling.
              </p>
              <form className="stack" onSubmit={handleRenameList}>
                <input className="text-input" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
                <button className="button button-secondary" disabled={isSavingName || !nameDraft.trim()} type="submit">
                  {isSavingName ? 'Sparar...' : 'Spara namn'}
                </button>
              </form>
            </section>

            <section className="section-card">
              <h2 style={{ marginTop: 0 }}>Lägg till manuellt</h2>
              <form className="stack" onSubmit={handleAddManualItem}>
                <input
                  className="text-input"
                  placeholder="Till exempel: födelsedagsljus"
                  value={manualTitle}
                  onChange={(event) => setManualTitle(event.target.value)}
                />
                <input
                  className="text-input"
                  placeholder="Valfri anteckning"
                  value={manualNote}
                  onChange={(event) => setManualNote(event.target.value)}
                />
                <button className="button button-primary" disabled={isAddingManual || !manualTitle.trim()} type="submit">
                  {isAddingManual ? 'Lägger till...' : 'Lägg till rad'}
                </button>
              </form>
            </section>

            <section className="section-card">
              <h2 style={{ marginTop: 0 }}>Sök hos Willys</h2>
              <p className="subtle-text" style={{ marginBottom: 12 }}>
                Resultaten används bara som snapshots i checklistan.
              </p>
              <div className="stack">
                <input
                  className="text-input"
                  placeholder="Sök artikel"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                {isSearching ? <p className="subtle-text">Söker...</p> : null}
                {searchResponse?.available === false && searchResponse.message ? (
                  <div className="info-banner">{searchResponse.message}</div>
                ) : null}
                <div className="result-grid">
                  {searchResponse?.results.map((result) => (
                    <article className="search-result-card" key={result.articleId}>
                      <div className="row">
                        {result.imageUrl ? <img alt={result.title} src={result.imageUrl} /> : null}
                        <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                          <strong>{result.title}</strong>
                          {result.subtitle ? <span className="subtle-text">{result.subtitle}</span> : null}
                          <div className="row" style={{ flexWrap: 'wrap' }}>
                            {result.category ? <span className="meta-pill">{result.category}</span> : null}
                            {result.priceAmount !== null ? (
                              <span className="meta-pill">
                                {result.priceAmount.toFixed(2)} {result.currency ?? 'SEK'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <button
                        className="button button-secondary"
                        disabled={pendingItemId === result.articleId}
                        onClick={() => void handleAddRetailerItem(result)}
                        type="button"
                      >
                        {pendingItemId === result.articleId ? 'Lägger till...' : 'Lägg till i listan'}
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </section>

          <section className="stack">
            <section className="section-card">
              <div className="row-between" style={{ marginBottom: 12 }}>
                <div>
                  <h2 style={{ margin: 0 }}>Checklistan</h2>
                  <p className="subtle-text">
                    {list.items.filter((item) => item.checked).length} av {list.items.length} klara.
                  </p>
                </div>
                <button className="button button-ghost" onClick={() => void loadList()} type="button">
                  Uppdatera
                </button>
              </div>

              <div className="stack">
                {sortedItems.map((item) => (
                  <article className="item-row" key={item.id}>
                    <button
                      aria-label={item.checked ? 'Avmarkera rad' : 'Markera rad'}
                      className={`check-button ${item.checked ? 'is-checked' : ''}`}
                      disabled={pendingItemId === item.id}
                      onClick={() => void handleToggleItem(item)}
                      type="button"
                    >
                      {item.checked ? <span className="check-dot" /> : null}
                    </button>
                    <div className="stack" style={{ gap: 6 }}>
                      <p className={`item-title ${item.checked ? 'is-checked' : ''}`}>{item.title}</p>
                      <div className="item-meta">
                        {item.manualNote ? <div>Anteckning: {item.manualNote}</div> : null}
                        {item.externalSnapshot?.subtitle ? <div>{item.externalSnapshot.subtitle}</div> : null}
                        {item.externalSnapshot?.category ? <div>Kategori: {item.externalSnapshot.category}</div> : null}
                        {item.externalSnapshot?.priceAmount !== null && item.externalSnapshot?.priceAmount !== undefined ? (
                          <div>
                            Pris: {item.externalSnapshot.priceAmount.toFixed(2)} {item.externalSnapshot.currency ?? 'SEK'}
                          </div>
                        ) : null}
                        {item.checkedByDisplayName ? <div>Senast av: {item.checkedByDisplayName}</div> : null}
                      </div>
                    </div>
                    {item.externalSnapshot?.imageUrl ? (
                      <img
                        alt=""
                        src={item.externalSnapshot.imageUrl}
                        style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover' }}
                      />
                    ) : (
                      <div />
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className="section-card">
              <h2 style={{ marginTop: 0 }}>Senaste aktivitet</h2>
              <div className="timeline">
                {list.recentActivities.slice(0, 8).map((activity) => (
                  <article className="timeline-entry" key={activity.id}>
                    <strong>{activity.actorDisplayName}</strong>
                    <div className="subtle-text">{renderActivity(activity)}</div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function renderActivity(activity: ActivityEntry) {
  const when = new Date(activity.occurredAt).toLocaleString('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  const action =
    activity.eventType === 'shopping-list-item.checked'
      ? 'checkade en rad'
      : activity.eventType === 'shopping-list-item.unchecked'
        ? 'avmarkerade en rad'
        : activity.eventType === 'shopping-list-item.added'
          ? 'lade till en rad'
          : activity.eventType === 'shopping-list.renamed'
            ? 'döpte om listan'
            : activity.eventType === 'shopping-list.created'
              ? 'skapade listan'
              : 'gjorde en ändring'

  return `${action} · ${when}`
}
