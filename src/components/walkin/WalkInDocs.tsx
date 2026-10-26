import { CheckCircleIcon, EnvelopeSimpleIcon, WarningIcon, WhatsappLogoIcon } from '@phosphor-icons/react'
import { useRefData } from '../../data/RefDataProvider'
import type { WalkIn, WalkInNotification } from '../../data/types'
import { formatPhone } from '../../lib/phone'
import { formatDate, formatLongDate, formatTime } from '../../lib/time'
import { IvyLogo } from '../IvyLogo'
import { visitTypeLabel } from '../VisitType'
import { Ticket } from '../Ticket'

export interface WalkInLabels {
  isClient: boolean
  visitType: string
  project: string
  unitType: string
  source: string
  salesPerson: string | null
  /** Who a non-client visitor came to see */
  host: string | null
  /** The person notified on arrival: the sales person or the host */
  recipient: string | null
  /** One line for passes and lists: "Ivy Gardens · 2 Bedroom" or "Meeting · Daniel Mwangi" */
  summary: string
}

const EMPTY_LABELS: WalkInLabels = {
  isClient: true,
  visitType: '',
  project: '',
  unitType: '',
  source: '',
  salesPerson: null,
  host: null,
  recipient: null,
  summary: '',
}

export function useWalkInLabels(w: WalkIn | null | undefined): WalkInLabels {
  const ref = useRefData()
  if (!w) return EMPTY_LABELS
  const isClient = w.visitType === 'client'
  const source = ref.source(w.sourceId)
  const project = isClient ? (ref.project(w.projectId)?.name ?? 'Unknown project') : ''
  const unitType = isClient ? (ref.unitType(w.unitTypeId)?.name ?? 'Unknown unit') : ''
  const salesPerson = ref.member(w.salesPersonId)?.fullName ?? null
  const host = isClient ? null : (ref.member(w.hostId)?.fullName ?? w.hostName ?? null)
  return {
    isClient,
    visitType: visitTypeLabel(w.visitType),
    project,
    unitType,
    source: isClient
      ? source?.kind === 'other' && w.otherSourceText
        ? `Other: ${w.otherSourceText}`
        : (source?.name ?? 'Unknown')
      : '',
    salesPerson,
    host,
    recipient: isClient ? salesPerson : host,
    summary: isClient ? `${project} · ${unitType}` : [visitTypeLabel(w.visitType), host].filter(Boolean).join(' · '),
  }
}

export function summariseNotifications(list: WalkInNotification[] | null | undefined) {
  const items = list ?? []
  return {
    any: items.length > 0,
    allSent: items.length > 0 && items.every((n) => n.status === 'sent'),
    failed: items.filter((n) => n.status === 'failed').length,
    pendingSetup: items.some((n) => n.status === 'pending_setup'),
    inFlight: items.some((n) => n.status === 'queued'),
  }
}

/* ------------------------------------------------------------------ */
/* Walk-in slip (receipt paper)                                          */
/* ------------------------------------------------------------------ */

interface SlipProps {
  walkIn: WalkIn
  labels: WalkInLabels
  companyName: string
  notifications?: WalkInNotification[] | null
  queued?: boolean
}

export function WalkInSlip({ walkIn, labels, companyName, notifications, queued }: SlipProps) {
  const n = summariseNotifications(notifications)
  const rows: [string, string][] = [
    ['Visitor', walkIn.fullName],
    ['Phone', formatPhone(walkIn.phone)],
  ]
  if (labels.isClient) {
    rows.push(['Project', labels.project], ['Unit type', labels.unitType], ['Source', labels.source])
    if (labels.salesPerson) rows.push(['Sales person', labels.salesPerson])
  } else {
    rows.push(['Visit', labels.visitType])
    if (labels.host) rows.push(['Here to see', labels.host])
    if (walkIn.organisation) rows.push(['Organisation', walkIn.organisation])
    if (walkIn.purpose) rows.push(['Purpose', walkIn.purpose])
  }

  return (
    <div className="font-sans text-[13px] leading-relaxed">
      <div className="flex flex-col items-center text-center">
        <IvyLogo intro={false} shimmer={false} className="h-10 w-10 drop-shadow-none" />
        <p className="mt-2 text-[11px] font-bold tracking-[0.28em] uppercase">{companyName}</p>
        <p className="font-display text-lg leading-tight">Walk-in Slip</p>
      </div>
      <div className="my-4 border-t border-dashed border-ink-900/35" />
      <div className="flex justify-between text-[12px]">
        <span>{formatDate(walkIn.visitedAt)}</span>
        <span className="font-semibold tabular-nums">{formatTime(walkIn.visitedAt)} EAT</span>
      </div>
      <dl className="mt-3 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="shrink-0 text-ink-500">{k}</dt>
            <dd className="text-right font-semibold break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="my-4 border-t border-dashed border-ink-900/35" />
      <p className="text-center text-[12px] text-ink-500">Recorded by {walkIn.createdByName ?? 'reception'}</p>
      <p className="mt-1 text-center font-mono text-[13px] font-bold tracking-wider">{walkIn.reference}</p>
      {queued && <p className="mt-1 text-center text-[11px] text-ink-500">Provisional reference until synced</p>}
      {labels.recipient && n.allSent && (
        <p className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-emerald/15 px-2 py-1.5 text-[12px] font-semibold text-[#166c3b]">
          <CheckCircleIcon weight="fill" className="size-4" />
          Email &amp; WhatsApp sent to {labels.recipient}
        </p>
      )}
      {labels.recipient && !n.allSent && n.any && !n.inFlight && (
        <p className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-amber/15 px-2 py-1.5 text-[12px] font-semibold text-[#8a5a0a]">
          <WarningIcon weight="fill" className="size-4" />
          {n.pendingSetup ? `Notifications pending setup` : `Could not notify ${labels.recipient}`}
        </p>
      )}
    </div>
  )
}

/** Plain, high-contrast layout for the browser print dialog (80mm thermal-friendly). */
export function PrintableSlip(props: SlipProps) {
  return (
    <div style={{ width: '76mm', margin: '0 auto', color: '#000', fontFamily: 'var(--font-sans)' }}>
      <WalkInSlip {...props} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Visitor pass (ticket)                                                */
/* ------------------------------------------------------------------ */

export function VisitorPass({
  walkIn,
  labels,
  companyName,
  tilt = true,
}: {
  walkIn: WalkIn
  labels: WalkInLabels
  companyName: string
  tilt?: boolean
}) {
  return (
    <Ticket
      tilt={tilt}
      stub={
        <div className="flex h-full flex-col justify-between gap-4 text-ink-900">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-ink-900/60 uppercase">Date</p>
            <p className="text-sm font-semibold">{formatDate(walkIn.visitedAt)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-ink-900/60 uppercase">Time</p>
            <p className="text-sm font-semibold tabular-nums">{formatTime(walkIn.visitedAt)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-ink-900/60 uppercase">Ref</p>
            <p className="font-mono text-[11px] leading-tight font-bold break-all">{walkIn.reference}</p>
          </div>
        </div>
      }
    >
      <div className="flex h-full flex-col justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-ink-900 p-2 shadow-inner">
            <IvyLogo intro={false} shimmer={false} className="size-full drop-shadow-none" />
          </div>
          <div className="leading-tight">
            <p className="text-[10px] font-bold tracking-[0.24em] text-ink-900/70 uppercase">{companyName}</p>
            <p className="font-display text-base">Visitor Pass</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] text-ink-900/60 uppercase">Welcome</p>
          <p className="font-display text-[1.75rem] leading-tight break-words">{walkIn.fullName}</p>
          <p className="mt-1 text-[13px] font-medium text-ink-900/75">{labels.summary}</p>
        </div>
        <p className="text-[11px] font-medium text-ink-900/65">{formatLongDate(walkIn.visitedAt)}</p>
      </div>
    </Ticket>
  )
}

export function PrintableVisitorPass(props: { walkIn: WalkIn; labels: WalkInLabels; companyName: string }) {
  return (
    <div style={{ width: '150mm', margin: '0 auto' }}>
      <VisitorPass {...props} tilt={false} />
    </div>
  )
}

export function ChannelIcon({ channel, className }: { channel: 'email' | 'whatsapp'; className?: string }) {
  return channel === 'email' ? (
    <EnvelopeSimpleIcon weight="duotone" className={className} />
  ) : (
    <WhatsappLogoIcon weight="duotone" className={className} />
  )
}
