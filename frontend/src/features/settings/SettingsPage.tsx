import { useEffect, useRef, useState } from 'react'
import { HomeViewSwitch } from '../lists/HomeViewSwitch'
import { useActorName } from '../actor/useActorName'
import { exportSettingsBackup, fetchSettingsSnapshot, importSettingsBackup } from './api'
import { toTitledName } from '../../shared/displayName'
import type {
  AppErrorLogEntry,
  SettingsActivityEntry,
  SettingsBackup,
  SettingsSnapshot,
  ShoppingListOverview,
} from '../../shared/types/api'
import '../../components/ui/ui.css'

type SettingsPageSize = 2 | 5 | 10 | 20 | 50

const SETTINGS_PAGE_SIZE_OPTIONS: Array<{ value: SettingsPageSize; label: string }> = [
  { value: 2, label: '2' },
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' },
]

export function SettingsPage() {
  const actorName = useActorName()
  const [settings, setSettings] = useState<SettingsSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMoreActivity, setIsLoadingMoreActivity] = useState(false)
  const [isLoadingMoreErrors, setIsLoadingMoreErrors] = useState(false)
  const [isExportingBackup, setIsExportingBackup] = useState(false)
  const [isImportingBackup, setIsImportingBackup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [activityPageSize, setActivityPageSize] = useState<SettingsPageSize>(2)
  const [errorPageSize, setErrorPageSize] = useState<SettingsPageSize>(2)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void loadSettings(1, 1, activityPageSize, errorPageSize, 'replace')
  }, [activityPageSize, errorPageSize])

  async function loadSettings(
    activityPage: number,
    errorPage: number,
    nextActivityPageSize: SettingsPageSize,
    nextErrorPageSize: SettingsPageSize,
    mode: 'replace' | 'append-activities' | 'append-errors',
  ) {
    if (mode === 'replace') {
      setIsLoading(true)
      setError(null)
      setBackupMessage(null)
    } else if (mode === 'append-activities') {
      setIsLoadingMoreActivity(true)
    } else {
      setIsLoadingMoreErrors(true)
    }

    try {
      const nextSnapshot = await fetchSettingsSnapshot(activityPage, errorPage, nextActivityPageSize, nextErrorPageSize)
      setSettings((current) => mergeSettingsSnapshot(current, nextSnapshot, mode))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kunde inte hämta inställningar.')
    } finally {
      if (mode === 'replace') {
        setIsLoading(false)
      } else if (mode === 'append-activities') {
        setIsLoadingMoreActivity(false)
      } else {
        setIsLoadingMoreErrors(false)
      }
    }
  }

  return (
    <main className="app-frame">
      <header className="app-header app-header-home">
        <div className="app-header__title app-header__title--left">
          <span className="app-header__eyebrow">Mina listor</span>
          <strong>{toTitledName(actorName)}</strong>
        </div>
        <button
          className="header-action"
          onClick={() => void loadSettings(1, 1, activityPageSize, errorPageSize, 'replace')}
          type="button"
        >
          Uppdatera
        </button>
      </header>

      <section className="screen-body overview-body overview-body--minimal">
        <HomeViewSwitch actorName={actorName} current="settings" />

        {error ? <div className="info-banner">{error}</div> : null}

        <section className="screen-card screen-card--minimal settings-card">
          <div className="section-heading">
            <div>
              <span className="screen-kicker">Inställningar</span>
              <h1>Drift, historik och arkiv</h1>
            </div>
          </div>
          <p className="screen-subtitle">Se arkiverade listor, vem som gjort vad och fel som har loggats i appen.</p>
        </section>

        <section className="screen-card screen-card--minimal settings-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Backup</span>
              <h2>Exportera och importera listor</h2>
            </div>
          </div>
          <p className="screen-subtitle">
            Exportera alla listor till en JSON-fil och importera samma fil igen vid migrering till en ny enhet. Import fungerar bara i en tom app.
          </p>
          {backupMessage ? <div className="info-banner">{backupMessage}</div> : null}
          <div className="settings-backup-actions">
            <button
              className="header-action header-action--light"
              disabled={isExportingBackup || isImportingBackup}
              onClick={() => void handleExportBackup()}
              type="button"
            >
              {isExportingBackup ? 'Exporterar...' : 'Exportera JSON'}
            </button>
            <button
              className="header-action"
              disabled={isExportingBackup || isImportingBackup}
              onClick={() => importInputRef.current?.click()}
              type="button"
            >
              {isImportingBackup ? 'Importerar...' : 'Importera JSON'}
            </button>
            <input
              ref={importInputRef}
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) {
                  return
                }
                void handleImportBackup(file)
                event.target.value = ''
              }}
              style={{ display: 'none' }}
              type="file"
            />
          </div>
        </section>

        {isLoading ? <p className="empty-state">Hämtar inställningar...</p> : null}

        {!isLoading && settings ? (
          <>
            <section className="screen-card screen-card--minimal settings-section">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Arkiv</span>
                  <h2>Arkiverade listor</h2>
                </div>
              </div>
              {settings.archivedLists.length === 0 ? (
                <p className="empty-panel">Inga arkiverade listor ännu.</p>
              ) : (
                <div className="settings-stack">
                  {settings.archivedLists.map((list) => (
                    <ArchivedListRow key={list.id} list={list} />
                  ))}
                </div>
              )}
            </section>

            <section className="screen-card screen-card--minimal settings-section">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Historik</span>
                  <h2>Senaste aktiviteter</h2>
                </div>
                <PageSizeField
                  ariaLabel="Aktiviteter per sida"
                  label="Visa"
                  onChange={(nextPageSize) => setActivityPageSize(nextPageSize)}
                  value={activityPageSize}
                />
              </div>
              {settings.recentActivities.items.length === 0 ? (
                <p className="empty-panel">Ingen historik loggad ännu.</p>
              ) : (
                <div className="settings-stack">
                  {settings.recentActivities.items.map((entry) => (
                    <ActivityRow entry={entry} key={entry.id} />
                  ))}
                  <SettingsPaginationPanel
                    buttonLabel="Visa fler"
                    count={settings.recentActivities.items.length}
                    hasNextPage={settings.recentActivities.hasNextPage}
                    isLoadingMore={isLoadingMoreActivity}
                    onLoadMore={() =>
                      void loadSettings(
                        settings.recentActivities.page + 1,
                        settings.errorLogs.page,
                        activityPageSize,
                        errorPageSize,
                        'append-activities',
                      )
                    }
                    summaryLabel="Visar"
                    total={settings.recentActivities.totalItems}
                  />
                </div>
              )}
            </section>

            <section className="screen-card screen-card--minimal settings-section">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Fel</span>
                  <h2>Loggade fel</h2>
                </div>
                <PageSizeField
                  ariaLabel="Fel per sida"
                  label="Visa"
                  onChange={(nextPageSize) => setErrorPageSize(nextPageSize)}
                  value={errorPageSize}
                />
              </div>
              {settings.errorLogs.items.length === 0 ? (
                <p className="empty-panel">Inga fel loggade än.</p>
              ) : (
                <div className="settings-stack">
                  {settings.errorLogs.items.map((entry) => (
                    <ErrorLogRow entry={entry} key={entry.id} />
                  ))}
                  <SettingsPaginationPanel
                    buttonLabel="Visa fler"
                    count={settings.errorLogs.items.length}
                    hasNextPage={settings.errorLogs.hasNextPage}
                    isLoadingMore={isLoadingMoreErrors}
                    onLoadMore={() =>
                      void loadSettings(
                        settings.recentActivities.page,
                        settings.errorLogs.page + 1,
                        activityPageSize,
                        errorPageSize,
                        'append-errors',
                      )
                    }
                    summaryLabel="Visar"
                    total={settings.errorLogs.totalItems}
                  />
                </div>
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  )

  async function handleExportBackup() {
    setIsExportingBackup(true)
    setError(null)
    setBackupMessage(null)

    try {
      const backup = await exportSettingsBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = backupFilename(backup)
      document.body.append(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(objectUrl)
      setBackupMessage(`Exporterade ${backup.lists.length} listor till JSON.`)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Kunde inte exportera backup.')
    } finally {
      setIsExportingBackup(false)
    }
  }

  async function handleImportBackup(file: File) {
    setIsImportingBackup(true)
    setError(null)
    setBackupMessage(null)

    try {
      const backup = JSON.parse(await readFileText(file)) as SettingsBackup
      const result = await importSettingsBackup(backup)
      await loadSettings(1, 1, activityPageSize, errorPageSize, 'replace')
      setBackupMessage(`Importerade ${result.importedLists} listor och ${result.importedItems} rader.`)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Kunde inte importera backup.')
    } finally {
      setIsImportingBackup(false)
    }
  }
}

function ArchivedListRow({ list }: { list: ShoppingListOverview }) {
  return (
    <article className="settings-entry">
      <div className="settings-entry__body">
        <strong>{list.name}</strong>
        <p>
          Arkiverad {formatDateTime(list.archivedAt ?? list.updatedAt)} av {toTitledName(list.lastModifiedByDisplayName)}
        </p>
      </div>
      <div className="settings-entry__aside">
        <span className="summary-pill">
          {list.checkedItemCount}/{list.itemCount}
        </span>
        <span className="status-pill">Arkiverad</span>
      </div>
    </article>
  )
}

function ActivityRow({ entry }: { entry: SettingsActivityEntry }) {
  return (
    <article className="settings-entry">
      <div className="settings-entry__body">
        <strong>{toTitledName(entry.actorDisplayName)} {describeEvent(entry.eventType)}</strong>
        <p>{entry.listName}</p>
      </div>
      <div className="settings-entry__aside settings-entry__aside--compact">
        <span className="summary-pill">{formatDateTime(entry.occurredAt)}</span>
      </div>
    </article>
  )
}

function ErrorLogRow({ entry }: { entry: AppErrorLogEntry }) {
  const details = safeFormatDetails(entry.detailsJson)

  return (
    <article className="settings-entry settings-entry--stacked">
      <div className="settings-entry__body">
        <strong>{entry.message}</strong>
        <p>
          {entry.source}
          {entry.code ? ` · ${entry.code}` : ''}
          {entry.path ? ` · ${entry.httpMethod ?? 'REQ'} ${entry.path}` : ''}
          {entry.actorDisplayName ? ` · ${toTitledName(entry.actorDisplayName)}` : ''}
        </p>
      </div>
      <div className="settings-entry__aside settings-entry__aside--compact">
        <span className={`settings-log-pill settings-log-pill--${entry.level.toLowerCase()}`}>{entry.level}</span>
        <span className="summary-pill">{formatDateTime(entry.occurredAt)}</span>
      </div>
      {details ? (
        <details className="settings-log-details">
          <summary>Detaljer</summary>
          <pre>{details}</pre>
        </details>
      ) : null}
    </article>
  )
}

function describeEvent(eventType: string) {
  switch (eventType) {
    case 'shopping-list.created':
      return 'skapade en lista'
    case 'shopping-list.renamed':
      return 'bytte namn på en lista'
    case 'shopping-list.archived':
      return 'arkiverade en lista'
    case 'shopping-list-item.added':
      return 'lade till en vara'
    case 'shopping-list-item.checked':
      return 'prickade av en vara'
    case 'shopping-list-item.unchecked':
      return 'avmarkerade en vara'
    case 'shopping-list-item.claimed':
      return 'tog ansvar för en vara'
    case 'shopping-list-item.claim-released':
      return 'släppte ansvar för en vara'
    case 'shopping-list-item.removed':
      return 'tog bort en vara'
    case 'shopping-list-item.quantity-increased':
      return 'ökade antal på en vara'
    case 'shopping-list-item.quantity-decreased':
      return 'minskade antal på en vara'
    default:
      return `gjorde ${eventType}`
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function safeFormatDetails(rawDetails: string) {
  if (!rawDetails || rawDetails === '{}' || rawDetails === 'null') {
    return ''
  }

  try {
    return JSON.stringify(JSON.parse(rawDetails), null, 2)
  } catch {
    return rawDetails
  }
}

function PageSizeField({
  ariaLabel,
  label,
  onChange,
  value,
}: {
  ariaLabel: string
  label: string
  onChange: (value: SettingsPageSize) => void
  value: SettingsPageSize
}) {
  return (
    <label className="lists-page-size">
      <span>{label}</span>
      <span className="lists-page-size__field">
        <select
          aria-label={ariaLabel}
          className="lists-page-size__select"
          onChange={(event) => onChange(parseSettingsPageSize(event.target.value))}
          value={String(value)}
        >
          {SETTINGS_PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option.value} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="lists-page-size__chevron" />
      </span>
    </label>
  )
}

function SettingsPaginationPanel({
  buttonLabel,
  count,
  hasNextPage,
  isLoadingMore,
  onLoadMore,
  summaryLabel,
  total,
}: {
  buttonLabel: string
  count: number
  hasNextPage: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  summaryLabel: string
  total: number
}) {
  const progressWidth = total === 0 ? 0 : Math.max((count / total) * 100, count > 0 ? 4 : 0)

  return (
    <section className="settings-pagination">
      <strong className="settings-pagination__summary">
        {summaryLabel} {count} av {total}
      </strong>
      <div aria-hidden="true" className="settings-pagination__track">
        <span className="settings-pagination__bar" style={{ width: `${progressWidth}%` }} />
      </div>
      {hasNextPage ? (
        <button className="primary-pill settings-pagination__button" disabled={isLoadingMore} onClick={onLoadMore} type="button">
          {isLoadingMore ? 'Hämtar...' : buttonLabel}
        </button>
      ) : null}
    </section>
  )
}

function parseSettingsPageSize(value: string): SettingsPageSize {
  switch (value) {
    case '2':
      return 2
    case '10':
      return 10
    case '20':
      return 20
    case '50':
      return 50
    default:
      return 5
  }
}

function mergeSettingsSnapshot(
  current: SettingsSnapshot | null,
  incoming: SettingsSnapshot,
  mode: 'replace' | 'append-activities' | 'append-errors',
) {
  if (!current || mode === 'replace') {
    return incoming
  }

  if (mode === 'append-activities') {
    return {
      ...incoming,
      errorLogs: current.errorLogs,
      recentActivities: {
        ...incoming.recentActivities,
        items: [...current.recentActivities.items, ...incoming.recentActivities.items],
      },
    }
  }

  return {
    ...incoming,
    recentActivities: current.recentActivities,
    errorLogs: {
      ...incoming.errorLogs,
      items: [...current.errorLogs.items, ...incoming.errorLogs.items],
    },
  }
}

function backupFilename(backup: SettingsBackup) {
  return `open-shopping-list-backup-${backup.exportedAt.replaceAll(':', '-')}.json`
}

async function readFileText(file: File) {
  if (typeof file.text === 'function') {
    return file.text()
  }

  return new Response(file).text()
}
