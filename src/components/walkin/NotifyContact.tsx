import { CopyIcon, PhoneIcon, WhatsappLogoIcon } from '@phosphor-icons/react'
import { useRefData } from '../../data/RefDataProvider'
import type { WalkIn } from '../../data/types'
import { cn } from '../../lib/cn'
import { formatPhone } from '../../lib/phone'
import { arrivalMessage, whatsappAnchor } from '../../lib/whatsapp'
import { buttonBase, buttonSizes, buttonVariants } from '../ui/Button'
import { useToast } from '../ui/Toaster'
import type { WalkInLabels } from './WalkInDocs'

/**
 * Manual way to tell the sales person / host: opens WhatsApp with the arrival message already
 * written, or rings them from the receptionist's phone. Works with or without automatic notifications.
 */
export function NotifyContact({
  walkIn,
  labels,
  className,
}: {
  walkIn: WalkIn
  labels: WalkInLabels
  className?: string
}) {
  const ref = useRefData()
  const { toast } = useToast()
  const member = ref.member(labels.isClient ? walkIn.salesPersonId : walkIn.hostId)
  const message = arrivalMessage({
    isClient: labels.isClient,
    recipientName: member?.fullName ?? labels.recipient,
    visitorName: walkIn.fullName,
    visitorPhone: walkIn.phone,
    visitedAt: walkIn.visitedAt,
    about: labels.isClient
      ? `${labels.project} – ${labels.unitType}`
      : [walkIn.organisation, walkIn.purpose].filter(Boolean).join(' · '),
  })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      toast({ title: 'Message copied', tone: 'success', durationMs: 2000 })
    } catch {
      toast({ title: 'Could not copy', description: 'Select the message and copy it manually.', tone: 'error' })
    }
  }

  const who = member?.fullName ?? labels.recipient
  const link = cn(buttonBase, buttonSizes.md)

  return (
    <div className={cn('rounded-xl border border-line bg-bg-sunken/60 p-4', className)}>
      <p className="text-sm font-semibold text-fg">{who ? `Let ${who} know` : 'Share this arrival'}</p>
      <p className="mt-0.5 text-[13px] text-muted">
        {member
          ? [member.title, formatPhone(member.phone)].filter(Boolean).join(' · ')
          : who
            ? `${who} isn't on the team list, so pick the chat in WhatsApp.`
            : 'No sales person was named. Choose who to send it to in WhatsApp.'}
      </p>
      <p className="mt-3 rounded-lg bg-bg-elevated/80 p-3 text-[13px] leading-relaxed text-fg/85">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          {...whatsappAnchor(member?.whatsapp, message)}
          className={cn(link, 'bg-[#25d366] text-[#073b1d] shadow-[0_10px_24px_-14px_#25d366] hover:brightness-105')}
        >
          <WhatsappLogoIcon weight="fill" /> {member ? 'Send on WhatsApp' : 'Open WhatsApp'}
        </a>
        {member && (
          <a href={`tel:${member.phone}`} className={cn(link, buttonVariants.secondary)}>
            <PhoneIcon weight="bold" /> Call {member.fullName.split(' ')[0]}
          </a>
        )}
        <button type="button" onClick={copy} className={cn(link, buttonVariants.ghost)}>
          <CopyIcon weight="bold" /> Copy message
        </button>
      </div>
    </div>
  )
}
