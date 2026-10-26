// Sign-in helper: username → email lookup and the 5-strikes / 15-minute lockout.
//
// POST { action: 'check', identifier }   → { email, lockedUntil }   (no auth: runs before sign-in)
// POST { action: 'fail', identifier }    → { fails, lockedUntil }   (no auth)
// POST { action: 'clear', identifier }   → { ok }                   (signed-in user clearing their own record)
//
// Neon Auth only knows email addresses, so usernames are resolved here. The lockout lives in our
// database, so clearing browser storage doesn't reset it.

import { db, errorResponse, HttpError, json, readBody, requireCaller } from './_lib/server.js'

export async function POST(request: Request) {
  try {
    const body = await readBody(request)
    const identifier = String(body.identifier ?? '')
      .trim()
      .toLowerCase()
      .slice(0, 200)
    if (!identifier) throw new HttpError(400, 'Enter your email or username.')
    const sql = db()

    if (body.action === 'check') {
      const [{ email }] = (await sql`select resolve_login_email(${identifier}) as email`) as { email: string | null }[]
      const [{ locked }] = (await sql`select login_lock_status(${email ?? identifier}) as locked`) as {
        locked: string | null
      }[]
      return json({ email, lockedUntil: locked })
    }

    if (body.action === 'fail') {
      const [{ r }] = (await sql`select register_failed_login(${identifier}) as r`) as {
        r: { fails: number; locked_until: string | null }
      }[]
      return json({ fails: r.fails, lockedUntil: r.locked_until })
    }

    if (body.action === 'clear') {
      const caller = await requireCaller(request)
      // Only your own record: the identifier must be your email or username.
      if (identifier !== caller.email.toLowerCase() && identifier !== caller.username.toLowerCase()) {
        throw new HttpError(403, 'Not allowed.')
      }
      await sql`select clear_failed_logins(${caller.email})`
      await sql`select clear_failed_logins(${caller.username})`
      return json({ ok: true })
    }

    throw new HttpError(400, 'Unknown action.')
  } catch (err) {
    return errorResponse(err)
  }
}
