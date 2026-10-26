import { Fragment, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, LockSimpleIcon, ScrollIcon } from '@phosphor-icons/react'
import { PageLoader } from '../components/PageLoader'
import { Button } from '../components/ui/Button'
import { FilterSelect, inputClass } from '../components/ui/Field'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui/Primitives'
import { api } from '../data'
import { useRefData } from '../data/RefDataProvider'
import {
  ACTIVITY_ACTIONS,
  type ActivityAction,
  type ActivityEntry,
  type ActivityFilters,
  type Profile,
} from '../data/types'
import { cn } from '../lib/cn'
import { formatPhone } from '../lib/phone'
import { formatDateTime } from '../lib/time'

const PAGE_SIZE = 30

const ACTION_LABELS: Record<ActivityAction, string> = {
  login: 'Signed in',
  logout: 'Signed out',
  failed_login: 'Failed sign-in',
  walk_in_created: 'Walk-in created',
  walk_in_edited: 'Walk-in edited',
  walk_in_deleted: 'Walk-in deleted',
  sales_person_added: 'Sales person added',
  sales_person_edited: 'Sales person edited',
  settings_changed: 'Settings changed',
  user_created: 'User created',
  user_updated: 'User updated',
  user_deactivated: 'User deactivated',
  password_reset: 'Password reset',
  data_exported: 'Data exported',
  notification_sent: 'Notification sent',
  notification_failed: 'Notification failed',
  notification_pending_setup: 'Notification pending setup',
}

const TONE: Partial<Record<ActivityAction, 'gold' | 'success' | 'warning' | 'danger'>> = {
  failed_login: 'danger',
  walk_in_deleted: 'danger',
  user_deactivated: 'danger',
  notification_failed: 'danger',
  walk_in_created: 'success',
  notification_sent: 'success',
  notification_pending_setup: 'warning',
  password_reset: 'warning',
  data_exported: 'gold',
  settings_changed: 'gold',
}

const humanKey = (k: string) =>
  k
    .replace(/_id$/, '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())

export function ActivityPage() {
  const ref = useRefData()
  const [filters, setFilters] = useState<ActivityFilters>({})
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<ActivityEntry[] | null>(null)
  const [total, setTotal] = useState(0)
  const [users, setUsers] = useState<Profile[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .listUsers()
      .then(setUsers)
      .catch(() => {})
  }, [])

  useEffect(() => setPage(0), [filters])

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    api
      .listActivity(filters, page, PAGE_SIZE)
      .then((res) => {
        if (cancelled) return
        setRows(res.rows)
        setTotal(res.total)
      })
      .catch(() => !cancelled && setRows((r) => r ?? []))
      .finally(() => !cancelled && setBusy(false))
    return () => {
      cancelled = true
    }
  }, [filters, page])

  // Show names instead of ids in before/after values.
  const display = (key: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    const id = String(value)
    if (key === 'project_id') return ref.project(id)?.name ?? id
    if (key === 'unit_type_id') return ref.unitType(id)?.name ?? id
    if (key === 'source_id') return ref.source(id)?.name ?? id
    if (key === 'sales_person_id') return ref.salesPerson(id)?.fullName ?? id
    if (key === 'phone' || key === 'whatsapp') return formatPhone(id)
    if (typeof value === 'object') return JSON.stringify(value)
    return id
  }

  const summary = (a: ActivityEntry) => {
    const v = { ...(a.oldValues ?? {}), ...(a.newValues ?? {}) }
    if (a.action === 'data_exported') return `${v.row_count ?? 0} rows · ${String(v.format ?? '').toUpperCase()}`
    if (a.action === 'failed_login') return `Tried “${v.identifier ?? ''}”`
    if (a.action.startsWith('notification_')) return `${String(v.channel ?? '')}${v.error ? ` · ${v.error}` : ''}`
    const label = v.full_name ?? v.name ?? v.reference
    return label ? String(label) : (a.entity ?? '')
  }

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min(total, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        eyebrow="Admin"
        title="Activity log"
        description="Every important action, recorded by the server. Entries cannot be edited or deleted."
        actions={
          <Badge tone="gold" className="px-3 py-1 text-xs">
            <LockSimpleIcon weight="bold" /> Read-only
          </Badge>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <FilterSelect
          aria-label="User"
          className="w-auto"
          value={filters.userId ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value || undefined }))}
        >
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          aria-label="Action"
          className="w-auto"
          value={filters.action ?? ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, action: (e.target.value || undefined) as ActivityAction | undefined }))
          }
        >
          <option value="">All actions</option>
          {ACTIVITY_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </FilterSelect>
        <input
          type="date"
          aria-label="From date"
          value={filters.from ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
          className={cn(inputClass, 'h-10 w-auto rounded-lg text-sm')}
        />
        <span className="text-muted">–</span>
        <input
          type="date"
          aria-label="To date"
          value={filters.to ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
          className={cn(inputClass, 'h-10 w-auto rounded-lg text-sm')}
        />
        {(filters.userId || filters.action || filters.from || filters.to) && (
          <Button size="sm" variant="ghost" onClick={() => setFilters({})}>
            Clear
          </Button>
        )}
      </div>

      <PageLoader loading={rows === null} label="Loading activity">
        <Card className={cn('overflow-hidden transition-opacity', busy && 'opacity-60')}>
          {rows && rows.length === 0 ? (
            <EmptyState
              icon={<ScrollIcon />}
              title="No activity matches"
              description="Try a wider date range or clear the filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] font-semibold tracking-wide text-muted uppercase">
                    <th className="w-8 px-3 py-3" aria-label="Expand" />
                    <th className="px-3 py-3">When</th>
                    <th className="px-3 py-3">User</th>
                    <th className="px-3 py-3">Action</th>
                    <th className="px-3 py-3">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {rows?.map((a) => {
                    const hasDiff = Boolean(a.oldValues || a.newValues)
                    const expanded = open === a.id
                    const keys = [
                      ...new Set([...Object.keys(a.oldValues ?? {}), ...Object.keys(a.newValues ?? {})]),
                    ].filter((k) => k !== 'filters')
                    return (
                      <Fragment key={a.id}>
                        <tr
                          className={cn('border-b border-line/70', hasDiff && 'cursor-pointer hover:bg-gold/[0.05]')}
                          onClick={() => hasDiff && setOpen(expanded ? null : a.id)}
                        >
                          <td className="px-3 py-3">
                            {hasDiff && (
                              <button
                                type="button"
                                aria-expanded={expanded}
                                aria-label={expanded ? 'Hide details' : 'Show details'}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpen(expanded ? null : a.id)
                                }}
                                className="rounded p-0.5 text-muted focus-ring"
                              >
                                <CaretDownIcon
                                  weight="bold"
                                  className={cn('size-4 transition-transform', expanded && 'rotate-180')}
                                />
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-fg tabular-nums">
                            {formatDateTime(a.createdAt)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-fg">
                            {a.userName ?? <span className="text-muted">System</span>}
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone={TONE[a.action] ?? 'neutral'}>{ACTION_LABELS[a.action] ?? a.action}</Badge>
                          </td>
                          <td className="max-w-[360px] truncate px-3 py-3 text-muted">{summary(a)}</td>
                        </tr>
                        <AnimatePresence initial={false}>
                          {expanded && (
                            <tr className="border-b border-line/70 bg-bg-sunken/50">
                              <td colSpan={5} className="p-0">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-12 py-4">
                                    <table className="w-full max-w-3xl text-[13px]">
                                      <thead>
                                        <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                                          <th className="py-1 pr-4 font-semibold">Field</th>
                                          <th className="py-1 pr-4 font-semibold">Before</th>
                                          <th className="py-1 font-semibold">After</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {keys.map((k) => (
                                          <tr key={k}>
                                            <td className="py-1 pr-4 text-muted">{humanKey(k)}</td>
                                            <td className="py-1 pr-4 text-fg/80 line-through decoration-rose/50">
                                              {a.oldValues && k in a.oldValues ? display(k, a.oldValues[k]) : ''}
                                            </td>
                                            <td className="py-1 font-semibold text-fg">
                                              {a.newValues && k in a.newValues ? display(k, a.newValues[k]) : ''}
                                            </td>
                                          </tr>
                                        ))}
                                        {a.newValues && 'filters' in a.newValues && (
                                          <tr>
                                            <td className="py-1 pr-4 text-muted">Filters</td>
                                            <td colSpan={2} className="py-1 font-mono text-xs text-fg/80">
                                              {JSON.stringify(a.newValues.filters)}
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
            <p className="text-muted">
              {from}–{to} of <span className="font-semibold text-fg">{total}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <CaretLeftIcon weight="bold" /> Prev
              </Button>
              <Button size="sm" variant="secondary" disabled={to >= total} onClick={() => setPage((p) => p + 1)}>
                Next <CaretRightIcon weight="bold" />
              </Button>
            </div>
          </div>
        </Card>
      </PageLoader>
    </div>
  )
}
