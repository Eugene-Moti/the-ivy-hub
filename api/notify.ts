// Sends the arrival notifications for a walk-in, server-side only.
//
// POST { walk_in_id }                 send queued (or retryable) notifications for a walk-in
// POST { notification_id, resend }    resend one notification (fresh set of attempts)
// POST { check: true }                which providers are configured (never returns the keys)

import { deliver, MAX_ATTEMPTS, notificationsFor, setupSummary, type NotificationRow } from './_lib/notify.js'
import { db, errorResponse, HttpError, json, readBody, requireCaller } from './_lib/server.js'

export async function POST(request: Request) {
  try {
    const caller = await requireCaller(request)
    const body = await readBody(request)
    if (body.check) return json({ setup: setupSummary() })

    const sql = db()
    let walkInId = typeof body.walk_in_id === 'string' ? body.walk_in_id : ''
    let rows: NotificationRow[] = []

    if (typeof body.notification_id === 'string') {
      const found = (await sql`select * from notifications where id = ${body.notification_id}`) as NotificationRow[]
      if (!found.length) throw new HttpError(404, 'Notification not found.')
      walkInId = found[0].walk_in_id
      rows = [{ ...found[0], attempts: body.resend ? 0 : found[0].attempts }]
    } else if (walkInId) {
      rows = (await sql`
        select * from notifications
        where walk_in_id = ${walkInId}
          and (status in ('queued', 'pending_setup') or (status = 'failed' and attempts < ${MAX_ATTEMPTS}))
      `) as NotificationRow[]
    } else {
      throw new HttpError(400, 'walk_in_id or notification_id is required.')
    }

    await Promise.all(rows.map((n) => deliver(n, caller.id)))
    return json({ notifications: await notificationsFor(walkInId) })
  } catch (err) {
    return errorResponse(err)
  }
}
