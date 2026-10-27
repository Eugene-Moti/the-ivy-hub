import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  CaretLeftIcon,
  CaretRightIcon,
  DownloadSimpleIcon,
  FileCsvIcon,
  FileXlsIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  TableIcon,
  XCircleIcon,
} from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { PageLoader } from '../components/PageLoader'
import { exportWalkIns, type ExportFormat } from '../components/records/exportWalkIns'
import { WalkInDrawer } from '../components/records/WalkInDrawer'
import { SourceIcon } from '../components/SourceIcon'
import { Button } from '../components/ui/Button'
import { DynamicButton, useDynamicAction } from '../components/ui/DynamicButton'
import { FilterSelect, inputClass } from '../components/ui/Field'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui/Primitives'
import { useToast } from '../components/ui/Toaster'
import { api } from '../data'
import { useRefData } from '../data/RefDataProvider'
import type { VisitType, WalkIn, WalkInFilters } from '../data/types'
import { VISIT_TYPES, VisitTypeIcon, visitTypeLabel } from '../components/VisitType'
import { cn } from '../lib/cn'
import { formatPhone } from '../lib/phone'
import { addDays, formatDate, formatTime, startOfMonth, todayKey } from '../lib/time'
import { useSync } from '../offline/SyncProvider'

const PAGE_SIZE = 25

type Preset = 'all' | 'today' | '7d' | '30d' | 'month' | 'custom'
const PRESETS: { value: Preset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
]

function presetRange(p: Preset): { from?: string; to?: string } {
  const today = todayKey()
  switch (p) {
    case 'today':
      return { from: today, to: today }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case 'month':
      return { from: startOfMonth(today), to: today }
    default:
      return {}
  }
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

export function RecordsPage() {
  const { user } = useAuth()
  const ref = useRefData()
  const { online } = useSync()
  const { toast } = useToast()
  const reduce = useReducedMotion()
  const isAdmin = user?.role === 'admin'
  const canExport = isAdmin || ref.settings.receptionistCanExport

  const [search, setSearch] = useState('')
  const [preset, setPreset] = useState<Preset>('all')
  const [custom, setCustom] = useState<{ from?: string; to?: string }>({})
  const [projectId, setProjectId] = useState('')
  const [unitTypeId, setUnitTypeId] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [visitType, setVisitType] = useState<VisitType | ''>('')
  const [salesPersonId, setSalesPersonId] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(0)
  const debouncedSearch = useDebounced(search, 300)

  const filters: WalkInFilters = useMemo(() => {
    const range = preset === 'custom' ? custom : presetRange(preset)
    return {
      search: debouncedSearch || undefined,
      ...range,
      projectId: projectId || undefined,
      unitTypeId: unitTypeId || undefined,
      sourceId: sourceId || undefined,
      visitType: visitType || undefined,
      salesPersonId: salesPersonId || undefined,
      includeDeleted: isAdmin && includeDeleted,
    }
  }, [
    debouncedSearch,
    preset,
    custom,
    projectId,
    unitTypeId,
    sourceId,
    visitType,
    salesPersonId,
    includeDeleted,
    isAdmin,
  ])

  const [rows, setRows] = useState<WalkIn[]>([])
  const [total, setTotal] = useState(0)
  const [firstLoad, setFirstLoad] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [todayCount, setTodayCount] = useState<number | null>(null)
  const [selected, setSelected] = useState<WalkIn | null>(null)
  const [version, setVersion] = useState(0)
  const requestId = useRef(0)

  useEffect(() => setPage(0), [filters])

  useEffect(() => {
    const id = ++requestId.current
    setBusy(true)
    api
      .listWalkIns(filters, page, PAGE_SIZE)
      .then((res) => {
        if (id !== requestId.current) return
        setRows(res.rows)
        setTotal(res.total)
        setError(null)
      })
      .catch(
        (err) => id === requestId.current && setError(err instanceof Error ? err.message : 'Could not load records'),
      )
      .finally(() => {
        if (id !== requestId.current) return
        setBusy(false)
        setFirstLoad(false)
      })
  }, [filters, page, version, online])

  useEffect(() => {
    api
      .countToday()
      .then(setTodayCount)
      .catch(() => {})
  }, [version, online])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  const projects = ref.data?.projects ?? []
  const unitTypes = (ref.data?.unitTypes ?? []).filter((u) => !projectId || u.projectId === projectId)
  const sources = ref.data?.sources ?? []
  const team = [...(ref.data?.team ?? [])]
    .filter((m) => m.isSalesPerson)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
  const activeFilterCount = [
    visitType,
    projectId,
    unitTypeId,
    sourceId,
    salesPersonId,
    preset !== 'all' ? 'x' : '',
    includeDeleted ? 'x' : '',
  ].filter(Boolean).length

  const clearFilters = () => {
    setSearch('')
    setPreset('all')
    setCustom({})
    setProjectId('')
    setUnitTypeId('')
    setSourceId('')
    setVisitType('')
    setSalesPersonId('')
    setIncludeDeleted(false)
  }

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min(total, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        eyebrow="Walk-ins"
        title="Records"
        description="Every walk-in, newest first. Tap one for details."
        actions={
          <>
            <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2">
              <span className="text-xs font-semibold tracking-wide text-muted uppercase">Today</span>
              <motion.span
                key={todayCount}
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="font-display text-xl text-fg"
              >
                {todayCount ?? '–'}
              </motion.span>
            </div>
            {canExport && (
              <ExportButton
                filters={filters}
                total={total}
                onError={(m) => toast({ title: 'Export failed', description: m, tone: 'error' })}
              />
            )}
          </>
        }
      />

      <PageLoader loading={firstLoad} label="Loading records">
        <Card className="overflow-hidden">
          {/* Filters */}
          <div className="space-y-3 border-b border-line p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, phone or ref…"
                  aria-label="Search records"
                  className={cn(inputClass, 'h-11 rounded-lg pl-10 text-base sm:h-10 sm:text-sm')}
                />
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                aria-expanded={filtersOpen}
                aria-controls="records-filters"
                className={cn(
                  'relative grid size-11 shrink-0 place-items-center rounded-lg border focus-ring transition-colors md:hidden',
                  filtersOpen || activeFilterCount ? 'border-gold/60 bg-gold/10 text-link' : 'border-line text-muted',
                )}
                aria-label={`Filters${activeFilterCount ? ` (${activeFilterCount} on)` : ''}`}
              >
                <FunnelSimpleIcon weight={activeFilterCount ? 'fill' : 'bold'} className="size-5" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-gold text-[11px] font-bold text-ink-900">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <FilterSelect
                value={preset}
                onChange={(e) => setPreset(e.target.value as Preset)}
                aria-label="Date range"
                className={cn('w-full sm:w-auto', !filtersOpen && 'max-md:hidden')}
              >
                {PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </FilterSelect>
              {preset === 'custom' && (
                <div className={cn('flex w-full items-center gap-2 sm:w-auto', !filtersOpen && 'max-md:hidden')}>
                  <input
                    type="date"
                    aria-label="From date"
                    value={custom.from ?? ''}
                    max={custom.to}
                    onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value || undefined }))}
                    className={cn(inputClass, 'h-10 min-w-0 flex-1 rounded-lg text-sm sm:w-auto sm:flex-none')}
                  />
                  <span className="text-muted">–</span>
                  <input
                    type="date"
                    aria-label="To date"
                    value={custom.to ?? ''}
                    min={custom.from}
                    onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value || undefined }))}
                    className={cn(inputClass, 'h-10 min-w-0 flex-1 rounded-lg text-sm sm:w-auto sm:flex-none')}
                  />
                </div>
              )}
            </div>
            <div
              id="records-filters"
              className={cn(
                'grid grid-cols-2 items-center gap-2.5 md:flex md:flex-wrap',
                !filtersOpen && 'max-md:hidden',
              )}
            >
              <FunnelSimpleIcon weight="duotone" className="hidden size-5 text-gold md:block" />
              <FilterSelect
                value={visitType}
                onChange={(e) => setVisitType(e.target.value as VisitType | '')}
                aria-label="Visit type"
                className="w-full md:w-auto"
              >
                <option value="">All visits</option>
                {VISIT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value)
                  setUnitTypeId('')
                }}
                aria-label="Project"
                className="w-full md:w-auto"
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                value={unitTypeId}
                onChange={(e) => setUnitTypeId(e.target.value)}
                aria-label="Unit type"
                className="w-full md:w-auto"
              >
                <option value="">All unit types</option>
                {unitTypes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {projectId ? u.name : `${ref.project(u.projectId)?.name ?? ''} · ${u.name}`}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                aria-label="Source"
                className="w-full md:w-auto"
              >
                <option value="">All sources</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                value={salesPersonId}
                onChange={(e) => setSalesPersonId(e.target.value)}
                aria-label="Sales person"
                className="w-full md:w-auto"
              >
                <option value="">All sales persons</option>
                {team.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                    {s.isActive ? '' : ' (inactive)'}
                  </option>
                ))}
              </FilterSelect>
              {isAdmin && (
                <label className="col-span-2 flex cursor-pointer items-center gap-2 px-1 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={includeDeleted}
                    onChange={(e) => setIncludeDeleted(e.target.checked)}
                    className="accent-[#c99a30]"
                  />
                  Show deleted
                </label>
              )}
              {(activeFilterCount > 0 || search) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="col-span-2 md:col-span-1">
                  <XCircleIcon weight="bold" /> Clear filters
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className={cn('relative transition-opacity', busy && 'opacity-60')}>
            {busy && (
              <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-gradient-to-r from-transparent via-gold to-transparent" />
            )}
            {error ? (
              <EmptyState
                icon={<TableIcon />}
                title="Records could not load"
                description={online ? error : 'You are offline. Records will load when the connection returns.'}
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<TableIcon />}
                title="No walk-ins match"
                description="Try a different search or clear the filters."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <>
                {/* Phones: one card per visitor */}
                <ul className="divide-y divide-line md:hidden">
                  {rows.map((w, i) => (
                    <motion.li
                      key={w.id}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduce ? 0 : Math.min(i * 0.02, 0.3), duration: 0.25 }}
                    >
                      <WalkInCard walkIn={w} onOpen={() => setSelected(w)} />
                    </motion.li>
                  ))}
                </ul>

                {/* Tablets and up: table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-[11px] font-semibold tracking-wide text-muted uppercase">
                        {[
                          ['When', ''],
                          ['Visitor', ''],
                          ['Email', 'hidden 2xl:table-cell'],
                          ['Visit', ''],
                          ['Interest / here to see', ''],
                          ['Source', ''],
                          ['Sales person', ''],
                          ['Recorded by', 'hidden xl:table-cell'],
                        ].map(([h, cls]) => (
                          <th
                            key={h}
                            scope="col"
                            className={cn('px-4 py-3 font-semibold whitespace-nowrap first:pl-5', cls)}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false} mode="popLayout">
                        {rows.map((w, i) => {
                          const src = ref.source(w.sourceId)
                          return (
                            <motion.tr
                              key={w.id}
                              initial={reduce ? false : { opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: reduce ? 0 : Math.min(i * 0.018, 0.35), duration: 0.28 }}
                              tabIndex={0}
                              onClick={() => setSelected(w)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setSelected(w)
                                }
                              }}
                              className={cn(
                                'group cursor-pointer border-b border-line/70 transition-colors outline-none last:border-0 hover:bg-gold/[0.06] focus-visible:bg-gold/10',
                                w.deletedAt && 'opacity-55',
                              )}
                            >
                              <td className="px-4 py-3 pl-5 whitespace-nowrap">
                                <span className="font-semibold text-fg tabular-nums">{formatTime(w.visitedAt)}</span>
                                <span className="block text-xs text-muted">{formatDate(w.visitedAt)}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold text-fg group-hover:text-link">{w.fullName}</span>
                                  {w.isReturning && <Badge tone="gold">Returning</Badge>}
                                  {w.deletedAt && <Badge tone="danger">Deleted</Badge>}
                                </span>
                                <span className="block text-xs whitespace-nowrap text-muted tabular-nums">
                                  {formatPhone(w.phone)}
                                </span>
                              </td>
                              <td className="hidden max-w-[220px] truncate px-4 py-3 text-fg/80 2xl:table-cell">
                                {w.email ?? <span className="text-muted">—</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Badge tone={w.visitType === 'client' ? 'gold' : 'neutral'}>
                                  <VisitTypeIcon type={w.visitType} />
                                  {visitTypeLabel(w.visitType)}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-fg/90">
                                <InterestText walkIn={w} />
                              </td>
                              <td className="px-4 py-3">
                                {src ? (
                                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-fg/90">
                                    <SourceIcon icon={src.icon} className="size-4 text-gold" />
                                    {src.name}
                                  </span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-fg/90">
                                {ref.member(w.salesPersonId)?.fullName ?? <span className="text-muted">—</span>}
                              </td>
                              <td className="hidden px-4 py-3 whitespace-nowrap text-muted xl:table-cell">
                                {w.createdByName}
                              </td>
                            </motion.tr>
                          )
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm sm:px-5">
            <p className="text-muted">
              {from}–{to} of <span className="font-semibold text-fg">{total}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
              >
                <CaretLeftIcon weight="bold" /> <span className="max-sm:sr-only">Prev</span>
              </Button>
              <span className="px-2 text-muted tabular-nums">
                {page + 1} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={to >= total}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                <span className="max-sm:sr-only">Next</span> <CaretRightIcon weight="bold" />
              </Button>
            </div>
          </div>
        </Card>
      </PageLoader>

      <WalkInDrawer walkIn={selected} onClose={() => setSelected(null)} onChanged={refresh} />
    </div>
  )
}

/** Project and unit for clients; who they came to see for other visitors. */
function InterestText({ walkIn: w, inline = false }: { walkIn: WalkIn; inline?: boolean }) {
  const ref = useRefData()
  const [main, sub] =
    w.visitType === 'client'
      ? [ref.project(w.projectId)?.name, ref.unitType(w.unitTypeId)?.name]
      : [
          ref.member(w.hostId)?.fullName ?? w.hostName ?? undefined,
          [w.organisation, w.purpose].filter(Boolean).join(' · ') || undefined,
        ]
  if (inline) return <>{[main, sub].filter(Boolean).join(' · ') || '—'}</>
  return (
    <>
      <span className="whitespace-nowrap">{main ?? '—'}</span>
      {sub && <span className="block max-w-[220px] truncate text-xs text-muted">{sub}</span>}
    </>
  )
}

function WalkInCard({ walkIn: w, onOpen }: { walkIn: WalkIn; onOpen: () => void }) {
  const ref = useRefData()
  const src = ref.source(w.sourceId)
  const isClient = w.visitType === 'client'
  const salesPerson = ref.member(w.salesPersonId)?.fullName
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3.5 text-left focus-ring transition-colors active:bg-gold/[0.08]',
        w.deletedAt && 'opacity-55',
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl',
          isClient ? 'bg-gold/12 text-gold' : 'bg-fg/[0.06] text-muted',
        )}
      >
        {isClient && src ? (
          <SourceIcon icon={src.icon} className="size-5" />
        ) : (
          <VisitTypeIcon type={w.visitType} className="size-5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold text-fg">{w.fullName}</span>
          <span className="shrink-0 text-xs font-semibold text-muted tabular-nums">{formatTime(w.visitedAt)}</span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-fg/80">
          <InterestText walkIn={w} inline />
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span className="tabular-nums">{formatDate(w.visitedAt)}</span>
          <span aria-hidden>·</span>
          {isClient ? <span>{src?.name ?? '—'}</span> : <span>{visitTypeLabel(w.visitType)}</span>}
          {salesPerson && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{salesPerson}</span>
            </>
          )}
          {w.isReturning && <Badge tone="gold">Returning</Badge>}
          {w.deletedAt && <Badge tone="danger">Deleted</Badge>}
        </span>
      </span>
      <CaretRightIcon weight="bold" className="mt-3 size-4 shrink-0 text-muted/70" />
    </button>
  )
}

function ExportButton({
  filters,
  total,
  onError,
}: {
  filters: WalkInFilters
  total: number
  onError: (message?: string) => void
}) {
  const ref = useRefData()
  const action = useDynamicAction(2200)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const run = (format: ExportFormat) => {
    setOpen(false)
    action
      .run(async () => {
        const rows = await api.queryWalkIns(filters)
        if (!ref.data) throw new Error('Lists are still loading')
        await exportWalkIns(rows, ref.data, format, Boolean(filters.includeDeleted))
        await api.logExport({ format, filters, rowCount: rows.length })
      })
      .catch((err) => onError(err instanceof Error ? err.message : undefined))
  }

  return (
    <div ref={root} className="relative">
      <DynamicButton
        variant="primary"
        state={action.state}
        icon={<DownloadSimpleIcon weight="bold" />}
        labels={{ idle: 'Export', loading: 'Preparing…', success: 'Downloaded', error: 'Export failed' }}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={total === 0}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="absolute right-0 z-30 mt-2 w-64 origin-top-right rounded-xl border border-glass-line bg-bg-elevated p-1.5 shadow-card"
          >
            <p className="px-3 pt-2 pb-1 text-xs text-muted">
              {total} record{total === 1 ? '' : 's'} with the current filters
            </p>
            {(
              [
                ['csv', 'CSV (.csv)', <FileCsvIcon key="c" weight="duotone" />],
                ['xlsx', 'Excel (.xlsx)', <FileXlsIcon key="x" weight="duotone" />],
              ] as const
            ).map(([format, label, icon]) => (
              <button
                key={format}
                role="menuitem"
                type="button"
                onClick={() => run(format)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-fg focus-ring hover:bg-gold/10 [&_svg]:size-5 [&_svg]:text-gold"
              >
                {icon}
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
