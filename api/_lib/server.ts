// Shared helpers for the Vercel functions in /api. Files under _lib are not exposed as endpoints.
//
// Secrets are read from environment variables only (Vercel → Settings → Environment Variables, or
// .env.local when developing). Nothing here is ever sent to the browser.

import { neon } from '@neondatabase/serverless'
import { createRemoteJWKSet, jwtVerify } from 'jose'

export const env = (key: string) => process.env[key]?.trim() || ''

/** Owner connection (bypasses RLS): only used server-side, after we've checked who is calling. */
export function db() {
  const url = env('DATABASE_URL')
  if (!url) throw new HttpError(500, 'DATABASE_URL is not configured on the server.')
  return neon(url)
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return json({ error: err.message }, err.status)
  console.error(err)
  return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function keySet() {
  const url =
    env('NEON_AUTH_JWKS_URL') || (env('VITE_NEON_AUTH_URL') ? `${env('VITE_NEON_AUTH_URL')}/.well-known/jwks.json` : '')
  if (!url) throw new HttpError(500, 'NEON_AUTH_JWKS_URL is not configured on the server.')
  jwks ??= createRemoteJWKSet(new URL(url))
  return jwks
}

export interface Caller {
  id: string
  name: string
  email: string
  username: string
  role: 'admin' | 'receptionist'
}

/**
 * The signed-in, active Ivy Hub user behind the request. The browser sends the short-lived JWT that
 * Neon Auth issued; we verify its signature against Neon's public keys, then look up the profile.
 */
export async function requireCaller(request: Request): Promise<Caller> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw new HttpError(401, 'Please sign in again.')
  let sub: string | undefined
  try {
    const { payload } = await jwtVerify(token, keySet())
    sub = payload.sub
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.')
  }
  if (!sub) throw new HttpError(401, 'Please sign in again.')
  const rows =
    (await db()`select id, name, email, username, role from profiles where id = ${sub} and is_active`) as Caller[]
  if (!rows.length) throw new HttpError(403, 'This account is not active in Ivy Hub.')
  return rows[0]
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
