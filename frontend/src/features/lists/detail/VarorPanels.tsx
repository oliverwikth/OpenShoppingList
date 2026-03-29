import type { PendingSearchAdd } from './detailPageUtils'
import {
  externalSearchKey,
  findMatchingExternalSearchItem,
  itemSubtitle,
  priceLabelsForItem,
  priceLabelsForSearchResult,
  searchSelectionQuantity,
} from './detailPageUtils'
import type { RetailerSearchResponse, RetailerSearchResult, ShoppingListItem } from '../../../shared/types/api'
import { formatPrice } from './detailPageUtils'
import { QuantityAction } from './QuantityAction'

interface VarorItemsPanelProps {
  itemsInOrder: ShoppingListItem[]
  pricedItemsTotal: { amount: number; currency: string }
  onDecreaseItem: (item: ShoppingListItem) => void
  onIncreaseItem: (item: ShoppingListItem) => void
}

export function VarorItemsPanel({
  itemsInOrder,
  pricedItemsTotal,
  onDecreaseItem,
  onIncreaseItem,
}: VarorItemsPanelProps) {
  if (!itemsInOrder.length) {
    return <p className="empty-panel">Listan är tom än. Börja skriva i sökfältet för att lägga till dina första varor.</p>
  }

  return (
    <>
      <div className="catalog-list catalog-list--panel">
        {itemsInOrder.map((item) => (
          <article className="catalog-row catalog-row--minimal" key={item.id}>
            <div className="catalog-row__media">{renderItemMedia(item)}</div>
            <div className="catalog-row__content">
              <strong>{item.title}</strong>
              <div className="catalog-row__meta">
                <span>{itemSubtitle(item)}</span>
                {priceLabelsForItem(item).map((label) => (
                  <span key={`${item.id}:${label}`}>{label}</span>
                ))}
              </div>
            </div>
            <div className="catalog-row__aside catalog-row__aside--stack">
              <QuantityAction
                count={item.quantity}
                isPending={false}
                onDecrease={() => onDecreaseItem(item)}
                onIncrease={() => onIncreaseItem(item)}
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
  )
}

interface SearchResultsPanelProps {
  busySearchActionKeys: Record<string, boolean>
  isSearching: boolean
  items: ShoppingListItem[]
  manualSearchActionKey: string
  manualSearchLabel: string
  manualSearchQuantity: number
  pendingSearchAdds: Record<string, PendingSearchAdd>
  searchInput: string
  searchResponse: RetailerSearchResponse | null
  searchResults: RetailerSearchResult[]
  onAddManual: () => void
  onAddRetailerItem: (result: RetailerSearchResult) => void
  onDecreaseManual: () => void | Promise<void>
  onDecreaseRetailerItem: (result: RetailerSearchResult, item: ShoppingListItem | null) => void | Promise<void>
  onShowMore: () => void
}

export function SearchResultsPanel({
  busySearchActionKeys,
  isSearching,
  items,
  manualSearchActionKey,
  manualSearchLabel,
  manualSearchQuantity,
  pendingSearchAdds,
  searchInput,
  searchResponse,
  searchResults,
  onAddManual,
  onAddRetailerItem,
  onDecreaseManual,
  onDecreaseRetailerItem,
  onShowMore,
}: SearchResultsPanelProps) {
  return (
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
                  onDecrease={manualSearchQuantity > 0 ? onDecreaseManual : undefined}
                  onIncrease={onAddManual}
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
              const matchingItem = findMatchingExternalSearchItem(items, result)
              const actionKey = externalSearchKey(result)
              const quantity = searchSelectionQuantity(matchingItem, pendingSearchAdds[actionKey])

              return (
                <article className="catalog-row" key={result.articleId}>
                  <div className="catalog-row__media">{renderSearchMedia(result)}</div>
                  <div className="catalog-row__content">
                    <strong>{result.title}</strong>
                    <p>{result.subtitle ?? result.category ?? 'Butiksartikel'}</p>
                    <div className="catalog-row__meta">
                      {result.category ? <span>{result.category}</span> : null}
                      {priceLabelsForSearchResult(result).map((label) => (
                        <span key={`${result.articleId}:${label}`}>{label}</span>
                      ))}
                    </div>
                  </div>
                  <div className="catalog-row__aside">
                    <QuantityAction
                      count={quantity}
                      isPending={busySearchActionKeys[actionKey] === true}
                      onDecrease={quantity > 0 ? () => void onDecreaseRetailerItem(result, matchingItem) : undefined}
                      onIncrease={() => void onAddRetailerItem(result)}
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
              onClick={onShowMore}
              type="button"
            >
              <span className="search-expand__icon">↓</span>
              <span>Visa fler träffar</span>
            </button>
          ) : null}
      </div>
    </div>
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
