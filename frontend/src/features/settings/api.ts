import { apiRequest } from '../../shared/api/client'
import type { SettingsSnapshot } from '../../shared/types/api'

export function fetchSettingsSnapshot(activityPage = 1, errorPage = 1, activityPageSize = 2, errorPageSize = 2) {
  const params = new URLSearchParams({
    activityPage: String(activityPage),
    errorPage: String(errorPage),
    activityPageSize: String(activityPageSize),
    errorPageSize: String(errorPageSize),
  })
  return apiRequest<SettingsSnapshot>(`/api/settings?${params.toString()}`)
}
