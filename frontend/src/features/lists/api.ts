import { apiRequest } from '../../shared/api/client'
import type {
  ItemQuantityChange,
  RetailerSearchResult,
  ShoppingListDetail,
  ShoppingListItem,
  ShoppingListOverview,
} from '../../shared/types/api'

export function fetchLists() {
  return apiRequest<ShoppingListOverview[]>('/api/lists')
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

export function fetchList(listId: string) {
  return apiRequest<ShoppingListDetail>(`/api/lists/${listId}`)
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
      rawPayloadJson: result.rawPayloadJson,
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
