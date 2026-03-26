import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useActorName } from '../actor/useActorName'
import { addExternalItem, addManualItem, checkItem, decrementItem, fetchList, uncheckItem } from './api'
import { searchRetailer } from '../retailer-search/api'
import type {
  RetailerSearchResponse,
  RetailerSearchResult,
  ShoppingListDetail,
  ShoppingListItem,
} from '../../shared/types/api'
import '../../components/ui/ui.css'

type ViewMode = 'items' | 'search' | 'checklist'

interface ItemGroup {
  title: string
  items: ShoppingListItem[]
}

const SCREEN_ORDER: ViewMode[] = ['items', 'search', 'checklist']

export function ShoppingListDetailPage() {
  const actorName = useActorName()
  const { listId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [list, setList] = useState<ShoppingListDetail | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const deferredSearchInput = useDeferredValue(searchInput)
  const [searchResponse, setSearchResponse] = useState<RetailerSearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const currentView = resolveView(searchParams.get('view'))

  useEffect(() => {
    void loadList()
  }, [listId])

  useEffect(() => {
    if (currentView !== 'search') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      searchInputRef.current?.focus()
    }, 50)

    return () => window.clearTimeout(timeoutId)
  }, [currentView])

  useEffect(() => {
    if (deferredSearchInput.trim().length < 2) {
      setSearchResponse(null)
      setIsSearching(false)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true)
      try {
        setSearchResponse(await searchRetailer(deferredSearchInput.trim(), controller.signal))
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === 'AbortError') {
          return
        }
        setError(searchError instanceof Error ? searchError.message : 'Kunde inte soka.')
      } finally {
        setIsSearching(false)
      }
    }, 240)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [deferredSearchInput])

  const itemsInOrder = useMemo(() => [...(list?.items ?? [])].sort((left, right) => left.position - right.position), [list?.items])
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
  const manualSearchLabel = searchInput.trim()
  const manualSearchItem = useMemo(
    () => (manualSearchLabel ? findMatchingManualSearchItem(list?.items ?? [], manualSearchLabel) : null),
    [list?.items, manualSearchLabel],
  )

  async function loadList() {
    setIsLoading(true)
    setError(null)
    try {
      const loadedList = await fetchList(listId)
      setList(loadedList)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kunde inte hamta listan.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAddManualFromSearch() {
    if (!manualSearchLabel) {
      return
    }

    setPendingActionKey(manualSearchKey(manualSearchLabel))
    setError(null)
    try {
      await addManualItem(actorName, listId, manualSearchLabel, '')
      await loadList()
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Kunde inte lagga till fritext.')
    } finally {
      setPendingActionKey(null)
    }
  }

  async function handleAddRetailerItem(result: RetailerSearchResult) {
    setPendingActionKey(externalSearchKey(result))
    setError(null)
    try {
      await addExternalItem(actorName, listId, result)
      await loadList()
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Kunde inte lagga till artikeln.')
    } finally {
      setPendingActionKey(null)
    }
  }

  async function handleDecreaseItem(item: ShoppingListItem, actionKey: string) {
    setPendingActionKey(actionKey)
    setError(null)
    try {
      await decrementItem(actorName, listId, item.id)
      await loadList()
    } catch (decreaseError) {
      setError(decreaseError instanceof Error ? decreaseError.message : 'Kunde inte minska antalet.')
    } finally {
      setPendingActionKey(null)
    }
  }

  async function handleToggleItem(item: ShoppingListItem) {
    setPendingActionKey(item.id)
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
      setPendingActionKey(null)
    }
  }

  function switchView(view: ViewMode) {
    setSearchParams(view === 'items' ? {} : { view })
  }

  return (
    <main className="app-frame">
      <header className="app-header">
        <Link className="header-icon-button" to={`/${actorName}`}>
          ←
        </Link>
        <div className="app-header__title">
          <span className="app-header__eyebrow">Att handla som {actorName}</span>
          <strong>{list?.name ?? 'Hamta lista...'}</strong>
        </div>
        <button className="header-action" onClick={() => void loadList()} type="button">
          Uppdatera
        </button>
      </header>

      <section className="screen-body detail-body">
        {error ? <div className="info-banner">{error}</div> : null}
        {isLoading ? <div className="screen-card">Hamta lista...</div> : null}

        {list ? (
          <>
            {currentView === 'items' ? (
              <section className="screen-stack">
                <button
                  aria-label="Oppna sok"
                  className="search-input search-input--button"
                  onClick={() => switchView('search')}
                  type="button"
                >
                  Sok eller lagg till vara
                </button>

                {itemsInOrder.length === 0 ? <p className="empty-panel">Listan ar tom an. Gaa till Sok for att lagga till dina forsta varor.</p> : null}

                {itemsInOrder.length > 0 ? (
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
                        <div className="catalog-row__aside">
                          {item.checked ? <span className="status-pill is-live">Klar</span> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {currentView === 'search' ? (
              <section className="screen-stack">
                <div className="search-shell search-shell--top">
                  <input
                    ref={searchInputRef}
                    aria-label="Sok artikel"
                    className="search-input"
                    placeholder="Lagg till produkt"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </div>

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
                          actionKey={manualSearchKey(manualSearchLabel)}
                          isPending={pendingActionKey === manualSearchKey(manualSearchLabel)}
                          item={manualSearchItem}
                          onDecrease={handleDecreaseItem}
                          onIncrease={handleAddManualFromSearch}
                          title={manualSearchLabel}
                        />
                      </div>
                    </article>
                  ) : null}

                  {isSearching ? <p className="empty-state">Soker...</p> : null}
                  {searchResponse?.available === false && searchResponse.message ? <div className="info-banner">{searchResponse.message}</div> : null}
                  {!isSearching && searchInput.trim().length < 2 ? (
                    <p className="empty-state">Skriv minst tva tecken for att soka artiklar.</p>
                  ) : null}
                  {!isSearching && searchInput.trim().length >= 2 && searchResponse !== null && !searchResponse.results.length ? (
                    <p className="empty-state">Inga butikstraffar just nu. Lagg till som fritext i stallet.</p>
                  ) : null}

                  <div className="catalog-list">
                    {searchResponse?.results.map((result) => (
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
                            actionKey={externalSearchKey(result)}
                            isPending={pendingActionKey === externalSearchKey(result)}
                            item={findMatchingExternalSearchItem(list?.items ?? [], result)}
                            onDecrease={handleDecreaseItem}
                            onIncrease={() => void handleAddRetailerItem(result)}
                            title={result.title}
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {currentView === 'checklist' ? (
              <section className="screen-stack">
                <section className="screen-card screen-card--hero">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">Checklista</span>
                      <h1 className="screen-title">
                        {checkedCount} av {totalQuantity} klara
                      </h1>
                    </div>
                  </div>
                  <p className="screen-subtitle">
                    Pricka av under rundan i butiken. Alla andringar sparas direkt med namn pa den som gjorde dem.
                  </p>
                </section>

                {list.items.length === 0 ? (
                  <section className="screen-card">
                    <p className="empty-state">Inga rader att pricka av an. Lagg till varor i sokvyn forst.</p>
                  </section>
                ) : null}

                {uncheckedChecklistGroups.map((group) => (
                  <section className="screen-card" key={group.title}>
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">Kategori</span>
                        <h2>{group.title}</h2>
                      </div>
                    </div>
                    <div className="checklist-list">
                      {group.items.map((item) => (
                        <article className={`checklist-row ${item.checked ? 'is-checked' : ''}`} key={item.id}>
                          <button
                            aria-label={item.checked ? `Avmarkera ${item.title}` : `Markera ${item.title}`}
                            className={`square-check ${item.checked ? 'is-checked' : ''}`}
                            disabled={pendingActionKey === item.id}
                            onClick={() => void handleToggleItem(item)}
                            type="button"
                          >
                            {item.checked ? 'x' : ''}
                          </button>
                          <div className="catalog-row__media">{renderItemMedia(item)}</div>
                          <div className="catalog-row__content">
                            <strong>{item.title}</strong>
                            <p>{itemSubtitle(item)}</p>
                            <div className="catalog-row__meta">
                              <span>{item.checked ? `Klar av ${item.lastModifiedByDisplayName}` : `Vantar pa ${actorName}`}</span>
                              <span>{formatQuantity(item.quantity)}</span>
                              {item.externalSnapshot?.priceAmount !== null &&
                              item.externalSnapshot?.priceAmount !== undefined ? (
                                <span>{formatPrice(item.externalSnapshot.priceAmount, item.externalSnapshot.currency)}</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="catalog-row__aside">
                            <span className="summary-pill">{item.checked ? 'Klar' : formatQuantity(item.quantity)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}

                {checkedChecklistItems.length > 0 ? (
                  <section className="screen-card">
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">Klart</span>
                        <h2>Avprickade varor</h2>
                      </div>
                    </div>
                    <div className="checklist-list">
                      {checkedChecklistItems.map((item) => (
                        <article className="checklist-row is-checked" key={item.id}>
                          <button
                            aria-label={`Avmarkera ${item.title}`}
                            className="square-check is-checked"
                            disabled={pendingActionKey === item.id}
                            onClick={() => void handleToggleItem(item)}
                            type="button"
                          >
                            x
                          </button>
                          <div className="catalog-row__media">{renderItemMedia(item)}</div>
                          <div className="catalog-row__content">
                            <strong>{item.title}</strong>
                            <p>{itemSubtitle(item)}</p>
                            <div className="catalog-row__meta">
                              <span>{`Klar av ${item.lastModifiedByDisplayName}`}</span>
                              <span>{formatQuantity(item.quantity)}</span>
                              {item.externalSnapshot?.priceAmount !== null &&
                              item.externalSnapshot?.priceAmount !== undefined ? (
                                <span>{formatPrice(item.externalSnapshot.priceAmount, item.externalSnapshot.currency)}</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="catalog-row__aside">
                            <span className="summary-pill">{formatQuantity(item.quantity)}</span>
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
        {SCREEN_ORDER.map((view) => (
          <button
            className={`bottom-tab ${currentView === view ? 'is-active' : ''}`}
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
  actionKey: string
  isPending: boolean
  item: ShoppingListItem | null
  onDecrease: (item: ShoppingListItem, actionKey: string) => Promise<void>
  onIncrease: () => void | Promise<void>
  title: string
}

function QuantityAction({ actionKey, isPending, item, onDecrease, onIncrease, title }: QuantityActionProps) {
  if (!item) {
    return (
      <button
        aria-label={`Lagg till ${title}`}
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
    <div className="quantity-stepper" role="group" aria-label={`Antal for ${title}`}>
      <button
        aria-label={`Minska ${title}`}
        className="quantity-stepper__button"
        disabled={isPending}
        onClick={() => void onDecrease(item, actionKey)}
        type="button"
      >
        -
      </button>
      <span className="quantity-stepper__count">{item.quantity}</span>
      <button
        aria-label={`Oka ${title}`}
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

  if (view === 'search') {
    return 'Sok'
  }

  return 'Checklista'
}

function resolveView(value: string | null): ViewMode {
  if (value === 'search' || value === 'checklist') {
    return value
  }

  return 'items'
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

  return 'Ovrigt'
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

  return 'Delad hushallsrad'
}

function formatQuantity(quantity: number) {
  return `${quantity} st`
}

function formatPrice(priceAmount: number, currency: string | null | undefined = 'SEK') {
  return `${priceAmount.toFixed(2)} ${currency ?? 'SEK'}`
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
