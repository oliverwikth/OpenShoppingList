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
  lastModifiedByDisplayName: string
  createdAt: string
  updatedAt: string
  position: number
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
}

export interface RetailerSearchResponse {
  provider: string
  query: string
  available: boolean
  message: string | null
  results: RetailerSearchResult[]
}

export interface ApiErrorResponse {
  code: string
  message: string
  timestamp: string
}
