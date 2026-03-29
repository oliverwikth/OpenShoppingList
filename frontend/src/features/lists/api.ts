import { apiRequest } from '../../shared/api/client'
import type {
  ItemQuantityChange,
  RetailerSearchResult,
  ShoppingListDetail,
  ShoppingListItem,
  ShoppingListOverview,
  ShoppingListOverviewPage,
  ShoppingStats,
} from '../../shared/types/api'

export function fetchLists(page: number, pageSize: number | 'all') {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return apiRequest<ShoppingListOverviewPage>(`/api/lists?${params.toString()}`)
}

export function createList(actorName: string, name: string) {
  return apiRequest<ShoppingListOverview>('/api/lists', {
    method: 'POST',
    actorName,
    body: { name },
  })
}

export function renameList(actorName: string, listId: string, name: string) {
  return apiRequest<ShoppingListOverview>(`/api/lists/${listId}`, {
    method: 'PATCH',
    actorName,
    body: { name },
  })
}

export function archiveList(actorName: string, listId: string) {
  return apiRequest<ShoppingListOverview>(`/api/lists/${listId}/archive`, {
    method: 'POST',
    actorName,
  })
}

export function fetchList(listId: string) {
  return apiRequest<ShoppingListDetail>(`/api/lists/${listId}`)
}

export function fetchStats(range: 'month' | 'quarter' | 'ytd' | 'year' | 'all') {
  return apiRequest<ShoppingStats>(`/api/lists/stats?range=${range}`)
}

export function addManualItem(actorName: string, listId: string, title: string, note: string, quantity = 1) {
  return apiRequest<ShoppingListItem>(`/api/lists/${listId}/items/manual`, {
    method: 'POST',
    actorName,
    body: { title, note, quantity },
  })
}

export function addExternalItem(actorName: string, listId: string, result: RetailerSearchResult, quantity = 1) {
  return apiRequest<ShoppingListItem>(`/api/lists/${listId}/items/external`, {
    method: 'POST',
    actorName,
    body: {
      provider: result.provider,
      articleId: result.articleId,
      title: result.title,
      subtitle: result.subtitle,
      imageUrl: result.imageUrl,
      category: result.category,
      priceAmount: result.priceAmount,
      currency: result.currency,
      pricing: result.pricing,
      quantity,
    },
  })
}

export function checkItem(actorName: string, listId: string, itemId: string) {
  return apiRequest<ShoppingListItem>(`/api/lists/${listId}/items/${itemId}/check`, {
    method: 'POST',
    actorName,
  })
}

export function uncheckItem(actorName: string, listId: string, itemId: string) {
  return apiRequest<ShoppingListItem>(`/api/lists/${listId}/items/${itemId}/uncheck`, {
    method: 'POST',
    actorName,
  })
}

export function toggleItemClaim(actorName: string, listId: string, itemId: string) {
  return apiRequest<ShoppingListItem>(`/api/lists/${listId}/items/${itemId}/claim`, {
    method: 'POST',
    actorName,
  })
}

export function decrementItem(actorName: string, listId: string, itemId: string) {
  return apiRequest<ItemQuantityChange>(`/api/lists/${listId}/items/${itemId}/decrement`, {
    method: 'POST',
    actorName,
  })
}

export function adjustItemQuantity(actorName: string, listId: string, itemId: string, delta: number) {
  return apiRequest<ItemQuantityChange>(`/api/lists/${listId}/items/${itemId}/quantity-adjust`, {
    method: 'POST',
    actorName,
    body: { delta },
  })
}
