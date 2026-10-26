import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowCounterClockwiseIcon,
  EnvelopeSimpleIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PhoneIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersThreeIcon,
  WhatsappLogoIcon,
} from '@phosphor-icons/react'
import { Button } from '../components/ui/Button'
import { inputClass } from '../components/ui/Field'
import { HoldToConfirmButton } from '../components/ui/HoldToConfirmButton'
import { Badge, Card, EmptyState, PageHeader, Segmented } from '../components/ui/Primitives'
import { useToast } from '../components/ui/Toaster'
import { SalesPersonFormModal } from '../components/walkin/SalesPersonFormModal'
import { api } from '../data'
import { useRefData } from '../data/RefDataProvider'
import type { SalesPerson } from '../data/types'
import { cn } from '../lib/cn'
import { formatPhone } from '../lib/phone'

type StatusFilter = 'active' | 'inactive' | 'all'

export function SalesPersonsPage() {
  const ref = useRefData()
  const { toast } = useToast()
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [editing, setEditing] = useState<SalesPerson | null>(null)
  const [adding, setAdding] = useState(false)

  const people = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...(ref.data?.salesPersons ?? [])]
      .filter((p) => (status === 'all' ? true : status === 'active' ? p.isActive : !p.isActive))
      .filter((p) => !q || `${p.fullName} ${p.email} ${p.team ?? ''} ${p.phone}`.toLowerCase().includes(q))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [ref.data?.salesPersons, query, status])

  const setActive = async (p: SalesPerson, isActive: boolean, refresh = true) => {
    try {
      await api.updateSalesPerson(p.id, { isActive })
      if (refresh) await ref.refresh()
      if (isActive) toast({ title: `${p.fullName} reactivated`, tone: 'success' })
    } catch (err) {
      toast({ title: 'Could not update', description: err instanceof Error ? err.message : undefined, tone: 'error' })
      throw err
    }
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        eyebrow="Team"
        title="Sales persons"
        description="Everyone a walk-in can be assigned to. Deactivated people stay in history and reports."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <UserPlusIcon weight="bold" /> Add sales person
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, team, phone…"
            aria-label="Search sales persons"
            className={cn(inputClass, 'h-10 rounded-lg pl-10 text-sm')}
          />
        </div>
        <Segmented
          ariaLabel="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {people.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UsersThreeIcon />}
            title="No sales persons here"
            description="Try another search, or add someone new."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {people.map((p, i) => (
              <motion.div
                key={p.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: reduce ? 0 : Math.min(i * 0.03, 0.3) }}
              >
                <Card hover className={cn('flex h-full flex-col p-5', !p.isActive && 'opacity-70')}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 text-sm font-bold text-ink-900">
                      {p.fullName
                        .split(' ')
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-fg">{p.fullName}</p>
                      <p className="truncate text-[13px] text-muted">{p.team ?? 'No team'}</p>
                    </div>
                    {p.isActive ? (
                      p.createdAt.startsWith('local:') ? (
                        <Badge tone="warning">Waiting to sync</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )
                    ) : (
                      <Badge>Inactive</Badge>
                    )}
                  </div>
                  <ul className="mt-4 space-y-1.5 text-[13px] text-fg/85 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-gold">
                    <li className="flex items-center gap-2">
                      <PhoneIcon weight="duotone" /> {formatPhone(p.phone)}
                    </li>
                    <li className="flex items-center gap-2">
                      <WhatsappLogoIcon weight="duotone" /> {formatPhone(p.whatsapp)}
                    </li>
                    <li className="flex min-w-0 items-center gap-2">
                      <EnvelopeSimpleIcon weight="duotone" /> <span className="truncate">{p.email}</span>
                    </li>
                  </ul>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>
                      <PencilSimpleIcon weight="bold" /> Edit
                    </Button>
                    {p.isActive ? (
                      <HoldToConfirmButton
                        size="sm"
                        label="Hold to deactivate"
                        confirmedLabel="Deactivated"
                        icon={<UserMinusIcon weight="bold" />}
                        onConfirm={() => setActive(p, false, false)}
                        onSettled={() => void ref.refresh()}
                      />
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => void setActive(p, true).catch(() => {})}>
                        <ArrowCounterClockwiseIcon weight="bold" /> Reactivate
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <SalesPersonFormModal open={adding} onClose={() => setAdding(false)} />
      <SalesPersonFormModal open={Boolean(editing)} person={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
