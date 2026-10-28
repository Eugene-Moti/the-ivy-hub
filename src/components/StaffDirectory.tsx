import { useMemo, useState } from 'react'
import { AddressBookIcon, CopyIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useRefData } from '../data/RefDataProvider'
import type { TeamMember } from '../data/types'
import { cn } from '../lib/cn'
import { formatPhone } from '../lib/phone'
import { ContactActions } from './ContactActions'
import { Button } from './ui/Button'
import { inputClass } from './ui/Field'
import { Modal } from './ui/Overlay'
import { Badge, Segmented } from './ui/Primitives'
import { useToast } from './ui/Toaster'

/** Opens the staff contact list (for reception to call or message someone by hand). */
export function StaffDirectoryButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Staff contacts"
          title="Staff contacts"
          className="grid size-10 place-items-center rounded-full border border-line text-muted focus-ring transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:text-fg"
        >
          <AddressBookIcon weight="bold" className="size-[18px]" />
        </button>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <AddressBookIcon weight="bold" /> Staff contacts
        </Button>
      )}
      <StaffDirectory open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function StaffDirectory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRefData()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | 'sales' | 'staff'>('all')

  const people = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return (ref.data?.team ?? [])
      .filter((p) => p.isActive)
      .filter((p) => (kind === 'all' ? true : kind === 'sales' ? p.isSalesPerson : !p.isSalesPerson))
      .filter(
        (p) =>
          !q ||
          `${p.fullName} ${p.title ?? ''} ${p.branch ?? ''} ${p.email}`.toLowerCase().includes(q) ||
          (digits.length >= 3 && p.phone.replace(/\D/g, '').includes(digits.replace(/^0/, '254'))),
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [ref.data?.team, query, kind])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Staff contacts"
      description="Call or message anyone on the team."
      size="lg"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, title, branch or number…"
            aria-label="Search staff"
            data-autofocus
            className={cn(inputClass, 'h-10 rounded-lg pl-10 text-sm')}
          />
        </div>
        <Segmented
          ariaLabel="Show"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'Everyone' },
            { value: 'sales', label: 'Sales' },
            { value: 'staff', label: 'Other staff' },
          ]}
        />
      </div>
      {people.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          Nobody matches. An admin can add people on the Team page.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {people.map((p) => (
            <ContactCard key={p.id} person={p} />
          ))}
        </ul>
      )}
    </Modal>
  )
}

function ContactCard({ person: p }: { person: TeamMember }) {
  const { toast } = useToast()
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: `${what} copied`, tone: 'success', durationMs: 2000 })
    } catch {
      toast({ title: 'Could not copy', tone: 'error' })
    }
  }
  return (
    <li className="rounded-xl border border-line bg-bg-elevated/70 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 text-xs font-bold text-ink-900">
          {p.fullName
            .split(' ')
            .map((s) => s[0])
            .slice(0, 2)
            .join('')}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold text-fg">
            {p.fullName}
            {p.isSalesPerson && <Badge tone="gold">Sales</Badge>}
          </p>
          <p className="truncate text-[13px] text-muted">{[p.title, p.branch].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      </div>
      <dl className="mt-3 space-y-1 text-[13px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted">Phone</dt>
          <dd className="flex items-center gap-1.5 font-semibold text-fg tabular-nums">
            {formatPhone(p.phone)}
            <button
              type="button"
              onClick={() => void copy(p.phone, 'Number')}
              aria-label={`Copy ${p.fullName}'s number`}
              className="rounded p-0.5 text-muted focus-ring hover:text-fg"
            >
              <CopyIcon className="size-3.5" />
            </button>
          </dd>
        </div>
        {p.whatsapp !== p.phone && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">WhatsApp</dt>
            <dd className="font-semibold text-fg tabular-nums">{formatPhone(p.whatsapp)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted">Email</dt>
          <dd className="truncate text-fg">{p.email}</dd>
        </div>
      </dl>
      <ContactActions name={p.fullName} phone={p.phone} whatsapp={p.whatsapp} email={p.email} className="mt-3" />
    </li>
  )
}
