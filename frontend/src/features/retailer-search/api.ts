import { apiRequest } from '../../shared/api/client'
import type { RetailerSearchResponse } from '../../shared/types/api'

export function searchRetailer(query: string, page = 0, signal?: AbortSignal) {
  return apiRequest<RetailerSearchResponse>(`/api/retailer-search?q=${encodeURIComponent(query)}&page=${page}`, { signal })
}
