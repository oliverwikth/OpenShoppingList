import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchStats } from './api'
import { HomeViewSwitch } from './HomeViewSwitch'
import { useActorName } from '../actor/useActorName'
import type { ShoppingStats } from '../../shared/types/api'
import '../../components/ui/ui.css'

type StatsRange = 'month' | 'quarter' | 'year' | 'all'

const STATS_RANGES: Array<{ value: StatsRange; label: string }> = [
  { value: 'month', label: 'Månad' },
  { value: 'quarter', label: 'Kvartal' },
  { value: 'year', label: 'År' },
  { value: 'all', label: 'Allt' },
]

export function ShoppingStatsPage() {
  const actorName = useActorName()
  const [searchParams, setSearchParams] = useSearchParams()
  const [stats, setStats] = useState<ShoppingStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const range = resolveStatsRange(searchParams.get('range'))

  useEffect(() => {
    void loadStats(range)
  }, [range])

  async function loadStats(nextRange: StatsRange) {
    setIsLoading(true)
    setError(null)
    try {
      setStats(await fetchStats(nextRange))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kunde inte hämta statistik.')
    } finally {
      setIsLoading(false)
    }
  }

  function selectRange(nextRange: StatsRange) {
    const nextSearchParams = new URLSearchParams(searchParams)
    if (nextRange === 'month') {
      nextSearchParams.delete('range')
    } else {
      nextSearchParams.set('range', nextRange)
    }
    setSearchParams(nextSearchParams, { replace: true })
  }

  const spendDelta = calculateDelta(stats?.spentAmount ?? 0, stats?.previousSpentAmount ?? null)
  const quantityDelta = calculateDelta(stats?.purchasedQuantity ?? 0, stats?.previousPurchasedQuantity ?? null)
  const listDelta = calculateDelta(stats?.activeListCount ?? 0, stats?.previousActiveListCount ?? null)
  const averageDelta = calculateDelta(stats?.averagePricedItemAmount ?? 0, stats?.previousAveragePricedItemAmount ?? null)
  const chart = useMemo(() => buildStatsChart(stats?.spendSeries ?? []), [stats?.spendSeries])
  const topQuantity = stats?.topItems[0]?.quantity ?? 0

  return (
    <main className="app-frame">
      <header className="app-header app-header-home">
        <div className="app-header__title app-header__title--left">
          <span className="app-header__eyebrow">Mina listor</span>
          <strong>{actorName}</strong>
        </div>
        <button className="header-action" onClick={() => void loadStats(range)} type="button">
          Uppdatera
        </button>
      </header>

      <section className="screen-body overview-body overview-body--minimal">
        <HomeViewSwitch actorName={actorName} current="stats" />

        {error ? <div className="info-banner">{error}</div> : null}

        <section className="stats-hero-card">
          <div className="stats-hero-card__header">
            <div>
              <span className="screen-kicker">Statistik</span>
              <h1 className="stats-hero-card__title">Din shopping i siffror</h1>
              <p className="screen-subtitle">Spendering, tempo och toppvaror i samma vy.</p>
            </div>
            <div className="stats-range-switch" role="tablist" aria-label="Tidsintervall">
              {STATS_RANGES.map((option) => (
                <button
                  aria-selected={range === option.value}
                  className={`stats-range-switch__item ${range === option.value ? 'is-active' : ''}`}
                  key={option.value}
                  onClick={() => selectRange(option.value)}
                  role="tab"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? <p className="empty-state">Hämtar statistik...</p> : null}

          {!isLoading && stats ? (
            <>
              <div className="stats-hero-grid">
                <section className="stats-value-card">
                  <span className="stats-value-card__label">Spenderat {stats.currentPeriodLabel.toLowerCase()}</span>
                  <strong>{formatMoney(stats.spentAmount, stats.currency)}</strong>
                  <TrendPill delta={spendDelta} fallback={stats.previousPeriodLabel ? `vs ${stats.previousPeriodLabel}` : 'Sedan start'} />
                </section>

                <section className="stats-hero-chart" aria-label="Utveckling för spendering">
                  {chart ? (
                    <>
                      <svg className="stats-chart" viewBox="0 0 320 180" preserveAspectRatio="none" role="img">
                        <defs>
                          <linearGradient id="stats-area-fill" x1="0%" x2="0%" y1="0%" y2="100%">
                            <stop offset="0%" stopColor="rgba(61, 166, 109, 0.34)" />
                            <stop offset="100%" stopColor="rgba(61, 166, 109, 0.02)" />
                          </linearGradient>
                        </defs>
                        <path className="stats-chart__grid" d="M0 24 H320 M0 90 H320 M0 156 H320" />
                        <path className="stats-chart__area" d={chart.areaPath} fill="url(#stats-area-fill)" />
                        <path className="stats-chart__line" d={chart.linePath} />
                      </svg>
                      <div className="stats-chart__footer">
                        <span>{stats.spendSeries[0]?.label ?? ''}</span>
                        <span>{stats.spendSeries.at(-1)?.label ?? ''}</span>
                      </div>
                    </>
                  ) : (
                    <p className="empty-state">Ingen spendering att rita upp än.</p>
                  )}
                </section>
              </div>

              <div className="stats-metric-grid">
                <MetricCard
                  delta={quantityDelta}
                  label="Köpta varor"
                  sublabel={stats.previousPurchasedQuantity !== null ? `vs ${stats.previousPeriodLabel}` : 'Ingen jämförelse'}
                  value={String(stats.purchasedQuantity)}
                />
                <MetricCard
                  delta={listDelta}
                  label="Aktiva inköpslistor"
                  sublabel={stats.previousActiveListCount !== null ? `vs ${stats.previousPeriodLabel}` : 'Ingen jämförelse'}
                  value={String(stats.activeListCount)}
                />
                <MetricCard
                  delta={averageDelta}
                  label="Snittpris per prissatt vara"
                  sublabel={stats.previousAveragePricedItemAmount !== null ? `vs ${stats.previousPeriodLabel}` : 'Ingen jämförelse'}
                  value={formatMoney(stats.averagePricedItemAmount, stats.currency)}
                />
              </div>
            </>
          ) : null}
        </section>

        {!isLoading && stats ? (
          <section className="screen-card stats-ranking-card">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Topplista</span>
                <h2>Topp 10 varor</h2>
              </div>
            </div>

            {stats.topItems.length === 0 ? (
              <p className="empty-panel">Inga checkade varor i det här intervallet än.</p>
            ) : (
              <div className="stats-ranking-list">
                {stats.topItems.map((item, index) => {
                  const share = topQuantity > 0 ? Math.max(16, (item.quantity / topQuantity) * 100) : 16

                  return (
                    <article className="stats-ranking-row" key={`${item.title}-${index}`}>
                      <div className="stats-ranking-row__media" aria-hidden="true">
                        {item.imageUrl ? <img alt="" src={item.imageUrl} /> : <span>{topItemInitials(item.title)}</span>}
                      </div>
                      <div className="stats-ranking-row__body">
                        <div className="stats-ranking-row__meta">
                          <strong>{item.title}</strong>
                          <span>{item.quantity} st</span>
                        </div>
                        <div className="stats-ranking-row__bar">
                          <span className="stats-ranking-row__fill" style={{ width: `${share}%` }} />
                        </div>
                      </div>
                      <div className="stats-ranking-row__value">
                        <strong>{formatMoney(item.spentAmount, stats.currency)}</strong>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        ) : null}
      </section>
    </main>
  )
}

interface MetricCardProps {
  delta: DeltaResult
  label: string
  sublabel: string
  value: string
}

function MetricCard({ delta, label, sublabel, value }: MetricCardProps) {
  return (
    <section className="stats-metric-card">
      <span className="stats-metric-card__label">{label}</span>
      <strong>{value}</strong>
      <TrendPill delta={delta} fallback={sublabel} />
    </section>
  )
}

interface TrendPillProps {
  delta: DeltaResult
  fallback: string
}

function TrendPill({ delta, fallback }: TrendPillProps) {
  if (delta.percentage === null) {
    return <span className="trend-pill trend-pill--neutral">{fallback}</span>
  }

  const tone = delta.percentage >= 0 ? 'positive' : 'negative'
  const sign = delta.percentage > 0 ? '+' : ''
  return (
    <span className={`trend-pill trend-pill--${tone}`}>
      {sign}
      {formatPercentage(delta.percentage)}
      <span className="trend-pill__suffix">vs förra</span>
    </span>
  )
}

interface DeltaResult {
  amount: number | null
  percentage: number | null
}

function calculateDelta(current: number, previous: number | null): DeltaResult {
  if (previous === null) {
    return { amount: null, percentage: null }
  }

  if (previous === 0) {
    if (current === 0) {
      return { amount: 0, percentage: 0 }
    }
    return { amount: current, percentage: null }
  }

  return {
    amount: current - previous,
    percentage: ((current - previous) / previous) * 100,
  }
}

function resolveStatsRange(rawRange: string | null): StatsRange {
  if (rawRange === 'quarter' || rawRange === 'year' || rawRange === 'all') {
    return rawRange
  }

  return 'month'
}

function formatMoney(amount: number, currency: string | null) {
  return new Intl.NumberFormat('sv-SE', {
    style: currency ? 'currency' : 'decimal',
    currency: currency ?? undefined,
    maximumFractionDigits: 0,
  }).format(amount)
}

function topItemInitials(title: string) {
  const parts = title.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) {
    return 'TXT'
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('sv-SE'))
    .join('')
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat('sv-SE', {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 1,
  }).format(value) + ' %'
}

function buildStatsChart(points: ShoppingStats['spendSeries']) {
  if (!points.length) {
    return null
  }

  const maxValue = Math.max(...points.map((point) => point.cumulativeAmount), 1)
  const width = 320
  const height = 180
  const paddingX = 12
  const paddingY = 16
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2

  const coordinates = points.map((point, index) => {
    const x = paddingX + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth)
    const y = paddingY + chartHeight - (point.cumulativeAmount / maxValue) * chartHeight
    return { x, y }
  })

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
  const areaPath = `${linePath} L ${(paddingX + chartWidth).toFixed(2)} ${(paddingY + chartHeight).toFixed(2)} L ${paddingX.toFixed(2)} ${(paddingY + chartHeight).toFixed(2)} Z`

  return { areaPath, linePath }
}
