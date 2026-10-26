// Scheduled safety net (Vercel Cron, see vercel.json): retries notifications that a browser queued
// but never dispatched (closed tab, lost connection) or that failed with attempts left.
// Vercel sends `Authorization: Bearer $CRON_SECRET` with each scheduled call.

import { deliver, MAX_ATTEMPTS, type NotificationRow } from '../_lib/notify.js'
import { db, env, errorResponse, json } from '../_lib/server.js'

export async function GET(request: Request) {
  try {
    const secret = env('CRON_SECRET')
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
      return json({ error: 'Unauthorized' }, 401)
    }
    const rows = (await db()`
      select * from notifications
      where (status = 'queued' or (status = 'failed' and attempts < ${MAX_ATTEMPTS}))
        and created_at < now() - interval '2 minutes'
      order by created_at
      limit 50
    `) as NotificationRow[]
    for (const n of rows) await deliver(n, null)
    return json({ swept: rows.length })
  } catch (err) {
    return errorResponse(err)
  }
}
