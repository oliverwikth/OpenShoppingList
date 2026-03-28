export type ShoppingListStatus = 'ACTIVE' | 'ARCHIVED'
export type ShoppingListItemType = 'MANUAL' | 'EXTERNAL_ARTICLE'

export interface ShoppingListOverview {
  id: string
  name: string
  status: ShoppingListStatus
  itemCount: number
  checkedItemCount: number
  updatedAt: string
  lastModifiedByDisplayName: string
}

export interface ExternalSnapshot {
  provider: string
  articleId: string
  subtitle: string | null
  imageUrl: string | null
  category: string | null
  priceAmount: number | null
  currency: string | null
}

export interface ShoppingListItem {
  id: string
  itemType: ShoppingListItemType
  title: string
  checked: boolean
  checkedAt: string | null
  checkedByDisplayName: string | null
  claimedAt: string | null
  claimedByDisplayName: string | null
  lastModifiedByDisplayName: string
  createdAt: string
  updatedAt: string
  position: number
  quantity: number
  manualNote: string | null
  externalSnapshot: ExternalSnapshot | null
}

export interface ActivityEntry {
  id: string
  itemId: string | null
  eventType: string
  actorDisplayName: string
  occurredAt: string
}

export interface ShoppingListDetail {
  id: string
  name: string
  status: ShoppingListStatus
  createdAt: string
  updatedAt: string
  lastModifiedByDisplayName: string
  items: ShoppingListItem[]
  recentActivities: ActivityEntry[]
}

export interface ItemQuantityChange {
  itemId: string
  removed: boolean
  item: ShoppingListItem | null
}

export interface ShoppingStatsPoint {
  label: string
  bucketStart: string
  amount: number
  cumulativeAmount: number
  quantity: number
}

export interface TopPurchasedItem {
  title: string
  quantity: number
  spentAmount: number
  imageUrl: string | null
}

export interface ShoppingStats {
  range: 'month' | 'quarter' | 'year' | 'all'
  rangeStart: string
  rangeEnd: string
  currentPeriodLabel: string
  previousPeriodLabel: string | null
  spentAmount: number
  previousSpentAmount: number | null
  currency: string | null
  purchasedQuantity: number
  previousPurchasedQuantity: number | null
  activeListCount: number
  previousActiveListCount: number | null
  averagePricedItemAmount: number
  previousAveragePricedItemAmount: number | null
  spendSeries: ShoppingStatsPoint[]
  topItems: TopPurchasedItem[]
}

export interface RetailerSearchResult {
  provider: string
  articleId: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  category: string | null
  priceAmount: number | null
  currency: string | null
  rawPayloadJson: string
  purchaseCount?: number
}

export interface RetailerSearchResponse {
  provider: string
  query: string
  currentPage: number
  totalPages: number
  totalResults: number
  hasMoreResults: boolean
  available: boolean
  message: string | null
  results: RetailerSearchResult[]
}

export interface ApiErrorResponse {
  code: string
  message: string
  timestamp: string
}
