import { apiRequest } from '../../shared/api/client'
import type { RetailerSearchResponse } from '../../shared/types/api'

export function searchRetailer(query: string, signal?: AbortSignal) {
  return apiRequest<RetailerSearchResponse>(`/api/retailer-search?q=${encodeURIComponent(query)}`, { signal })
}
