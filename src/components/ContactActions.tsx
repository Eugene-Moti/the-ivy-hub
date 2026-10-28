import { EnvelopeSimpleIcon, PhoneIcon, WhatsappLogoIcon } from '@phosphor-icons/react'
import { cn } from '../lib/cn'
import { whatsappAnchor } from '../lib/whatsapp'

const contactAction =
  'focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-semibold text-fg transition-colors hover:border-gold/50 active:bg-gold/[0.08] [&_svg]:size-4'

/** Call / WhatsApp / Email buttons for one person. WhatsApp defaults to the phone number. */
export function ContactActions({
  name,
  phone,
  whatsapp = phone,
  email,
  className,
}: {
  name: string
  phone: string
  whatsapp?: string | null
  email?: string | null
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <a href={`tel:${phone}`} className={contactAction} aria-label={`Call ${name}`}>
        <PhoneIcon weight="bold" className="text-gold" /> Call
      </a>
      {whatsapp && (
        <a {...whatsappAnchor(whatsapp)} className={contactAction} aria-label={`WhatsApp ${name}`}>
          <WhatsappLogoIcon weight="fill" className="text-[#25d366]" /> WhatsApp
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={contactAction} aria-label={`Email ${name}`}>
          <EnvelopeSimpleIcon weight="bold" /> Email
        </a>
      )}
    </div>
  )
}
