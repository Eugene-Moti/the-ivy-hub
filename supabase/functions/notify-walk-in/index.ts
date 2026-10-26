// Notifies the sales person when their client walks in: an email and a WhatsApp message.
// Runs server-side only; provider keys come from environment variables (supabase secrets).
//
// POST { walk_in_id }                 send queued (or retryable failed) notifications for a walk-in
// POST { notification_id, resend }    resend one notification
// POST { check: true }                report which providers are configured
// POST { sweep: true }                 (service role only, e.g. from pg_cron) retry everything still pending
//
// Without keys nothing crashes: notifications are marked "pending_setup".

import { adminClient, corsHeaders, getCaller, json } from '../_shared/auth.ts'

const env = (k: string) => Deno.env.get(k)?.trim() || ''
const APP_URL = env('APP_URL')
const EMAIL_PROVIDER = (env('EMAIL_PROVIDER') || 'resend').toLowerCase() // resend | sendgrid
const EMAIL_FROM = env('EMAIL_FROM') // e.g. "Ivy Hub <hub@theivygroup.co.ke>"
const RESEND_API_KEY = env('RESEND_API_KEY')
const SENDGRID_API_KEY = env('SENDGRID_API_KEY')
const WHATSAPP_PROVIDER = (env('WHATSAPP_PROVIDER') || 'meta').toLowerCase() // meta | twilio
const WHATSAPP_TOKEN = env('WHATSAPP_TOKEN')
const WHATSAPP_PHONE_NUMBER_ID = env('WHATSAPP_PHONE_NUMBER_ID')
const WHATSAPP_TEMPLATE_NAME = env('WHATSAPP_TEMPLATE_NAME')
const WHATSAPP_TEMPLATE_LANG = env('WHATSAPP_TEMPLATE_LANG') || 'en'
const WHATSAPP_API_VERSION = env('WHATSAPP_API_VERSION') || 'v21.0'
const TWILIO_ACCOUNT_SID = env('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = env('TWILIO_AUTH_TOKEN')
const TWILIO_WHATSAPP_FROM = env('TWILIO_WHATSAPP_FROM') // e.g. +14155238886

const MAX_ATTEMPTS = 3

const emailConfigured = () =>
  Boolean(EMAIL_FROM) && (EMAIL_PROVIDER === 'sendgrid' ? Boolean(SENDGRID_API_KEY) : Boolean(RESEND_API_KEY))
const whatsappConfigured = () =>
  WHATSAPP_PROVIDER === 'twilio'
    ? Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM)
    : Boolean(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID)

interface Context {
  companyName: string
  client: {
    name: string
    phone: string
    email: string | null
    notes: string | null
    reference: string
    visitedAt: string
  }
  project: string
  unitType: string
  recordedBy: string
  person: { name: string; email: string; whatsapp: string }
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

/* ------------------------------------------------------------------ */
/* Messages                                                             */
/* ------------------------------------------------------------------ */

function whatsappText(c: Context) {
  const first = c.person.name.split(' ')[0]
  return `Hi ${first}, your client ${c.client.name} has just walked in at ${timeFmt.format(new Date(c.client.visitedAt))}, interested in ${c.project} – ${c.unitType}. Phone: ${c.client.phone}.`
}

function emailHtml(c: Context) {
  const rows: [string, string][] = [
    ['Client', c.client.name],
    ['Phone', c.client.phone],
    ['Email', c.client.email ?? '—'],
    ['Project', c.project],
    ['Unit type', c.unitType],
    ['Date', dateFmt.format(new Date(c.client.visitedAt))],
    ['Time', `${timeFmt.format(new Date(c.client.visitedAt))} EAT`],
    ['Recorded by', c.recordedBy],
    ['Reference', c.client.reference],
  ]
  const logo = APP_URL
    ? `<img src="${APP_URL}/ivy-logo.png" width="56" height="56" alt="${esc(c.companyName)}" style="display:block;margin:0 auto 12px">`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#f8f5ee;font-family:Helvetica,Arial,sans-serif;color:#19201c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0e1512;border-radius:16px;overflow:hidden">
<tr><td style="padding:32px 32px 8px;text-align:center">${logo}
<p style="margin:0;color:#e3c06a;font-size:11px;letter-spacing:3px;text-transform:uppercase">${esc(c.companyName)}</p>
<h1 style="margin:8px 0 0;color:#f3eee2;font-family:Georgia,serif;font-weight:normal;font-size:24px">Your client ${esc(c.client.name)} just walked in</h1>
</td></tr>
<tr><td style="padding:24px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffdf8;border-radius:12px">
${rows.map(([k, v]) => `<tr><td style="padding:10px 16px;color:#5e6a63;font-size:13px;border-bottom:1px solid #efe9dc">${k}</td><td style="padding:10px 16px;font-size:14px;font-weight:bold;text-align:right;border-bottom:1px solid #efe9dc">${esc(v)}</td></tr>`).join('')}
</table>
${c.client.notes ? `<p style="margin:20px 0 0;color:#c9d1cc;font-size:13px">Receptionist notes</p><p style="margin:6px 0 0;padding:12px 16px;background:#17221d;border-left:3px solid #c99a30;border-radius:6px;color:#f3eee2;font-size:14px;line-height:1.5">${esc(c.client.notes)}</p>` : ''}
<p style="margin:24px 0 0;text-align:center"><a href="tel:${esc(c.client.phone)}" style="display:inline-block;padding:12px 22px;background:#c99a30;color:#0e1512;border-radius:10px;text-decoration:none;font-weight:bold">Call ${esc(c.client.name.split(' ')[0])}</a></p>
</td></tr>
<tr><td style="padding:0 32px 28px;text-align:center;color:#6f7f77;font-size:11px">Sent by Ivy Hub · reception walk-in alert</td></tr>
</table></td></tr></table></body></html>`
}

function emailText(c: Context) {
  return [
    `Your client ${c.client.name} just walked in.`,
    '',
    `Phone: ${c.client.phone}`,
    `Email: ${c.client.email ?? '—'}`,
    `Project: ${c.project} – ${c.unitType}`,
    `When: ${dateFmt.format(new Date(c.client.visitedAt))}, ${timeFmt.format(new Date(c.client.visitedAt))} EAT`,
    `Recorded by: ${c.recordedBy}`,
    c.client.notes ? `Notes: ${c.client.notes}` : '',
    `Reference: ${c.client.reference}`,
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

async function sendEmail(c: Context): Promise<string | null> {
  const subject = `Your client ${c.client.name} just walked in`
  if (EMAIL_PROVIDER === 'sendgrid') {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: c.person.email, name: c.person.name }] }],
        from: parseFrom(EMAIL_FROM),
        subject,
        content: [
          { type: 'text/plain', value: emailText(c) },
          { type: 'text/html', value: emailHtml(c) },
        ],
      }),
    })
    if (!res.ok) throw new Error(`SendGrid: ${await failText(res)}`)
    return res.headers.get('x-message-id')
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: [c.person.email], subject, html: emailHtml(c), text: emailText(c) }),
  })
  if (!res.ok) throw new Error(`Resend: ${await failText(res)}`)
  const data = await res.json().catch(() => ({}))
  return data.id ?? null
}

function parseFrom(from: string) {
  const m = /^(.*)<(.+)>$/.exec(from)
  return m ? { name: m[1].trim().replace(/^"|"$/g, ''), email: m[2].trim() } : { email: from }
}

async function sendWhatsApp(c: Context): Promise<string | null> {
  const to = c.person.whatsapp.replace(/\D/g, '')
  if (WHATSAPP_PROVIDER === 'twilio') {
    const body = new URLSearchParams({
      From: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
      To: `whatsapp:+${to}`,
      Body: whatsappText(c),
    })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    if (!res.ok) throw new Error(`Twilio: ${await failText(res)}`)
    const data = await res.json().catch(() => ({}))
    return data.sid ?? null
  }

  // Meta WhatsApp Cloud API. Business-initiated messages need an approved template; free-form text
  // only reaches people who messaged the business in the last 24h.
  const time = timeFmt.format(new Date(c.client.visitedAt))
  const payload = WHATSAPP_TEMPLATE_NAME
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: WHATSAPP_TEMPLATE_NAME,
          language: { code: WHATSAPP_TEMPLATE_LANG },
          components: [
            {
              type: 'body',
              parameters: [
                c.person.name.split(' ')[0],
                c.client.name,
                time,
                `${c.project} – ${c.unitType}`,
                c.client.phone,
              ].map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: whatsappText(c) } }
  const res = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`WhatsApp: ${await failText(res)}`)
  const data = await res.json().catch(() => ({}))
  return data.messages?.[0]?.id ?? null
}

/* ------------------------------------------------------------------ */
/* Delivery                                                             */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function loadContext(walkInId: string): Promise<Context> {
  const { data: w, error } = await adminClient
    .from('walk_ins')
    .select(
      '*, project:projects(name), unit:unit_types(name), person:sales_persons(full_name, email, whatsapp), recorder:profiles!walk_ins_created_by_fkey(name)',
    )
    .eq('id', walkInId)
    .single()
  if (error || !w) throw new Error(error?.message ?? 'Walk-in not found')
  const { data: settings } = await adminClient.from('app_settings').select('company_name').eq('id', 1).single()
  return {
    companyName: settings?.company_name ?? 'The Ivy Group',
    client: {
      name: w.full_name,
      phone: w.phone,
      email: w.email,
      notes: w.notes,
      reference: w.reference,
      visitedAt: w.visited_at,
    },
    project: w.project?.name ?? '',
    unitType: w.unit?.name ?? '',
    recordedBy: w.recorder?.name ?? 'Reception',
    person: { name: w.person?.full_name ?? '', email: w.person?.email ?? '', whatsapp: w.person?.whatsapp ?? '' },
  }
}

interface NotificationRow {
  id: string
  walk_in_id: string
  channel: 'email' | 'whatsapp'
  status: string
  attempts: number
}

/** Up to MAX_ATTEMPTS tries with backoff; the row's final state is written once. */
async function deliver(n: NotificationRow, c: Context) {
  const configured = n.channel === 'email' ? emailConfigured() : whatsappConfigured()
  if (!configured) {
    const error =
      n.channel === 'email'
        ? `Email provider not configured (set EMAIL_FROM and ${EMAIL_PROVIDER === 'sendgrid' ? 'SENDGRID_API_KEY' : 'RESEND_API_KEY'})`
        : `WhatsApp provider not configured (set ${WHATSAPP_PROVIDER === 'twilio' ? 'TWILIO_* secrets' : 'WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID'})`
    await adminClient.from('notifications').update({ status: 'pending_setup', error }).eq('id', n.id)
    return
  }
  let attempts = n.attempts
  let lastError = ''
  for (let i = 0; i < MAX_ATTEMPTS && attempts < MAX_ATTEMPTS; i++) {
    attempts++
    try {
      const messageId = n.channel === 'email' ? await sendEmail(c) : await sendWhatsApp(c)
      await adminClient
        .from('notifications')
        .update({
          status: 'sent',
          error: null,
          attempts,
          sent_at: new Date().toISOString(),
          provider_message_id: messageId,
        })
        .eq('id', n.id)
      return
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (attempts < MAX_ATTEMPTS) await sleep(800 * attempts)
    }
  }
  await adminClient
    .from('notifications')
    .update({ status: 'failed', error: lastError.slice(0, 500), attempts })
    .eq('id', n.id)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))

    // Scheduled sweep: picks up anything a browser queued but never dispatched (closed tab, crash…).
    if (body.sweep && req.headers.get('Authorization') === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
      const { data } = await adminClient
        .from('notifications')
        .select('*')
        .or(`status.eq.queued,and(status.eq.failed,attempts.lt.${MAX_ATTEMPTS})`)
        .lt('created_at', new Date(Date.now() - 60_000).toISOString())
        .limit(50)
      const byWalkIn = new Map<string, NotificationRow[]>()
      for (const n of data ?? []) byWalkIn.set(n.walk_in_id, [...(byWalkIn.get(n.walk_in_id) ?? []), n])
      for (const [id, rows] of byWalkIn) {
        const context = await loadContext(id)
        await Promise.all(rows.map((n) => deliver(n, context)))
      }
      return json({ swept: data?.length ?? 0 })
    }

    const caller = await getCaller(req)
    if (!caller) return json({ error: 'Please sign in again.' }, 401)

    if (body.check) {
      return json({
        setup: {
          email: emailConfigured(),
          whatsapp: whatsappConfigured(),
          email_provider: EMAIL_PROVIDER === 'sendgrid' ? 'SendGrid' : 'Resend',
          whatsapp_provider: WHATSAPP_PROVIDER === 'twilio' ? 'Twilio WhatsApp' : 'WhatsApp Business Cloud API',
        },
      })
    }

    let walkInId: string = body.walk_in_id
    let rows: NotificationRow[] = []
    if (body.notification_id) {
      const { data } = await adminClient.from('notifications').select('*').eq('id', body.notification_id).maybeSingle()
      if (!data) return json({ error: 'Notification not found' }, 404)
      walkInId = data.walk_in_id
      // A manual resend gets a fresh set of attempts.
      rows = [{ ...data, attempts: body.resend ? 0 : data.attempts }]
    } else if (walkInId) {
      const { data } = await adminClient
        .from('notifications')
        .select('*')
        .eq('walk_in_id', walkInId)
        .or(`status.eq.queued,status.eq.pending_setup,and(status.eq.failed,attempts.lt.${MAX_ATTEMPTS})`)
      rows = data ?? []
    } else {
      return json({ error: 'walk_in_id or notification_id is required' }, 400)
    }

    if (rows.length) {
      const context = await loadContext(walkInId)
      await Promise.all(rows.map((n) => deliver(n, context)))
    }
    const { data: all } = await adminClient
      .from('notifications')
      .select('*')
      .eq('walk_in_id', walkInId)
      .order('channel')
    return json({ notifications: all ?? [] })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
