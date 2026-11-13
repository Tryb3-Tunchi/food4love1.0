'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  RANGE_PRESETS,
  type RangePreset,
} from '@/lib/admin/intelligence/dateRange'
import type { FunnelRow, Metric, Point } from '@/lib/admin/intelligence/series'

// ------------------------------------------------------------------ data
export interface RangeValue {
  range: RangePreset
  from: string
  to: string
}

export function useRangeState(initial: RangePreset = '30d') {
  const [value, setValue] = useState<RangeValue>({
    range: initial,
    from: '',
    to: '',
  })
  const params = useMemo<Record<string, string | undefined>>(
    () =>
      value.range === 'custom'
        ? { range: 'custom', from: value.from, to: value.to }
        : { range: value.range as string },
    [value],
  )
  return { value, setValue, params }
}

export function useAdminData<T>(
  path: string,
  params: Record<string, string | undefined> = {},
  refreshMs = 0,
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const latest = useRef(0)
  const query = useMemo(() => {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v) search.set(k, v)
    })
    return search.toString()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)])

  const load = useCallback(
    async (silent = false) => {
      const id = ++latest.current
      if (!silent) setLoading(true)
      try {
        const response = await fetch(`/api/admin/${path}?${query}`, {
          cache: 'no-store',
        })
        const body = await response.json().catch(() => ({}))
        if (id !== latest.current) return // a newer request replaced this one
        if (!response.ok) {
          setError(body.error || 'Could not load this page')
          if (!silent) setData(null)
        } else {
          setData(body as T)
          setError('')
        }
      } catch {
        if (id === latest.current) setError('Could not reach the server')
      } finally {
        if (id === latest.current) setLoading(false)
      }
    },
    [path, query],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!refreshMs) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true)
    }, refreshMs)
    return () => window.clearInterval(timer)
  }, [load, refreshMs])

  return { data, error, loading, reload: () => load() }
}

// -------------------------------------------------------------- formatting
export const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-NG')

export const fmtPercent = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('en-NG')}%`

export function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(
    'en-NG',
    withTime
      ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  )
}

export function fmtAgo(iso: string | null | undefined) {
  if (!iso) return 'never'
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (seconds < 90) return 'just now'
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`
  return `${Math.round(seconds / 86400)} d ago`
}

export function countryName(code: string) {
  if (code === '??') return 'Unknown'
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

// -------------------------------------------------------------- page shell
export function Page({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mx-auto min-h-[calc(100dvh-4rem)] max-w-7xl px-4 py-7 text-[var(--admin-text)] sm:px-6 sm:py-9 lg:px-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--admin-muted)]">
            {description}
          </p>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </header>
      <div className="space-y-7">{children}</div>
    </section>
  )
}

export function Panel({
  title,
  hint,
  children,
  className = '',
}: {
  title?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5 ${className}`}
    >
      {title && (
        <div className="mb-3">
          <h2 className="text-sm font-bold">{title}</h2>
          {hint && (
            <p className="mt-0.5 text-xs text-[var(--admin-muted)]">{hint}</p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

export function RefreshButton({
  onClick,
  loading,
}: {
  onClick: () => void
  loading: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="Refresh"
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm font-semibold transition hover:bg-[var(--admin-hover)] disabled:opacity-50"
    >
      <RefreshCw
        aria-hidden="true"
        className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
      />
      <span className="hidden sm:inline">Refresh</span>
    </button>
  )
}

export function RangeBar({
  value,
  onChange,
}: {
  value: RangeValue
  onChange: (next: RangeValue) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Date range"
        className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1"
      >
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            aria-pressed={value.range === preset.key}
            onClick={() => onChange({ ...value, range: preset.key })}
            className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold transition ${value.range === preset.key ? 'bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]' : 'text-[var(--admin-muted)] hover:bg-[var(--admin-hover)] hover:text-[var(--admin-text)]'}`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {value.range === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-[var(--admin-muted)]">From</span>
            <input
              type="date"
              max={today}
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="min-h-9 rounded-lg border px-2"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-[var(--admin-muted)]">To</span>
            <input
              type="date"
              max={today}
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="min-h-9 rounded-lg border px-2"
            />
          </label>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------- states
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-[var(--admin-hover)] ${className}`}
    />
  )
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-36" />
      ))}
    </div>
  )
}

export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-500/40 bg-red-500/5 p-5 text-sm"
    >
      <p className="font-semibold text-red-500">Could not load this page</p>
      <p className="mt-1 text-[var(--admin-muted)]">
        {message === 'Forbidden'
          ? 'Your staff access does not include this section. Ask a Super Admin to add the permission in Staff access.'
          : message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-10 rounded-lg border border-[var(--admin-border)] px-4 text-sm font-semibold hover:bg-[var(--admin-hover)]"
        >
          Try again
        </button>
      )}
    </div>
  )
}

// "This is not being collected" is a different thing from "zero".
export function Unavailable({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--admin-border)] p-5 text-sm text-[var(--admin-muted)]">
      <p className="font-semibold text-[var(--admin-text)]">
        Not available yet
      </p>
      <p className="mt-1">{children}</p>
    </div>
  )
}

// -------------------------------------------------------------- metric card
function GrowthChip({ growth }: { growth: number | null }) {
  if (growth === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--admin-muted)]">
        <Minus aria-hidden="true" className="h-3 w-3" /> no comparison
      </span>
    )
  }
  const up = growth > 0
  const flat = growth === 0
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${flat ? 'text-[var(--admin-muted)]' : up ? 'text-emerald-600' : 'text-red-500'}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {up ? '+' : ''}
      {growth}%
      <span className="sr-only"> compared with the previous period</span>
    </span>
  )
}

export function Sparkline({ points }: { points: Point[] }) {
  if (points.length < 2) return null
  const max = Math.max(1, ...points.map((p) => p.v))
  const w = 100
  const h = 28
  const step = w / (points.length - 1)
  const line = points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${(h - (p.v / max) * (h - 3) - 1.5).toFixed(2)}`,
    )
    .join(' ')
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-8 w-full"
      aria-hidden="true"
    >
      <path
        d={`${line} L${w},${h} L0,${h} Z`}
        fill="var(--admin-accent-soft)"
      />
      <path
        d={line}
        fill="none"
        stroke="var(--admin-accent)"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function MetricCard({
  label,
  metric,
  icon: Icon,
  href,
  mode = 'range',
  suffix = '',
  seconds = false,
}: {
  label: string
  metric: Metric | undefined
  icon: LucideIcon
  href?: string
  // 'total' shows the all-time figure large and the period change small.
  mode?: 'range' | 'total'
  suffix?: string
  seconds?: boolean
}) {
  const inner = !metric ? (
    <Skeleton className="h-full min-h-28" />
  ) : metric.status === 'unavailable' ? (
    <>
      <CardHead label={label} Icon={Icon} />
      <p className="mt-3 text-sm font-semibold text-[var(--admin-muted)]">
        Not available yet
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--admin-muted)]">
        {metric.reason}
      </p>
    </>
  ) : (
    (() => {
      const useTotal = mode === 'total' && metric.total !== undefined
      const big = useTotal ? (metric.total as number) : metric.value
      return (
        <>
          <CardHead label={label} Icon={Icon} />
          <p className="mt-2 font-display text-3xl font-bold tracking-tight">
            {seconds ? fmtSeconds(big) : fmt(big)}
            {suffix}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[var(--admin-muted)]">
            {useTotal && <span>{fmt(metric.value)} in period</span>}
            {metric.previous !== null && <GrowthChip growth={metric.growth} />}
          </div>
          <div className="mt-2">
            <Sparkline points={metric.series} />
          </div>
          {metric.note && (
            <p
              className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--admin-muted)]"
              title={metric.note}
            >
              {metric.note}
            </p>
          )}
        </>
      )
    })()
  )

  const classes =
    'block h-full rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition'
  return href && metric?.status !== 'unavailable' ? (
    <Link
      href={href}
      className={`${classes} hover:border-[var(--admin-accent)] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--admin-accent)]`}
    >
      {inner}
    </Link>
  ) : (
    <div className={classes}>{inner}</div>
  )
}

function CardHead({ label, Icon }: { label: string; Icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-muted)]">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      {label}
    </div>
  )
}

export function fmtSeconds(total: number) {
  if (total < 60) return `${total}s`
  const m = Math.floor(total / 60)
  const s = total % 60
  return s ? `${m}m ${s}s` : `${m}m`
}

// ------------------------------------------------------------------ charts
export function AreaChart({
  points,
  label,
  height = 180,
}: {
  points: Point[]
  label: string
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2) {
    return (
      <p className="text-sm text-[var(--admin-muted)]">
        Not enough data to draw a trend.
      </p>
    )
  }
  const max = Math.max(1, ...points.map((p) => p.v))
  const w = 600
  const h = height
  const pad = { l: 8, r: 8, t: 10, b: 22 }
  const x = (i: number) =>
    pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b)
  const line = points
    .map(
      (p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`,
    )
    .join(' ')
  const step = Date.parse(points[1].t) - Date.parse(points[0].t)
  const hourly = step < 24 * 3600 * 1000
  const tick = (t: string) =>
    new Date(t).toLocaleString(
      'en-NG',
      hourly
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short' },
    )
  const total = points.reduce((s, p) => s + p.v, 0)
  const peak = points.reduce((a, b) => (b.v > a.v ? b : a))
  const active = hover !== null ? points[hover] : null

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full touch-pan-y"
        role="img"
        aria-label={`${label}. Total ${total}. Highest ${peak.v} at ${tick(peak.t)}.`}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientX - box.left) / box.width
          setHover(
            Math.min(
              points.length - 1,
              Math.max(0, Math.round(ratio * (points.length - 1))),
            ),
          )
        }}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((g) => (
          <line
            key={g}
            x1={pad.l}
            x2={w - pad.r}
            y1={y(max * g)}
            y2={y(max * g)}
            stroke="var(--admin-border)"
            strokeDasharray="3 4"
          />
        ))}
        <path
          d={`${line} L${x(points.length - 1)},${h - pad.b} L${x(0)},${h - pad.b} Z`}
          fill="var(--admin-accent-soft)"
        />
        <path
          d={line}
          fill="none"
          stroke="var(--admin-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {active && (
          <>
            <line
              x1={x(hover!)}
              x2={x(hover!)}
              y1={pad.t}
              y2={h - pad.b}
              stroke="var(--admin-muted)"
              strokeDasharray="2 3"
            />
            <circle
              cx={x(hover!)}
              cy={y(active.v)}
              r="4"
              fill="var(--admin-accent)"
            />
          </>
        )}
        <text x={pad.l} y={h - 5} fontSize="11" fill="var(--admin-muted)">
          {tick(points[0].t)}
        </text>
        <text
          x={w - pad.r}
          y={h - 5}
          fontSize="11"
          textAnchor="end"
          fill="var(--admin-muted)"
        >
          {tick(points[points.length - 1].t)}
        </text>
        <text
          x={w - pad.r}
          y={pad.t + 8}
          fontSize="11"
          textAnchor="end"
          fill="var(--admin-muted)"
        >
          {max}
        </text>
      </svg>
      <figcaption
        className="mt-1 text-xs text-[var(--admin-muted)]"
        aria-live="polite"
      >
        {active
          ? `${tick(active.t)}: ${active.v}`
          : `${label} · total ${fmt(total)}`}
      </figcaption>
    </figure>
  )
}

export function BarList({
  items,
  empty = 'Nothing recorded yet.',
  format = fmt,
  onSelect,
}: {
  items: { key: string; label: string; value: number; sub?: string }[]
  empty?: string
  format?: (n: number) => string
  onSelect?: (key: string) => void
}) {
  if (!items.length)
    return <p className="text-sm text-[var(--admin-muted)]">{empty}</p>
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{item.label}</span>
              <span className="shrink-0 tabular-nums">
                {format(item.value)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--admin-hover)]">
              <div
                className="h-full rounded-full bg-[var(--admin-accent)]"
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
              />
            </div>
            {item.sub && (
              <p className="mt-0.5 text-[11px] text-[var(--admin-muted)]">
                {item.sub}
              </p>
            )}
          </>
        )
        return (
          <li key={item.key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                className="block w-full rounded-lg p-1.5 text-left hover:bg-[var(--admin-hover)]"
              >
                {body}
              </button>
            ) : (
              <div className="p-1.5">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function FunnelChart({ rows }: { rows: FunnelRow[] }) {
  if (!rows.length)
    return (
      <p className="text-sm text-[var(--admin-muted)]">
        The journey could not be calculated right now.
      </p>
    )
  return (
    <ol className="space-y-3">
      {rows.map((row, i) => (
        <li key={row.key}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">
              {i + 1}. {row.label}
            </span>
            <span className="tabular-nums">
              {row.count === null ? (
                <span className="text-[var(--admin-muted)]">Not measured</span>
              ) : (
                <>
                  {fmt(row.count)}
                  {row.percentOfPrevious !== null && (
                    <span className="ml-2 text-xs text-[var(--admin-muted)]">
                      {fmtPercent(row.percentOfPrevious)} of previous step
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-[var(--admin-hover)]">
            {row.count !== null && (
              <div
                className="h-full rounded-full bg-[var(--admin-accent)]"
                style={{ width: `${Math.max(1.5, row.percentOfFirst ?? 0)}%` }}
              />
            )}
          </div>
          {row.note && (
            <p className="mt-0.5 text-[11px] text-[var(--admin-muted)]">
              {row.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

export function StatusChip({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'neutral'
  children: ReactNode
}) {
  const color =
    tone === 'ok'
      ? 'text-emerald-600 border-emerald-600/40'
      : tone === 'warn'
        ? 'text-amber-600 border-amber-600/40'
        : tone === 'bad'
          ? 'text-red-500 border-red-500/40'
          : 'text-[var(--admin-muted)] border-[var(--admin-border)]'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${color}`}
    >
      {children}
    </span>
  )
}
