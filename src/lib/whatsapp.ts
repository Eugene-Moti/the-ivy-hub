import { formatPhone } from './phone'
import { formatTime } from './time'

/**
 * WhatsApp click-to-chat link. With a number it opens that chat; without one, WhatsApp asks which
 * contact to send to. Used on computers (desktop app or WhatsApp Web) and as the phone fallback.
 */
export function whatsappLink(phone: string | null | undefined, text?: string): string {
  const digits = phone?.replace(/\D/g, '') ?? ''
  const query = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${digits}${query}`
}

/** The app's own link. Both WhatsApp and WhatsApp Business answer it, whichever is installed. */
function whatsappAppLink(phone: string | null | undefined, text?: string): string {
  const digits = phone?.replace(/\D/g, '') ?? ''
  const params = [digits && `phone=${digits}`, text && `text=${encodeURIComponent(text)}`].filter(Boolean)
  return `whatsapp://send${params.length ? `?${params.join('&')}` : ''}`
}

const isPhone = () =>
  /android|iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/**
 * Props for a WhatsApp <a>. On phones a wa.me link can be handed to the wrong app (e.g. "you don't
 * have WhatsApp Business"), so we open the installed app directly and fall back to wa.me only if
 * nothing opened.
 */
export function whatsappAnchor(phone: string | null | undefined, text?: string) {
  return {
    href: whatsappLink(phone, text),
    target: '_blank',
    rel: 'noreferrer',
    onClick: (e: { preventDefault: () => void }) => {
      if (!isPhone()) return
      e.preventDefault()
      const fallback = window.setTimeout(() => {
        if (document.visibilityState === 'visible') window.location.href = whatsappLink(phone, text)
      }, 1600)
      document.addEventListener('visibilitychange', () => window.clearTimeout(fallback), { once: true })
      window.location.href = whatsappAppLink(phone, text)
    },
  }
}

export interface ArrivalMessageInput {
  isClient: boolean
  /** Who is being told (sales person or host); null when not on the team list */
  recipientName: string | null
  visitorName: string
  visitorPhone: string
  visitedAt: string
  /** Client: "Ivy Gardens – 2 Bedroom". Visitor: organisation / purpose (may be empty). */
  about: string
  notes?: string | null
}

/** "Faith Njeri" → "Faith"; titles stay with the name: "Mr Otieno (IT)" → "Mr Otieno". */
export function greetingName(name: string): string {
  const [first, second] = name.trim().split(/\s+/)
  return /^(mr|mrs|ms|miss|dr|eng|prof|pastor|hon)\.?$/i.test(first) && second ? `${first} ${second}` : first
}

/** Same wording as the automatic WhatsApp notification sent by the server. */
export function arrivalMessage(m: ArrivalMessageInput): string {
  const hi = m.recipientName ? `Hi ${greetingName(m.recipientName)}, ` : 'Hi, '
  const time = formatTime(m.visitedAt)
  const phone = formatPhone(m.visitorPhone)
  const base = m.isClient
    ? `${hi}your client ${m.visitorName} has just walked in at ${time}, interested in ${m.about}. Phone: ${phone}.`
    : `${hi}your visitor ${m.visitorName} has arrived at reception (${time})${m.about ? ` – ${m.about}` : ''}. Phone: ${phone}.`
  return m.notes ? `${base}\nNote: ${m.notes}` : base
}
