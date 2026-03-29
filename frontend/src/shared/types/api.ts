export type ShoppingListStatus = 'ACTIVE' | 'ARCHIVED'
export type ShoppingListItemType = 'MANUAL' | 'EXTERNAL_ARTICLE'

export interface ShoppingListOverview {
  id: string
  name: string
  status: ShoppingListStatus
  itemCount: number
  checkedItemCount: number
  updatedAt: string
  archivedAt: string | null
  lastModifiedByDisplayName: string
}

export interface ShoppingListOverviewPage {
  items: ShoppingListOverview[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export interface PricingDetails {
  unitPriceUnit: string | null
  comparisonPriceAmount: number | null
  comparisonPriceUnit: string | null
  assumedQuantityFactor: number | null
}

export interface ExternalSnapshot {
  provider: string
  articleId: string
  subtitle: string | null
  imageUrl: string | null
  category: string | null
  priceAmount: number | null
  currency: string | null
  pricing: PricingDetails | null
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
  range: 'month' | 'quarter' | 'ytd' | 'year' | 'all'
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
  pricing: PricingDetails | null
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

export interface SettingsActivityEntry {
  id: string
  listId: string
  listName: string
  itemId: string | null
  eventType: string
  actorDisplayName: string
  occurredAt: string
}

export interface SettingsActivityPage {
  items: SettingsActivityEntry[]
  page: number
  pageSize: number
  totalItems: number
  hasNextPage: boolean
}

export interface AppErrorLogEntry {
  id: string
  level: string
  source: string
  code: string | null
  message: string
  path: string | null
  httpMethod: string | null
  actorDisplayName: string | null
  detailsJson: string
  occurredAt: string
}

export interface AppErrorLogPage {
  items: AppErrorLogEntry[]
  page: number
  pageSize: number
  totalItems: number
  hasNextPage: boolean
}

export interface SettingsSnapshot {
  archivedLists: ShoppingListOverview[]
  recentActivities: SettingsActivityPage
  errorLogs: AppErrorLogPage
}

export interface SettingsBackupExternalSnapshot {
  provider: string
  articleId: string
  subtitle: string | null
  imageUrl: string | null
  category: string | null
  priceAmount: number | null
  currency: string | null
  pricing: PricingDetails | null
}

export interface SettingsBackupItem {
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
  externalSnapshot: SettingsBackupExternalSnapshot | null
}

export interface SettingsBackupList {
  id: string
  name: string
  status: ShoppingListStatus
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  lastModifiedByDisplayName: string
  items: SettingsBackupItem[]
}

export interface SettingsBackup {
  format: string
  version: number
  exportedAt: string
  lists: SettingsBackupList[]
}

export interface SettingsBackupImportResult {
  importedLists: number
  importedItems: number
}
