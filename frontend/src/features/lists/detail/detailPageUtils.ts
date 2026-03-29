import type { CSSProperties } from 'react'
import type { PricingDetails, RetailerSearchResponse, RetailerSearchResult, ShoppingListItem } from '../../../shared/types/api'

export type ViewMode = 'items' | 'search' | 'search-expanded' | 'checklist'

export interface ItemGroup {
  title: string
  items: ShoppingListItem[]
}

export interface SearchResultsState {
  query: string
  pages: Record<number, RetailerSearchResponse>
}

export interface PendingManualSearchAdd {
  kind: 'manual'
  note: string
  quantity: number
  title: string
}

export interface PendingExternalSearchAdd {
  kind: 'external'
  quantity: number
  result: RetailerSearchResult
}

export type PendingSearchAdd = PendingManualSearchAdd | PendingExternalSearchAdd

export const ROOT_VIEW_ORDER: Exclude<ViewMode, 'search'>[] = ['items', 'checklist']

export function labelForView(view: ViewMode) {
  if (view === 'items') {
    return 'Varor'
  }

  if (view === 'search' || view === 'search-expanded') {
    return 'Sök'
  }

  return 'Checklista'
}

export function resolveView(pathname: string): ViewMode {
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

export function viewPath(actorName: string, listId: string, view: ViewMode, searchQuery = '', page?: number) {
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

export function claimActionKey(itemId: string) {
  return `claim:${itemId}`
}

export function upsertListItem(items: ShoppingListItem[], updatedItem: ShoppingListItem) {
  const existingItemIndex = items.findIndex((item) => item.id === updatedItem.id)
  if (existingItemIndex === -1) {
    return [...items, updatedItem]
  }

  return items.map((item) => (item.id === updatedItem.id ? updatedItem : item))
}

export function compareItemsByCreatedAt(left: ShoppingListItem, right: ShoppingListItem) {
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

export function groupItems(items: ShoppingListItem[]): ItemGroup[] {
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

export function itemSubtitle(item: ShoppingListItem) {
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

export function formatQuantity(quantity: number) {
  return `${quantity} st`
}

export function formatPrice(priceAmount: number, currency: string | null | undefined = 'SEK') {
  return `${priceAmount.toFixed(2)} ${currency ?? 'SEK'}`
}

export function priceLabelsForItem(item: ShoppingListItem) {
  return priceLabelsForSource(item.externalSnapshot?.priceAmount, item.externalSnapshot?.currency, item.externalSnapshot?.pricing)
}

export function priceLabelsForSearchResult(result: RetailerSearchResult) {
  return priceLabelsForSource(result.priceAmount, result.currency, result.pricing)
}

export function calculatePricedItemsTotal(items: ShoppingListItem[]) {
  const pricedItems = items.filter(
    (item) => item.externalSnapshot?.priceAmount !== null && item.externalSnapshot?.priceAmount !== undefined,
  )
  const amount = pricedItems.reduce(
    (sum, item) => sum + calculateEstimatedItemSpend(item),
    0,
  )
  const currency = pricedItems.find((item) => item.externalSnapshot?.currency)?.externalSnapshot?.currency ?? 'SEK'
  return { amount, currency }
}

export function findMatchingManualSearchItem(items: ShoppingListItem[], title: string) {
  return (
    items.find(
      (item) =>
        item.itemType === 'MANUAL' &&
        item.title.trim().localeCompare(title.trim(), 'sv', { sensitivity: 'accent' }) === 0 &&
        !item.manualNote?.trim(),
    ) ?? null
  )
}

export function findMatchingExternalSearchItem(items: ShoppingListItem[], result: RetailerSearchResult) {
  return (
    items.find(
      (item) =>
        item.itemType === 'EXTERNAL_ARTICLE' &&
        item.externalSnapshot?.provider === result.provider &&
        item.externalSnapshot?.articleId === result.articleId,
    ) ?? null
  )
}

export function manualSearchKey(title: string) {
  return `manual:${title.trim().toLocaleLowerCase('sv-SE')}`
}

export function externalSearchKey(result: RetailerSearchResult) {
  return `external:${result.provider}:${result.articleId}`
}

export function searchSelectionQuantity(item: ShoppingListItem | null, pendingAdd: PendingSearchAdd | undefined) {
  return (item?.quantity ?? 0) + (pendingAdd?.quantity ?? 0)
}

export function claimPaletteStyle(displayName: string): CSSProperties {
  const hue = hashString(displayName) % 360
  return {
    '--claim-bg': `hsla(${hue}, 78%, 92%, 0.98)`,
    '--claim-border': `hsla(${hue}, 48%, 48%, 0.45)`,
    '--claim-text': `hsl(${hue}, 48%, 28%)`,
  } as CSSProperties
}

export function resolveSearchPage(view: ViewMode, searchParams: URLSearchParams) {
  if (view !== 'search-expanded') {
    return 0
  }

  const rawValue = Number(searchParams.get('page') ?? '1')
  if (!Number.isFinite(rawValue) || rawValue < 1) {
    return 1
  }

  return Math.floor(rawValue)
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

function priceLabelsForSource(
  priceAmount: number | null | undefined,
  currency: string | null | undefined,
  pricing: PricingDetails | null | undefined,
) {
  if (priceAmount === null || priceAmount === undefined) {
    return []
  }

  const labels = [
    formatUnitPrice(priceAmount, currency, pricing?.unitPriceUnit ?? null),
    formatComparisonPrice(pricing?.comparisonPriceAmount ?? null, pricing?.comparisonPriceUnit ?? null, currency),
  ].filter((label): label is string => Boolean(label))

  return labels.filter((label, index) => labels.indexOf(label) === index)
}

function formatUnitPrice(priceAmount: number, currency: string | null | undefined, unit: string | null) {
  const formattedPrice = formatPrice(priceAmount, currency)
  const normalizedUnit = normalizePriceUnit(unit)
  return normalizedUnit ? `${formattedPrice}/${normalizedUnit}` : formattedPrice
}

function formatComparisonPrice(
  comparePriceAmount: number | null,
  comparePriceUnit: string | null,
  currency: string | null | undefined,
) {
  const unit = normalizePriceUnit(comparePriceUnit)
  if (comparePriceAmount === null || unit === null) {
    return null
  }

  return `${formatPrice(comparePriceAmount, currency)}/${unit}`
}

function calculateEstimatedItemSpend(item: ShoppingListItem) {
  const priceAmount = item.externalSnapshot?.priceAmount ?? 0
  const assumedQuantityFactor = item.externalSnapshot?.pricing?.assumedQuantityFactor ?? 1
  const quantityFactor = item.quantity * assumedQuantityFactor
  return priceAmount * quantityFactor
}

function normalizePriceUnit(unit: string | null) {
  if (!unit?.trim()) {
    return null
  }

  const normalizedUnit = unit.trim().toLocaleLowerCase('sv-SE')
  if (normalizedUnit.startsWith('kr/')) {
    return normalizedUnit.slice(3)
  }

  return normalizedUnit
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}
