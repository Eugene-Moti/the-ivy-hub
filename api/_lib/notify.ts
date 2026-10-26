// Arrival notifications: an email and a WhatsApp to the sales person (client visits) or the host
// (other visits). Provider keys come from environment variables; without them, notifications are
// marked "pending_setup" and nothing crashes.

import { db, env } from './server.js'

export const MAX_ATTEMPTS = 3

const EMAIL_PROVIDER = () => (env('EMAIL_PROVIDER') || 'sendgrid').toLowerCase() // sendgrid (Twilio SendGrid) | resend
const WHATSAPP_PROVIDER = () => (env('WHATSAPP_PROVIDER') || 'twilio').toLowerCase() // twilio | meta

export function emailConfigured() {
  if (!env('EMAIL_FROM')) return false
  return EMAIL_PROVIDER() === 'resend' ? Boolean(env('RESEND_API_KEY')) : Boolean(env('SENDGRID_API_KEY'))
}

export function whatsappConfigured() {
  return WHATSAPP_PROVIDER() === 'meta'
    ? Boolean(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID'))
    : Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_WHATSAPP_FROM'))
}

export function setupSummary() {
  return {
    email: emailConfigured(),
    whatsapp: whatsappConfigured(),
    email_provider: EMAIL_PROVIDER() === 'resend' ? 'Resend' : 'Twilio SendGrid',
    whatsapp_provider: WHATSAPP_PROVIDER() === 'meta' ? 'WhatsApp Business Cloud API (Meta)' : 'Twilio WhatsApp',
  }
}

/* ------------------------------------------------------------------ */
/* Message content                                                      */
/* ------------------------------------------------------------------ */

export interface NotificationRow {
  id: string
  walk_in_id: string
  recipient_id: string
  channel: 'email' | 'whatsapp'
  status: string
  attempts: number
}

interface Context {
  companyName: string
  isClient: boolean
  visitor: {
    name: string
    phone: string
    email: string | null
    notes: string | null
    reference: string
    visitedAt: string
  }
  /** Client: "Ivy Gardens – 2 Bedroom". Visitor: organisation / purpose. */
  about: string
  visitLabel: string
  organisation: string | null
  purpose: string | null
  recordedBy: string
  recipient: { name: string; email: string; whatsapp: string }
}

const VISIT_LABELS: Record<string, string> = {
  client: 'Client – property enquiry',
  meeting: 'Meeting',
  delivery: 'Delivery / courier',
  interview: 'Job interview',
  other: 'Visit',
}

const timeFmt = new Intl.DateTimeFormat('en-KE', {
  timeZone: 'Africa/Nairobi',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const dateFmt = new Intl.DateTimeFormat('en-KE', {
  timeZone: 'Africa/Nairobi',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const first = (name: string) => name.split(' ')[0]
const at = (c: Context) => timeFmt.format(new Date(c.visitor.visitedAt))

export async function loadContext(walkInId: string, recipientId: string): Promise<Context> {
  const sql = db()
  const rows = (await sql`
    select w.*, p.name as project_name, u.name as unit_name, pr.name as recorder_name,
           m.full_name as recipient_name, m.email as recipient_email, m.whatsapp as recipient_whatsapp,
           s.company_name
    from walk_ins w
    left join projects p on p.id = w.project_id
    left join unit_types u on u.id = w.unit_type_id
    left join profiles pr on pr.id = w.created_by
    left join team_members m on m.id = ${recipientId}
    cross join app_settings s
    where w.id = ${walkInId} and s.id = 1
  `) as Record<string, any>[]
  const w = rows[0]
  if (!w) throw new Error('Walk-in not found')
  const isClient = w.visit_type === 'client'
  return {
    companyName: w.company_name ?? 'The Ivy Group',
    isClient,
    visitor: {
      name: w.full_name,
      phone: w.phone,
      email: w.email,
      notes: w.notes,
      reference: w.reference,
      visitedAt: new Date(w.visited_at).toISOString(),
    },
    about: isClient
      ? `${w.project_name ?? ''} – ${w.unit_name ?? ''}`
      : [w.organisation, w.purpose].filter(Boolean).join(' · ') || VISIT_LABELS[w.visit_type] || 'Visit',
    visitLabel: VISIT_LABELS[w.visit_type] ?? 'Visit',
    organisation: w.organisation,
    purpose: w.purpose,
    recordedBy: w.recorder_name ?? 'Reception',
    recipient: { name: w.recipient_name ?? '', email: w.recipient_email ?? '', whatsapp: w.recipient_whatsapp ?? '' },
  }
}

export function whatsappText(c: Context) {
  return c.isClient
    ? `Hi ${first(c.recipient.name)}, your client ${c.visitor.name} has just walked in at ${at(c)}, interested in ${c.about}. Phone: ${c.visitor.phone}.`
    : `Hi ${first(c.recipient.name)}, your visitor ${c.visitor.name} has arrived at reception (${at(c)})${
        c.organisation || c.purpose ? ` – ${c.about}` : ''
      }. Phone: ${c.visitor.phone}.`
}

const subject = (c: Context) =>
  c.isClient ? `Your client ${c.visitor.name} just walked in` : `Your visitor ${c.visitor.name} is at reception`

function emailHtml(c: Context) {
  const appUrl = env('APP_URL')
  const rows: [string, string][] = c.isClient
    ? [
        ['Client', c.visitor.name],
        ['Phone', c.visitor.phone],
        ['Email', c.visitor.email ?? '—'],
        ['Interested in', c.about],
      ]
    : [
        ['Visitor', c.visitor.name],
        ['Phone', c.visitor.phone],
        ['Visit', c.visitLabel],
        ...(c.organisation ? [['Organisation', c.organisation] as [string, string]] : []),
        ...(c.purpose ? [['Purpose', c.purpose] as [string, string]] : []),
      ]
  rows.push(
    ['Date', dateFmt.format(new Date(c.visitor.visitedAt))],
    ['Time', `${at(c)} EAT`],
    ['Recorded by', c.recordedBy],
    ['Reference', c.visitor.reference],
  )
  const logo = appUrl
    ? `<img src="${appUrl}/ivy-logo.png" width="56" height="56" alt="${esc(c.companyName)}" style="display:block;margin:0 auto 12px">`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#f8f5ee;font-family:Helvetica,Arial,sans-serif;color:#19201c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0e1512;border-radius:16px;overflow:hidden">
<tr><td style="padding:32px 32px 8px;text-align:center">${logo}
<p style="margin:0;color:#e3c06a;font-size:11px;letter-spacing:3px;text-transform:uppercase">${esc(c.companyName)}</p>
<h1 style="margin:8px 0 0;color:#f3eee2;font-family:Georgia,serif;font-weight:normal;font-size:24px">${esc(subject(c))}</h1>
</td></tr>
<tr><td style="padding:24px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffdf8;border-radius:12px">
${rows.map(([k, v]) => `<tr><td style="padding:10px 16px;color:#5e6a63;font-size:13px;border-bottom:1px solid #efe9dc">${k}</td><td style="padding:10px 16px;font-size:14px;font-weight:bold;text-align:right;border-bottom:1px solid #efe9dc">${esc(v)}</td></tr>`).join('')}
</table>
${c.visitor.notes ? `<p style="margin:20px 0 0;color:#c9d1cc;font-size:13px">Receptionist notes</p><p style="margin:6px 0 0;padding:12px 16px;background:#17221d;border-left:3px solid #c99a30;border-radius:6px;color:#f3eee2;font-size:14px;line-height:1.5">${esc(c.visitor.notes)}</p>` : ''}
<p style="margin:24px 0 0;text-align:center"><a href="tel:${esc(c.visitor.phone)}" style="display:inline-block;padding:12px 22px;background:#c99a30;color:#0e1512;border-radius:10px;text-decoration:none;font-weight:bold">Call ${esc(first(c.visitor.name))}</a></p>
</td></tr>
<tr><td style="padding:0 32px 28px;text-align:center;color:#6f7f77;font-size:11px">Sent by Ivy Hub · reception arrival alert</td></tr>
</table></td></tr></table></body></html>`
}

function emailText(c: Context) {
  return [
    subject(c) + '.',
    '',
    `Phone: ${c.visitor.phone}`,
    c.isClient
      ? `Interested in: ${c.about}`
      : `Visit: ${c.visitLabel}${c.organisation || c.purpose ? ` (${c.about})` : ''}`,
    `When: ${dateFmt.format(new Date(c.visitor.visitedAt))}, ${at(c)} EAT`,
    `Recorded by: ${c.recordedBy}`,
    c.visitor.notes ? `Notes: ${c.visitor.notes}` : '',
    `Reference: ${c.visitor.reference}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/* ------------------------------------------------------------------ */
/* Providers                                                            */
/* ------------------------------------------------------------------ */

async function failText(res: Response) {
  const body = await res.text().catch(() => '')
  return `${res.status} ${body.slice(0, 300)}`
}

function parseFrom(from: string) {
  const m = /^(.*)<(.+)>$/.exec(from)
  return m ? { name: m[1].trim().replace(/^"|"$/g, ''), email: m[2].trim() } : { email: from }
}

async function sendEmail(c: Context): Promise<string | null> {
  if (!c.recipient.email) throw new Error('This team member has no email address')
  if (EMAIL_PROVIDER() === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env('EMAIL_FROM'),
        to: [c.recipient.email],
        subject: subject(c),
        html: emailHtml(c),
        text: emailText(c),
      }),
    })
    if (!res.ok) throw new Error(`Resend: ${await failText(res)}`)
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return data.id ?? null
  }
  // Twilio SendGrid
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('SENDGRID_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: c.recipient.email, name: c.recipient.name }] }],
      from: parseFrom(env('EMAIL_FROM')),
      subject: subject(c),
      content: [
        { type: 'text/plain', value: emailText(c) },
        { type: 'text/html', value: emailHtml(c) },
      ],
    }),
  })
  if (!res.ok) throw new Error(`SendGrid: ${await failText(res)}`)
  return res.headers.get('x-message-id')
}

/** Template variables, in order, for approved WhatsApp templates. */
function templateVariables(c: Context) {
  return [first(c.recipient.name), c.visitor.name, at(c), c.about, c.visitor.phone]
}

async function sendWhatsApp(c: Context): Promise<string | null> {
  if (!c.recipient.whatsapp) throw new Error('This team member has no WhatsApp number')
  const to = c.recipient.whatsapp.replace(/[^\d+]/g, '')

  if (WHATSAPP_PROVIDER() === 'meta') {
    const template = c.isClient ? env('WHATSAPP_TEMPLATE_NAME') : env('WHATSAPP_VISITOR_TEMPLATE_NAME')
    const payload = template
      ? {
          messaging_product: 'whatsapp',
          to: to.replace('+', ''),
          type: 'template',
          template: {
            name: template,
            language: { code: env('WHATSAPP_TEMPLATE_LANG') || 'en' },
            components: [{ type: 'body', parameters: templateVariables(c).map((text) => ({ type: 'text', text })) }],
          },
        }
      : { messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'text', text: { body: whatsappText(c) } }
    const res = await fetch(
      `https://graph.facebook.com/${env('WHATSAPP_API_VERSION') || 'v21.0'}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    if (!res.ok) throw new Error(`WhatsApp: ${await failText(res)}`)
    const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[] }
    return data.messages?.[0]?.id ?? null
  }

  // Twilio WhatsApp. In the sandbox, free-form text reaches anyone who has joined the sandbox.
  // In production, business-initiated messages need an approved Content template (ContentSid).
  const sid = env('TWILIO_ACCOUNT_SID')
  const contentSid = c.isClient ? env('TWILIO_WHATSAPP_CONTENT_SID') : env('TWILIO_WHATSAPP_VISITOR_CONTENT_SID')
  const form = new URLSearchParams({
    From: `whatsapp:${env('TWILIO_WHATSAPP_FROM')}`,
    To: `whatsapp:${to.startsWith('+') ? to : `+${to}`}`,
  })
  if (contentSid) {
    form.set('ContentSid', contentSid)
    form.set(
      'ContentVariables',
      JSON.stringify(Object.fromEntries(templateVariables(c).map((v, i) => [String(i + 1), v]))),
    )
  } else {
    form.set('Body', whatsappText(c))
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${env('TWILIO_AUTH_TOKEN')}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })
  if (!res.ok) throw new Error(`Twilio: ${await failText(res)}`)
  const data = (await res.json().catch(() => ({}))) as { sid?: string }
  return data.sid ?? null
}

/* ------------------------------------------------------------------ */
/* Delivery                                                             */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Writes the notification's outcome. `actor` is the signed-in user who triggered the send (shown in
 * the activity log); null for the scheduled sweep ("System").
 */
async function record(id: string, fields: Record<string, unknown>, actor: string | null) {
  const sql = db()
  const update = sql`
    update notifications set
      status = ${fields.status as string},
      error = ${(fields.error as string | null) ?? null},
      attempts = coalesce(${(fields.attempts as number | null) ?? null}, attempts),
      sent_at = coalesce(${(fields.sent_at as string | null) ?? null}::timestamptz, sent_at),
      provider_message_id = coalesce(${(fields.provider_message_id as string | null) ?? null}, provider_message_id)
    where id = ${id}`
  if (actor) await sql.transaction([sql`select set_config('ivy.actor', ${actor}, true)`, update])
  else await update
}

/** Up to MAX_ATTEMPTS tries with backoff; the final state is written once. */
export async function deliver(n: NotificationRow, actor: string | null) {
  const configured = n.channel === 'email' ? emailConfigured() : whatsappConfigured()
  if (!configured) {
    const error =
      n.channel === 'email'
        ? `Email not configured (set EMAIL_FROM and ${EMAIL_PROVIDER() === 'resend' ? 'RESEND_API_KEY' : 'SENDGRID_API_KEY'})`
        : `WhatsApp not configured (set ${WHATSAPP_PROVIDER() === 'meta' ? 'WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID' : 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM'})`
    await record(n.id, { status: 'pending_setup', error }, actor)
    return
  }
  let context: Context
  try {
    context = await loadContext(n.walk_in_id, n.recipient_id)
  } catch (err) {
    await record(n.id, { status: 'failed', error: err instanceof Error ? err.message : String(err) }, actor)
    return
  }
  let attempts = n.attempts
  let lastError = ''
  while (attempts < MAX_ATTEMPTS) {
    attempts++
    try {
      const messageId = n.channel === 'email' ? await sendEmail(context) : await sendWhatsApp(context)
      await record(
        n.id,
        { status: 'sent', error: null, attempts, sent_at: new Date().toISOString(), provider_message_id: messageId },
        actor,
      )
      return
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (attempts < MAX_ATTEMPTS) await sleep(700 * attempts)
    }
  }
  await record(n.id, { status: 'failed', error: lastError.slice(0, 500), attempts }, actor)
}

export async function notificationsFor(walkInId: string) {
  return (await db()`select * from notifications where walk_in_id = ${walkInId} order by channel`) as Record<
    string,
    unknown
  >[]
}
