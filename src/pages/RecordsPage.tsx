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
import type { WalkIn, WalkInFilters } from '../data/types'
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
  const [salesPersonId, setSalesPersonId] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
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
      salesPersonId: salesPersonId || undefined,
      includeDeleted: isAdmin && includeDeleted,
    }
  }, [debouncedSearch, preset, custom, projectId, unitTypeId, sourceId, salesPersonId, includeDeleted, isAdmin])

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
  const salesPersons = [...(ref.data?.salesPersons ?? [])].sort((a, b) => a.fullName.localeCompare(b.fullName))
  const activeFilterCount = [
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
        description="Every walk-in, newest first. Click a row for details."
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
                  placeholder="Search name, phone, email or reference…"
                  aria-label="Search records"
                  className={cn(inputClass, 'h-10 rounded-lg pl-10 text-sm')}
                />
              </div>
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
                    value={custom.from ?? ''}
                    max={custom.to}
                    onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value || undefined }))}
                    className={cn(inputClass, 'h-10 w-auto rounded-lg text-sm')}
                  />
                  <span className="text-muted">–</span>
                  <input
                    type="date"
                    aria-label="To date"
                    value={custom.to ?? ''}
                    min={custom.from}
                    onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value || undefined }))}
                    className={cn(inputClass, 'h-10 w-auto rounded-lg text-sm')}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <FunnelSimpleIcon weight="duotone" className="size-5 text-gold" />
              <FilterSelect
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value)
                  setUnitTypeId('')
                }}
                aria-label="Project"
                className="w-auto"
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
                className="w-auto"
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
                className="w-auto"
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
                className="w-auto"
              >
                <option value="">All sales persons</option>
                {salesPersons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                    {s.isActive ? '' : ' (inactive)'}
                  </option>
                ))}
              </FilterSelect>
              {isAdmin && (
                <label className="flex cursor-pointer items-center gap-2 px-1 text-sm text-muted">
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
                <Button variant="ghost" size="sm" onClick={clearFilters}>
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-wide text-muted uppercase">
                      {[
                        'Date & time',
                        'Name',
                        'Phone',
                        'Email',
                        'Project',
                        'Unit type',
                        'Source',
                        'Sales person',
                        'Recorded by',
                      ].map((h) => (
                        <th key={h} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap first:pl-5">
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
                              'cursor-pointer border-b border-line/70 transition-colors outline-none last:border-0 hover:bg-gold/[0.06] focus-visible:bg-gold/10',
                              w.deletedAt && 'opacity-55',
                            )}
                          >
                            <td className="px-4 py-3 pl-5 whitespace-nowrap">
                              <span className="font-semibold text-fg tabular-nums">{formatTime(w.visitedAt)}</span>
                              <span className="block text-xs text-muted">{formatDate(w.visitedAt)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-fg">{w.fullName}</span>
                              <span className="mt-0.5 flex gap-1">
                                {w.isReturning && <Badge tone="gold">Returning</Badge>}
                                {w.deletedAt && <Badge tone="danger">Deleted</Badge>}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-fg/90 tabular-nums">
                              {formatPhone(w.phone)}
                            </td>
                            <td className="max-w-[200px] truncate px-4 py-3 text-fg/80">
                              {w.email ?? <span className="text-muted">—</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-fg/90">{ref.project(w.projectId)?.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-fg/90">
                              {ref.unitType(w.unitTypeId)?.name}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-fg/90">
                                <SourceIcon icon={src?.icon ?? 'dots'} className="size-4 text-gold" />
                                {src?.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-fg/90">
                              {ref.salesPerson(w.salesPersonId)?.fullName ?? <span className="text-muted">—</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-muted">{w.createdByName}</td>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
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
                <CaretLeftIcon weight="bold" /> Prev
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
                Next <CaretRightIcon weight="bold" />
              </Button>
            </div>
          </div>
        </Card>
      </PageLoader>

      <WalkInDrawer walkIn={selected} onClose={() => setSelected(null)} onChanged={refresh} />
    </div>
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
