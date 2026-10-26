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
import { TeamMemberFormModal } from '../components/walkin/TeamMemberFormModal'
import { api } from '../data'
import { useRefData } from '../data/RefDataProvider'
import type { TeamMember } from '../data/types'
import { cn } from '../lib/cn'
import { formatPhone } from '../lib/phone'

type StatusFilter = 'active' | 'inactive' | 'all'

export function TeamPage() {
  const ref = useRefData()
  const { toast } = useToast()
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [kind, setKind] = useState<'all' | 'sales' | 'staff'>('all')
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [adding, setAdding] = useState(false)

  const people = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...(ref.data?.team ?? [])]
      .filter((p) => (status === 'all' ? true : status === 'active' ? p.isActive : !p.isActive))
      .filter((p) => (kind === 'all' ? true : kind === 'sales' ? p.isSalesPerson : !p.isSalesPerson))
      .filter(
        (p) => !q || `${p.fullName} ${p.email} ${p.title ?? ''} ${p.branch ?? ''} ${p.phone}`.toLowerCase().includes(q),
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [ref.data?.team, query, status, kind])

  const setActive = async (p: TeamMember, isActive: boolean, refresh = true) => {
    try {
      await api.updateTeamMember(p.id, { isActive })
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
        title="Team"
        description="Sales persons and the staff visitors come to see. Everyone here can be notified when their visitor arrives; deactivated people stay in history."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <UserPlusIcon weight="bold" /> Add team member
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
            placeholder="Search by name, title, branch, phone…"
            aria-label="Search the team"
            className={cn(inputClass, 'h-10 rounded-lg pl-10 text-sm')}
          />
        </div>
        <Segmented
          ariaLabel="Role"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'Everyone' },
            { value: 'sales', label: 'Sales persons' },
            { value: 'staff', label: 'Other staff' },
          ]}
        />
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
            title="Nobody here yet"
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
                      <p className="truncate text-[13px] text-muted">
                        {[p.title, p.branch].filter(Boolean).join(' · ') || 'No title'}
                      </p>
                      {p.isSalesPerson && (
                        <Badge tone="gold" className="mt-1">
                          Sales
                        </Badge>
                      )}
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

      <TeamMemberFormModal open={adding} onClose={() => setAdding(false)} />
      <TeamMemberFormModal open={Boolean(editing)} person={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
