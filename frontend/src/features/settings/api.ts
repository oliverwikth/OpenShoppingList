import { apiRequest } from '../../shared/api/client'
import type { SettingsBackup, SettingsBackupImportResult, SettingsSnapshot } from '../../shared/types/api'

export function fetchSettingsSnapshot(activityPage = 1, errorPage = 1, activityPageSize = 2, errorPageSize = 2) {
  const params = new URLSearchParams({
    activityPage: String(activityPage),
    errorPage: String(errorPage),
    activityPageSize: String(activityPageSize),
    errorPageSize: String(errorPageSize),
  })
  return apiRequest<SettingsSnapshot>(`/api/settings?${params.toString()}`)
}

export function exportSettingsBackup() {
  return apiRequest<SettingsBackup>('/api/settings/backup')
}

export function importSettingsBackup(backup: SettingsBackup) {
  return apiRequest<SettingsBackupImportResult>('/api/settings/backup/import', {
    method: 'POST',
    body: backup,
  })
}
