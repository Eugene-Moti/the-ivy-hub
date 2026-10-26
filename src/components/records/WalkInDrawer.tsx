import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  ClockIcon,
  GearSixIcon,
  PencilSimpleIcon,
  PrinterIcon,
  TicketIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { useAuth } from '../../auth/AuthProvider'
import { api } from '../../data'
import { useRefData } from '../../data/RefDataProvider'
import type { WalkIn, WalkInNotification } from '../../data/types'
import { formatPhone } from '../../lib/phone'
import { formatDateTime, timeAgo } from '../../lib/time'
import { Button } from '../ui/Button'
import { DynamicButton, useDynamicAction } from '../ui/DynamicButton'
import { TextArea } from '../ui/Field'
import { HoldToConfirmButton } from '../ui/HoldToConfirmButton'
import { Drawer } from '../ui/Overlay'
import { Badge, usePrint } from '../ui/Primitives'
import { useToast } from '../ui/Toaster'
import { ChannelIcon, PrintableSlip, PrintableVisitorPass, useWalkInLabels, VisitorPass } from '../walkin/WalkInDocs'
import { EditWalkInModal } from './EditWalkInModal'

interface Props {
  walkIn: WalkIn | null
  onClose: () => void
  /** The record changed (edited / deleted / notification resent). */
  onChanged: () => void
}

export function WalkInDrawer({ walkIn, onClose, onChanged }: Props) {
  const { user } = useAuth()
  const ref = useRefData()
  const print = usePrint()
  const { toast } = useToast()
  const [current, setCurrent] = useState<WalkIn | null>(walkIn)
  const [notifications, setNotifications] = useState<WalkInNotification[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [reason, setReason] = useState('')

  // Keep the last record while the drawer animates closed.
  useEffect(() => {
    if (!walkIn) return
    setCurrent(walkIn)
    setReason('')
    setNotifications([])
  }, [walkIn])

  const w = current
  const labels = useWalkInLabels(w)
  const companyName = ref.settings.companyName

  // Load notification status; keep polling briefly while a send is still queued.
  useEffect(() => {
    if (!w?.salesPersonId) return
    let cancelled = false
    let tries = 0
    const load = async () => {
      try {
        const list = await api.listNotifications(w.id)
        if (cancelled) return
        setNotifications(list)
        if (list.some((n) => n.status === 'queued') && tries++ < 6) window.setTimeout(load, 2500)
      } catch {
        /* offline: leave as is */
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [w?.id, w?.salesPersonId])

  const canEdit = useMemo(() => {
    if (!w || !user || w.deletedAt) return false
    if (user.role === 'admin') return true
    const ageHours = (Date.now() - new Date(w.createdAt).getTime()) / 3600_000
    return w.createdBy === user.id && ageHours <= ref.settings.editWindowHours
  }, [w, user, ref.settings.editWindowHours])

  if (!w) return <Drawer open={false} onClose={onClose} title="" children={null} />

  const details: [string, ReactNode][] = [
    ['Visited', formatDateTime(w.visitedAt)],
    [
      'Phone',
      <span className="flex flex-wrap gap-x-3">
        <a className="text-link hover:underline" href={`tel:${w.phone}`}>
          {formatPhone(w.phone)}
        </a>
        <a
          className="text-link hover:underline"
          href={`https://wa.me/${w.phone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </a>
      </span>,
    ],
    [
      'Email',
      w.email ? (
        <a className="text-link hover:underline" href={`mailto:${w.email}`}>
          {w.email}
        </a>
      ) : (
        '—'
      ),
    ],
    ['Project', labels.project],
    ['Unit type', labels.unitType],
    ['Source', labels.source],
    ['Sales person', labels.salesPerson ?? '—'],
    ['Recorded by', w.createdByName ?? '—'],
    ['Reference', <span className="font-mono">{w.reference}</span>],
    ['Consent', w.consent ? 'Given' : 'Not recorded'],
  ]

  return (
    <>
      <Drawer
        open={Boolean(walkIn)}
        onClose={onClose}
        title={w.fullName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {formatDateTime(w.visitedAt)}
            {w.isReturning && <Badge tone="gold">Returning</Badge>}
            {w.deletedAt && <Badge tone="danger">Deleted</Badge>}
          </span>
        }
        footer={
          <>
            {canEdit && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <PencilSimpleIcon weight="bold" /> Edit
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() =>
                print(
                  <PrintableSlip walkIn={w} labels={labels} companyName={companyName} notifications={notifications} />,
                )
              }
            >
              <PrinterIcon weight="bold" /> Print slip
            </Button>
            <Button
              variant="ghost"
              onClick={() => print(<PrintableVisitorPass walkIn={w} labels={labels} companyName={companyName} />)}
            >
              <TicketIcon weight="bold" /> Print pass
            </Button>
          </>
        }
      >
        <div className="space-y-7">
          <VisitorPass walkIn={w} labels={labels} companyName={companyName} />

          {w.deletedAt && (
            <div className="rounded-xl border border-rose/30 bg-rose/10 p-4 text-sm text-fg">
              <p className="font-semibold">Deleted {timeAgo(w.deletedAt)}</p>
              <p className="mt-0.5 text-muted">Reason: {w.deleteReason}</p>
            </div>
          )}

          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {details.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">{k}</dt>
                <dd className="mt-0.5 text-sm break-words text-fg">{v}</dd>
              </div>
            ))}
            {w.notes && (
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">Notes</dt>
                <dd className="mt-0.5 rounded-lg bg-bg-sunken/70 p-3 text-sm whitespace-pre-wrap text-fg">{w.notes}</dd>
              </div>
            )}
          </dl>

          {w.salesPersonId && (
            <section>
              <h3 className="mb-3 font-display text-lg text-fg">Sales-person notifications</h3>
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {notifications.length === 0 && (
                  <p className="p-4 text-sm text-muted">No notifications recorded for this walk-in.</p>
                )}
                {notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onUpdated={(next) => {
                      setNotifications((list) => list.map((x) => (x.id === next.id ? next : x)))
                      onChanged()
                    }}
                    onError={(msg) => toast({ title: 'Resend failed', description: msg, tone: 'error' })}
                  />
                ))}
              </div>
            </section>
          )}

          {user?.role === 'admin' && !w.deletedAt && (
            <section className="rounded-xl border border-line p-4">
              <h3 className="font-display text-lg text-fg">Delete record</h3>
              <p className="mt-0.5 mb-3 text-[13px] text-muted">
                The record is hidden from reports but kept for the audit trail. A reason is required.
              </p>
              <TextArea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Duplicate entry, test record…"
                aria-label="Reason for deleting"
              />
              <HoldToConfirmButton
                className="mt-3 w-full sm:w-auto"
                label="Hold to delete"
                confirmedLabel="Deleted"
                disabled={reason.trim().length < 3}
                onConfirm={async () => {
                  try {
                    await api.deleteWalkIn(w.id, reason)
                  } catch (err) {
                    toast({
                      title: 'Could not delete',
                      description: err instanceof Error ? err.message : undefined,
                      tone: 'error',
                    })
                    throw err
                  }
                }}
                onSettled={() => {
                  toast({ title: 'Walk-in deleted', description: `${w.fullName} · ${w.reference}`, tone: 'success' })
                  onChanged()
                  onClose()
                }}
              />
            </section>
          )}
        </div>
      </Drawer>

      <EditWalkInModal
        walkIn={editOpen ? w : null}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setCurrent(updated)
          onChanged()
        }}
      />
    </>
  )
}

const STATUS: Record<
  WalkInNotification['status'],
  { tone: 'success' | 'danger' | 'warning' | 'neutral'; icon: ReactNode; text: string }
> = {
  sent: { tone: 'success', icon: <CheckCircleIcon weight="fill" />, text: 'sent' },
  failed: { tone: 'danger', icon: <WarningCircleIcon weight="fill" />, text: 'failed' },
  pending_setup: { tone: 'warning', icon: <GearSixIcon weight="fill" />, text: 'pending setup' },
  queued: { tone: 'neutral', icon: <ClockIcon weight="fill" />, text: 'sending…' },
}

function NotificationRow({
  notification: n,
  onUpdated,
  onError,
}: {
  notification: WalkInNotification
  onUpdated: (n: WalkInNotification) => void
  onError: (message?: string) => void
}) {
  const action = useDynamicAction()
  const s = STATUS[n.status]
  const label = n.channel === 'email' ? 'Email' : 'WhatsApp'
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <span className="grid size-9 place-items-center rounded-lg bg-gold/10 text-gold">
        <ChannelIcon channel={n.channel} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-fg">
          {label}
          <Badge tone={s.tone}>
            {s.icon}
            {label} {s.text}
          </Badge>
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {n.status === 'sent' && n.sentAt
            ? `Delivered to provider ${timeAgo(n.sentAt)}`
            : (n.error ?? (n.status === 'queued' ? 'Waiting for the server…' : ''))}
          {n.attempts > 1 && ` · ${n.attempts} attempts`}
        </p>
      </div>
      {n.status !== 'queued' && (
        <DynamicButton
          size="sm"
          variant="secondary"
          state={action.state}
          icon={<ArrowsClockwiseIcon weight="bold" />}
          labels={{ idle: 'Resend', loading: 'Sending…', success: 'Sent', error: 'Failed' }}
          onClick={() =>
            action
              .run(async () => {
                const next = await api.resendNotification(n.id)
                onUpdated(next)
                if (next.status !== 'sent') throw new Error(next.error ?? 'Not sent')
              })
              .catch((err) => onError(err instanceof Error ? err.message : undefined))
          }
        />
      )}
    </div>
  )
}
