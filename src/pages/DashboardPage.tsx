import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useReducedMotion } from 'motion/react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRightIcon, ArrowUpRightIcon, ChartBarIcon, MinusIcon, TableIcon } from '@phosphor-icons/react'
import {
  bySource,
  byProjectUnit,
  clientsOnly,
  dailyTrend,
  heatmap,
  inRange,
  kpis,
  otherVisits,
  topSalesPersons,
} from '../components/dashboard/aggregate'
import { visitTypeLabel } from '../components/VisitType'
import { rampColor, useChartTheme } from '../components/dashboard/chartTheme'
import { PageLoader } from '../components/PageLoader'
import { FilterSelect, inputClass } from '../components/ui/Field'
import { Card, PageHeader, Segmented } from '../components/ui/Primitives'
import { api } from '../data'
import { useRefData } from '../data/RefDataProvider'
import type { VisitType, WalkIn } from '../data/types'
import { cn } from '../lib/cn'
import { addDays, formatDayMonth, formatLongDate, eatDayStart, startOfMonth, todayKey } from '../lib/time'
import { useSync } from '../offline/SyncProvider'

type Preset = '7d' | '30d' | '90d' | 'month' | 'custom'
const PRESETS: { value: Preset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
]
const WEEKDAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function rangeFor(preset: Preset, custom: { from: string; to: string }) {
  const today = todayKey()
  if (preset === '7d') return { from: addDays(today, -6), to: today }
  if (preset === '30d') return { from: addDays(today, -29), to: today }
  if (preset === '90d') return { from: addDays(today, -89), to: today }
  if (preset === 'month') return { from: startOfMonth(today), to: today }
  return custom
}

export function DashboardPage() {
  const ref = useRefData()
  const { online } = useSync()
  const [preset, setPreset] = useState<Preset>('30d')
  const [custom, setCustom] = useState(() => ({ from: addDays(todayKey(), -29), to: todayKey() }))
  const range = rangeFor(preset, custom)
  const [rows, setRows] = useState<WalkIn[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // One fetch covers the KPI periods (back to the start of last month) and the chosen range.
  const today = todayKey()
  const fetchFrom = [range.from, startOfMonth(addDays(startOfMonth(today), -1)), addDays(today, -14)].sort()[0]
  useEffect(() => {
    let cancelled = false
    setFetching(true)
    api
      .queryWalkIns({ from: fetchFrom, to: today })
      .then((r) => !cancelled && (setRows(r), setError(null)))
      .catch(
        (err) =>
          !cancelled && (setError(err instanceof Error ? err.message : 'Could not load data'), setRows((x) => x ?? [])),
      )
      .finally(() => !cancelled && setFetching(false))
    return () => {
      cancelled = true
    }
  }, [fetchFrom, today, online])

  const data = ref.data
  const view = useMemo(() => {
    if (!rows || !data) return null
    // Marketing numbers count clients only; other visitors get their own card. The busiest-hours
    // heatmap uses everyone, since it is about how busy reception is.
    const everyone = inRange(rows, range.from, range.to)
    const clients = clientsOnly(everyone)
    return {
      total: clients.length,
      visitors: otherVisits(everyone),
      k: kpis(clientsOnly(rows), today),
      sources: bySource(clients, data),
      projects: byProjectUnit(clients, data),
      sales: topSalesPersons(clients, data),
      trend: dailyTrend(clients, range.from, range.to, ref.settings),
      heat: heatmap(everyone, ref.settings),
    }
  }, [rows, data, range.from, range.to, today, ref.settings])

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        eyebrow="Marketing"
        title="Dashboard"
        description="Which channels bring people through the door, and who they came to see."
      />

      {/* One filter row scopes every chart below */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <FilterSelect
          value={preset}
          onChange={(e) => setPreset(e.target.value as Preset)}
          aria-label="Date range"
          className="w-auto"
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </FilterSelect>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="From date"
              value={custom.from}
              max={custom.to}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
              className={cn(inputClass, 'h-10 w-auto rounded-lg text-sm')}
            />
            <span className="text-muted">–</span>
            <input
              type="date"
              aria-label="To date"
              value={custom.to}
              min={custom.from}
              max={today}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
              className={cn(inputClass, 'h-10 w-auto rounded-lg text-sm')}
            />
          </div>
        )}
        <span className="text-sm text-muted">
          {formatDayMonth(eatDayStart(range.from))} – {formatDayMonth(eatDayStart(range.to))}
          {view && (
            <>
              {' · '}
              <span className="font-semibold text-fg">{view.total}</span> client walk-ins
            </>
          )}
        </span>
        {error && <span className="text-sm text-rose">{online ? error : 'Offline: showing what was last loaded'}</span>}
      </div>

      <PageLoader loading={!view} label="Loading dashboard">
        {view && (
          <div className={cn('space-y-6 transition-opacity', fetching && 'opacity-70')}>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile
                label="Client walk-ins today"
                value={view.k.today.value}
                previous={view.k.today.previous}
                versus="vs this time last week"
              />
              <StatTile
                label="This week"
                value={view.k.week.value}
                previous={view.k.week.previous}
                versus="vs this point last week"
              />
              <StatTile
                label="This month"
                value={view.k.month.value}
                previous={view.k.month.previous}
                versus="vs same point last month"
              />
            </div>

            <TrendCard data={view.trend} />

            <div className="grid gap-6 lg:grid-cols-2">
              <SourcesCard slices={view.sources.slices} all={view.sources.all} total={view.total} />
              <ProjectsCard groups={view.projects} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SalesCard rows={view.sales} />
              <VisitorsCard rows={view.visitors} />
            </div>

            <HeatmapCard heat={view.heat} />
          </div>
        )}
      </PageLoader>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                      */
/* ------------------------------------------------------------------ */

function useCountUp(value: number) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? value : 0)
  const from = useRef(0)
  useEffect(() => {
    if (reduce) {
      setN(value)
      return
    }
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setN(Math.round(v)),
    })
    from.current = value
    return () => controls.stop()
  }, [value, reduce])
  return n
}

function StatTile({
  label,
  value,
  previous,
  versus,
}: {
  label: string
  value: number
  previous: number
  versus: string
}) {
  const shown = useCountUp(value)
  const diff = value - previous
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : null
  const tone = diff > 0 ? 'text-[#1f8f4f] dark:text-emerald' : diff < 0 ? 'text-rose dark:text-[#e08a80]' : 'text-muted'
  const Icon = diff > 0 ? ArrowUpRightIcon : diff < 0 ? ArrowDownRightIcon : MinusIcon
  return (
    <Card hover className="relative overflow-hidden p-5">
      <div aria-hidden className="absolute -top-12 -right-8 size-32 rounded-full bg-gold/12 blur-2xl" />
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className="mt-1 text-[2.6rem] leading-none font-semibold tracking-tight text-fg">{shown.toLocaleString()}</p>
      <p className={cn('mt-3 flex items-center gap-1 text-[13px] font-semibold', tone)}>
        <Icon weight="bold" className="size-4" aria-hidden />
        <span>
          {diff > 0 ? '+' : ''}
          {diff}
          {pct !== null && ` (${pct > 0 ? '+' : ''}${pct}%)`}
        </span>
        <span className="font-normal text-muted">{versus}</span>
      </p>
    </Card>
  )
}

function ChartCard({
  title,
  subtitle,
  table,
  children,
  className,
}: {
  title: string
  subtitle?: ReactNode
  /** Accessible twin of the chart: [header, ...rows] */
  table: (string | number)[][]
  children: ReactNode
  className?: string
}) {
  const [mode, setMode] = useState<'chart' | 'table'>('chart')
  const [header, ...body] = table
  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-fg">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        <Segmented
          ariaLabel={`${title} view`}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'chart', label: <ChartBarIcon weight="bold" aria-label="Chart" /> },
            { value: 'table', label: <TableIcon weight="bold" aria-label="Table" /> },
          ]}
        />
      </div>
      {mode === 'chart' ? (
        children
      ) : (
        <div className="max-h-80 overflow-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bg-elevated">
              <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                {header.map((h, i) => (
                  <th key={i} className={cn('px-3 py-2 font-semibold', i > 0 && 'text-right')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, i) => (
                <tr key={i} className="border-b border-line/60 last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className={cn('px-3 py-2 text-fg', j > 0 && 'text-right tabular-nums')}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function TooltipBox({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-glass-line bg-bg-elevated/95 px-3 py-2 text-[13px] shadow-card backdrop-blur">
      <p className="font-semibold text-fg">{title}</p>
      <div className="text-muted">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Charts                                                               */
/* ------------------------------------------------------------------ */

function TrendCard({ data }: { data: { day: string; value: number }[] }) {
  const t = useChartTheme()
  const peak = data.reduce((m, d) => (d.value > m.value ? d : m), { day: '', value: 0 })
  return (
    <ChartCard
      title="Daily walk-ins"
      subtitle={
        peak.value ? `Busiest day: ${formatLongDate(eatDayStart(peak.day))} (${peak.value})` : 'Working days only'
      }
      table={[['Date', 'Walk-ins'], ...data.map((d) => [formatDayMonth(eatDayStart(d.day)), d.value])]}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.series} stopOpacity={0.22} />
                <stop offset="100%" stopColor={t.series} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={t.grid} />
            <XAxis
              dataKey="day"
              tickFormatter={(d: string) => formatDayMonth(eatDayStart(d))}
              tick={{ fill: t.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: t.grid }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: t.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: t.axis, strokeWidth: 1 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox title={formatLongDate(eatDayStart(String(payload[0].payload.day)))}>
                    {payload[0].value} walk-ins
                  </TooltipBox>
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={t.series}
              strokeWidth={2}
              fill="url(#trendFill)"
              activeDot={{ r: 5, stroke: t.surface, strokeWidth: 2, fill: t.series }}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

function SourcesCard({
  slices,
  all,
  total,
}: {
  slices: { id: string; name: string; value: number }[]
  all: { name: string; value: number }[]
  total: number
}) {
  const t = useChartTheme()
  const color = (i: number, id: string) => (id === 'other' ? t.other : (t.categorical[i] ?? t.other))
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0)
  return (
    <ChartCard
      title="Walk-ins by source"
      subtitle="Top five channels; the rest are grouped together"
      table={[['Source', 'Walk-ins', 'Share'], ...all.map((s) => [s.name, s.value, `${pct(s.value)}%`])]}
    >
      {total === 0 ? (
        <EmptyChart />
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative size-52 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="100%"
                  stroke={t.surface}
                  strokeWidth={2}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive
                >
                  {slices.map((s, i) => (
                    <Cell key={s.id} fill={color(i, s.id)} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <TooltipBox title={String(payload[0].name)}>
                        {payload[0].value} walk-ins · {pct(Number(payload[0].value))}%
                      </TooltipBox>
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-3xl font-semibold text-fg">{total}</p>
                <p className="text-xs text-muted">walk-ins</p>
              </div>
            </div>
          </div>
          {/* Legend doubles as direct labels */}
          <ul className="w-full space-y-2">
            {slices.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span className="size-3 shrink-0 rounded-[4px]" style={{ background: color(i, s.id) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-fg">{s.name}</span>
                <span className="font-semibold text-fg tabular-nums">{s.value}</span>
                <span className="w-10 text-right text-muted tabular-nums">{pct(s.value)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  )
}

function HBar({
  label,
  sub,
  value,
  max,
  color,
  total,
}: {
  label: string
  sub?: string | null
  value: number
  max: number
  color: string
  total: number
}) {
  const reduce = useReducedMotion()
  const share = total ? Math.round((value / total) * 100) : 0
  return (
    <li
      className="group relative grid grid-cols-[minmax(0,9.5rem)_1fr] items-center gap-3"
      tabIndex={0}
      aria-label={`${label}: ${value} walk-ins, ${share}%`}
    >
      <span className="min-w-0 text-[13px] leading-tight">
        <span className="block truncate text-fg">{label}</span>
        {sub && <span className="block truncate text-[11px] text-muted">{sub}</span>}
      </span>
      <span className="flex items-center gap-2">
        <motion.span
          className="h-3 rounded-r-[4px]"
          style={{ background: color, minWidth: 3 }}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${max ? (value / max) * 85 : 0}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
        <span className="text-[13px] font-semibold text-fg tabular-nums">{value}</span>
      </span>
      <span className="pointer-events-none absolute -top-8 left-40 z-10 hidden rounded-md border border-glass-line bg-bg-elevated px-2 py-1 text-xs whitespace-nowrap text-fg shadow-card group-hover:block group-focus-visible:block">
        {value} walk-ins · {share}% of range
      </span>
    </li>
  )
}

function ProjectsCard({
  groups,
}: {
  groups: { id: string; name: string; total: number; units: { id: string; name: string; value: number }[] }[]
}) {
  const t = useChartTheme()
  const max = Math.max(0, ...groups.flatMap((g) => g.units.map((u) => u.value)))
  const total = groups.reduce((s, g) => s + g.total, 0)
  return (
    <ChartCard
      title="Walk-ins by project and unit type"
      subtitle="Grouped by project, most popular first"
      table={[
        ['Project · Unit type', 'Walk-ins'],
        ...groups.flatMap((g) => g.units.map((u) => [`${g.name} · ${u.name}`, u.value])),
      ]}
    >
      {total === 0 ? (
        <EmptyChart />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.id}>
              <p className="mb-2 flex items-baseline justify-between text-sm">
                <span className="font-semibold text-fg">{g.name}</span>
                <span className="text-muted tabular-nums">{g.total} total</span>
              </p>
              <ul className="space-y-2">
                {g.units.map((u) => (
                  <HBar key={u.id} label={u.name} value={u.value} max={max} color={t.series} total={total} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  )
}

function SalesCard({ rows }: { rows: { id: string; name: string; branch: string | null; value: number }[] }) {
  const t = useChartTheme()
  const max = Math.max(0, ...rows.map((r) => r.value))
  const total = rows.reduce((s, r) => s + r.value, 0)
  return (
    <ChartCard
      title="Top sales persons"
      subtitle="Walk-ins who came to see a named sales person"
      table={[['Sales person', 'Walk-ins'], ...rows.map((r) => [r.name, r.value])]}
    >
      {rows.length === 0 ? (
        <EmptyChart />
      ) : (
        <ol className="space-y-3">
          {rows.map((r) => (
            <HBar key={r.id} label={r.name} sub={r.branch} value={r.value} max={max} color={t.series} total={total} />
          ))}
        </ol>
      )}
    </ChartCard>
  )
}

function VisitorsCard({ rows }: { rows: { type: VisitType; value: number }[] }) {
  const t = useChartTheme()
  const max = Math.max(0, ...rows.map((r) => r.value))
  const total = rows.reduce((s, r) => s + r.value, 0)
  return (
    <ChartCard
      title="Other visitors"
      subtitle={`${total} non-client visit${total === 1 ? '' : 's'}: not counted in the marketing figures`}
      table={[['Reason', 'Visits'], ...rows.map((r) => [visitTypeLabel(r.type), r.value])]}
    >
      {rows.length === 0 ? (
        <EmptyChart />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <HBar
              key={r.type}
              label={visitTypeLabel(r.type)}
              value={r.value}
              max={max}
              color={t.series}
              total={total}
            />
          ))}
        </ul>
      )}
    </ChartCard>
  )
}

function HeatmapCard({ heat }: { heat: ReturnType<typeof heatmap> }) {
  const t = useChartTheme()
  const [hover, setHover] = useState<string | null>(null)
  return (
    <ChartCard
      title="Busiest days and hours"
      subtitle={
        heat.outside
          ? `All visitors, office hours only · ${heat.outside} walk-in${heat.outside === 1 ? '' : 's'} outside hours not shown`
          : 'All visitors, office hours only'
      }
      table={[
        ['Day', ...heat.hours.map((h) => `${String(h).padStart(2, '0')}:00`)],
        ...heat.days.map((d) => [WEEKDAYS[d], ...heat.hours.map((h) => heat.cells.get(`${d}-${h}`) ?? 0)]),
      ]}
    >
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[440px] gap-1"
          style={{ gridTemplateColumns: `3rem repeat(${heat.hours.length}, minmax(0,1fr))` }}
        >
          <span />
          {heat.hours.map((h) => (
            <span key={h} className="pb-1 text-center text-[11px] text-muted tabular-nums">
              {String(h).padStart(2, '0')}
            </span>
          ))}
          {heat.days.map((d) => (
            <div key={d} className="contents">
              <span className="flex items-center text-[12px] font-semibold text-muted">{WEEKDAYS[d]}</span>
              {heat.hours.map((h) => {
                const key = `${d}-${h}`
                const v = heat.cells.get(key) ?? 0
                const fill = rampColor(t.sequential, v, heat.max)
                return (
                  <span
                    key={key}
                    tabIndex={0}
                    onMouseEnter={() => setHover(key)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(key)}
                    onBlur={() => setHover(null)}
                    aria-label={`${WEEKDAYS[d]} ${h}:00 to ${h + 1}:00, ${v} walk-ins`}
                    className="relative aspect-[1.6] rounded-[5px] outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    style={{ background: fill ?? t.empty }}
                  >
                    {hover === key && (
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-md border border-glass-line bg-bg-elevated px-2 py-1 text-xs whitespace-nowrap text-fg shadow-card">
                        {WEEKDAYS[d]} {String(h).padStart(2, '0')}:00–{String(h + 1).padStart(2, '0')}:00 · {v}
                      </span>
                    )}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-muted">
        Fewer
        {t.sequential.map((c) => (
          <span key={c} className="h-2.5 w-5 rounded-sm" style={{ background: c }} />
        ))}
        More
      </div>
    </ChartCard>
  )
}

function EmptyChart() {
  return <p className="py-14 text-center text-sm text-muted">No walk-ins in this range.</p>
}
