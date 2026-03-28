import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchStats } from './api'
import { HomeViewSwitch } from './HomeViewSwitch'
import { useActorName } from '../actor/useActorName'
import type { ShoppingStats } from '../../shared/types/api'
import '../../components/ui/ui.css'

type StatsRange = 'month' | 'quarter' | 'ytd' | 'year' | 'all'

const STATS_RANGES: Array<{ value: StatsRange; label: string }> = [
  { value: 'month', label: '1 mån' },
  { value: 'quarter', label: '3 mån' },
  { value: 'ytd', label: 'i år' },
  { value: 'year', label: '1 år' },
  { value: 'all', label: 'All time' },
]

interface ChartPointModel {
  index: number
  point: ShoppingStats['spendSeries'][number]
  x: number
  y: number
  xPercent: number
  yPercent: number
}

interface ChartTickModel {
  key: string
  label: string
  x: number
  xPercent: number
  align: 'start' | 'center' | 'end'
}

interface ChartYTickModel {
  key: string
  label: string
  y: number
}

interface StatsChartModel {
  width: number
  height: number
  baselineY: number
  linePath: string
  areaPath: string
  plottedPoints: ChartPointModel[]
  xTicks: ChartTickModel[]
  yTicks: ChartYTickModel[]
}

export function ShoppingStatsPage() {
  const actorName = useActorName()
  const [searchParams, setSearchParams] = useSearchParams()
  const [stats, setStats] = useState<ShoppingStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [heldPointIndex, setHeldPointIndex] = useState<number | null>(null)
  const holdTimerRef = useRef<number | null>(null)
  const range = resolveStatsRange(searchParams.get('range'))

  useEffect(() => {
    void loadStats(range)
  }, [range])

  const spendDelta = calculateDelta(stats?.spentAmount ?? 0, stats?.previousSpentAmount ?? null)
  const quantityDelta = calculateDelta(stats?.purchasedQuantity ?? 0, stats?.previousPurchasedQuantity ?? null)
  const listDelta = calculateDelta(stats?.activeListCount ?? 0, stats?.previousActiveListCount ?? null)
  const averageDelta = calculateDelta(stats?.averagePricedItemAmount ?? 0, stats?.previousAveragePricedItemAmount ?? null)
  const chart = useMemo(() => buildStatsChart(stats?.spendSeries ?? [], range, stats?.currency ?? null), [stats?.spendSeries, range, stats?.currency])
  const selectedPoint = useMemo(() => resolveSelectedPoint(chart, heldPointIndex), [chart, heldPointIndex])
  const topQuantity = stats?.topItems[0]?.quantity ?? 0

  useEffect(() => {
    setHeldPointIndex(null)
    clearHoldTimer()
  }, [chart?.linePath])

  useEffect(() => () => clearHoldTimer(), [])

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

  function clearHoldTimer() {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  function startPointHold(index: number) {
    clearHoldTimer()
    holdTimerRef.current = window.setTimeout(() => {
      setHeldPointIndex(index)
      holdTimerRef.current = null
    }, 220)
  }

  function stopPointHold() {
    clearHoldTimer()
    setHeldPointIndex(null)
  }

  const summaryValue = spendDelta.percentage === null
    ? formatMoney(stats?.spentAmount ?? 0, stats?.currency ?? null)
    : formatSignedPercentage(spendDelta.percentage)
  const summaryTone = spendDelta.percentage === null ? 'neutral' : spendDelta.percentage > 0 ? 'increase' : spendDelta.percentage < 0 ? 'decrease' : 'neutral'
  const summaryLabel = stats ? `Utveckling ${stats.currentPeriodLabel.toLowerCase()}` : 'Utveckling'
  const summaryCaption = stats
    ? spendDelta.percentage === null
      ? `${formatMoney(stats.spentAmount, stats.currency)} totalt`
      : `${formatMoney(stats.spentAmount, stats.currency)} totalt · ${stats.previousPeriodLabel ? `vs ${stats.previousPeriodLabel}` : 'ingen jämförelse'}`
    : ''

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
              <p className="screen-subtitle">Kostnad, tempo och toppvaror i samma vy.</p>
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
              <section className="stats-market-card">
                <div className="stats-market-card__summary">
                  <div className="stats-market-summary">
                    <span className="stats-market-summary__label">{summaryLabel}</span>
                    <strong className={`stats-market-summary__value stats-market-summary__value--${summaryTone}`}>{summaryValue}</strong>
                    <p className="stats-market-summary__caption">{summaryCaption}</p>
                  </div>
                  <div className="stats-market-legend">
                    <span className="stats-market-legend__item">
                      <span className="stats-market-legend__dot" />
                      Listkostnad
                    </span>
                    <span className="stats-market-legend__hint">Håll ned en punkt för datum och värden</span>
                  </div>
                </div>

                <section className="stats-hero-chart" aria-label="Kostnad per period">
                  {chart ? (
                    <div className="stats-chart-panel">
                      <div className="stats-chart-stage">
                        {selectedPoint ? (
                          <div
                            className="stats-chart-tooltip"
                            style={buildTooltipStyle(selectedPoint)}
                          >
                            <strong>{formatTooltipDate(selectedPoint.point.bucketStart, range)}</strong>
                            <span>{formatMoney(selectedPoint.point.amount, stats.currency)}</span>
                            <span>{selectedPoint.point.quantity} varor</span>
                          </div>
                        ) : null}

                        <svg className="stats-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="none" role="img">
                          <defs>
                            <linearGradient id="stats-area-fill" x1="0%" x2="0%" y1="0%" y2="100%">
                              <stop offset="0%" stopColor="rgba(63, 140, 255, 0.22)" />
                              <stop offset="100%" stopColor="rgba(63, 140, 255, 0.03)" />
                            </linearGradient>
                          </defs>

                          {chart.xTicks.map((tick) => (
                            <line
                              className="stats-chart__vertical-grid"
                              key={tick.key}
                              x1={tick.x}
                              x2={tick.x}
                              y1={16}
                              y2={chart.baselineY}
                            />
                          ))}

                          {chart.yTicks.map((tick) => (
                            <g key={tick.key}>
                              <line
                                className="stats-chart__grid"
                                x1={16}
                                x2={chart.width - 54}
                                y1={tick.y}
                                y2={tick.y}
                              />
                              <text className="stats-chart__ylabel" x={chart.width - 4} y={tick.y + 4}>
                                {tick.label}
                              </text>
                            </g>
                          ))}

                          <path className="stats-chart__area" d={chart.areaPath} fill="url(#stats-area-fill)" />
                          <path className="stats-chart__line" d={chart.linePath} />

                          {selectedPoint ? (
                            <line
                              className="stats-chart__guide"
                              x1={selectedPoint.x}
                              x2={selectedPoint.x}
                              y1={16}
                              y2={chart.baselineY}
                            />
                          ) : null}
                        </svg>

                        <div className="stats-chart__markers">
                          {chart.plottedPoints.map((point) => (
                            <button
                              aria-label={`Visa ${formatTooltipDate(point.point.bucketStart, range)}: ${formatMoney(point.point.amount, stats.currency)}`}
                              className={`stats-chart__hotspot ${selectedPoint?.index === point.index ? 'is-active' : ''}`}
                              key={point.index}
                              onBlur={stopPointHold}
                              onFocus={() => setHeldPointIndex(point.index)}
                              onPointerCancel={stopPointHold}
                              onPointerDown={() => startPointHold(point.index)}
                              onPointerLeave={stopPointHold}
                              onPointerUp={stopPointHold}
                              style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }}
                              type="button"
                            >
                              <span className="stats-chart__hotspot-core" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="stats-chart__footer">
                        {chart.xTicks.map((tick) => (
                          <span
                            className={`stats-chart__footer-label stats-chart__footer-label--${tick.align}`}
                            key={tick.key}
                            style={{ left: `${tick.xPercent}%` }}
                          >
                            {tick.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="empty-state">Ingen periodkostnad att rita upp än.</p>
                  )}
                </section>
              </section>

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
  if (rawRange === 'quarter' || rawRange === 'ytd' || rawRange === 'year' || rawRange === 'all') {
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

function formatAxisMoney(amount: number, currency: string | null) {
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

function formatSignedPercentage(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatPercentage(value)}`
}

function formatTooltipDate(bucketStart: string, range: StatsRange) {
  const date = new Date(bucketStart)
  if (range === 'month' || range === 'quarter') {
    return new Intl.DateTimeFormat('sv-SE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date)
  }

  return new Intl.DateTimeFormat('sv-SE', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatAxisDate(bucketStart: string, range: StatsRange) {
  const date = new Date(bucketStart)
  if (range === 'month' || range === 'quarter') {
    return new Intl.DateTimeFormat('sv-SE', {
      day: 'numeric',
      month: 'short',
    }).format(date)
  }

  if (range === 'all') {
    return new Intl.DateTimeFormat('sv-SE', {
      month: 'short',
      year: '2-digit',
    }).format(date)
  }

  return new Intl.DateTimeFormat('sv-SE', {
    month: 'short',
  }).format(date)
}

function buildStatsChart(points: ShoppingStats['spendSeries'], range: StatsRange, currency: string | null): StatsChartModel | null {
  if (!points.length) {
    return null
  }

  const maxValue = Math.max(...points.map((point) => point.amount), 1)
  const width = 360
  const height = 268
  const paddingLeft = 16
  const paddingTop = 18
  const paddingRight = 58
  const paddingBottom = 34
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom
  const baselineY = paddingTop + chartHeight

  const pointCoordinates = points.map((point, index) => {
    const x = paddingLeft + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth)
    const y = point.amount <= 0 ? baselineY : paddingTop + chartHeight - (point.amount / maxValue) * chartHeight
    return {
      index,
      point,
      x,
      y,
      xPercent: (x / width) * 100,
      yPercent: (y / height) * 100,
    }
  })

  const plottedPoints = pointCoordinates.filter((point) => point.point.amount > 0)
  if (!plottedPoints.length) {
    return null
  }

  const linePath = plottedPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  const firstX = plottedPoints[0]?.x ?? paddingLeft
  const lastX = plottedPoints.at(-1)?.x ?? paddingLeft
  const areaPath = `${linePath} L ${lastX.toFixed(2)} ${baselineY.toFixed(2)} L ${firstX.toFixed(2)} ${baselineY.toFixed(2)} Z`

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4
    const value = Math.round(maxValue * (1 - ratio))
    const y = paddingTop + chartHeight * ratio
    return {
      key: `y-${index}`,
      label: formatAxisMoney(value, currency),
      y,
    }
  })

  const tickSource = plottedPoints.length > 0 ? plottedPoints : pointCoordinates
  const xTicks = filterOverlappingTicks(
    buildTickIndices(tickSource.length, Math.min(tickSource.length, 4)).map((index) => {
      const point = tickSource[index]
      return {
        key: `${point?.point.bucketStart ?? index}`,
        label: formatAxisDate(point?.point.bucketStart ?? new Date().toISOString(), range),
        x: point?.x ?? paddingLeft,
        xPercent: point?.xPercent ?? 0,
        align: 'center' as const,
      }
    }),
  ).map((tick, index, ticks) => ({
    ...tick,
    align: resolveTickAlignment(index, ticks.length),
  }))

  return {
    width,
    height,
    baselineY,
    linePath,
    areaPath,
    plottedPoints,
    xTicks,
    yTicks,
  }
}

function resolveSelectedPoint(chart: StatsChartModel | null, selectedPointIndex: number | null) {
  if (!chart || selectedPointIndex === null) {
    return null
  }

  return chart.plottedPoints.find((point) => point.index === selectedPointIndex) ?? null
}

function buildTooltipStyle(point: ChartPointModel) {
  const tooltipWidth = 176
  const tooltipHeight = 84
  const edgePadding = 12
  const tooltipHalfWidth = tooltipWidth / 2
  const leftInset = edgePadding
  const rightInset = edgePadding + tooltipWidth
  const topInset = edgePadding
  const bottomInset = edgePadding + tooltipHeight

  return {
    left: `clamp(${leftInset}px, calc(${point.xPercent}% - ${tooltipHalfWidth}px), calc(100% - ${rightInset}px))`,
    top: `clamp(${topInset}px, calc(${point.yPercent}% - ${tooltipHeight + 16}px), calc(100% - ${bottomInset}px))`,
  }
}

function buildTickIndices(length: number, desiredTicks: number) {
  if (length <= 1 || desiredTicks <= 1) {
    return [0]
  }

  const indices = new Set<number>()
  for (let tickIndex = 0; tickIndex < desiredTicks; tickIndex += 1) {
    indices.add(Math.round((tickIndex / (desiredTicks - 1)) * (length - 1)))
  }

  return [...indices].sort((left, right) => left - right)
}

function filterOverlappingTicks(ticks: ChartTickModel[]) {
  if (ticks.length <= 2) {
    return ticks
  }

  const minSpacing = 74
  const filtered: ChartTickModel[] = [ticks[0]]

  for (let index = 1; index < ticks.length - 1; index += 1) {
    const tick = ticks[index]
    const previousTick = filtered.at(-1)
    const nextTick = ticks[index + 1]

    if (!previousTick) {
      filtered.push(tick)
      continue
    }

    if (tick.x - previousTick.x < minSpacing) {
      continue
    }

    if (nextTick && nextTick.x - tick.x < minSpacing / 1.5) {
      continue
    }

    filtered.push(tick)
  }

  filtered.push(ticks.at(-1)!)
  return filtered
}

function resolveTickAlignment(index: number, length: number): 'start' | 'center' | 'end' {
  if (index === 0) {
    return 'start'
  }

  if (index === length - 1) {
    return 'end'
  }

  return 'center'
}
