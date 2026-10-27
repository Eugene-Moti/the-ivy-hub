#!/usr/bin/env node
// Checks your settings before deploying: are all the values filled in, do they look right, and do
// they actually work? Secret values are never printed.   npm run env:check

import fs from 'node:fs'
import pg from 'pg'

const ok = (msg) => console.log(`  ✓ ${msg}`)
const warn = (msg) => console.log(`  ! ${msg}`)
const bad = (msg) => {
  console.log(`  ✗ ${msg}`)
  process.exitCode = 1
}
const v = (key) => process.env[key]?.trim() || ''

// Common .env.local mistakes that silently blank a value (the file itself is read, never printed).
if (fs.existsSync('.env.local')) {
  console.log('\n0. .env.local format')
  const seen = new Map()
  let problems = 0
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      const n = i + 1
      if (/^\s*[A-Z][A-Z0-9_]*\s*:\s*\S/.test(line)) {
        bad(`line ${n}: uses "NAME: value"; it must be NAME=value (this line is ignored)`)
        problems++
      }
      const m = /^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/.exec(line)
      if (!m) return
      const [, key, raw] = m
      if (seen.has(key)) {
        bad(`line ${n}: ${key} appears again (first on line ${seen.get(key)}); the last one wins, so keep only one`)
        problems++
      }
      seen.set(key, n)
      if (/^\s+\S/.test(raw)) warn(`line ${n}: space after "=" in ${key}; write ${key}=value`)
      const value = raw.trim()
      if (value.startsWith('#') || /\s#/.test(value.replace(/^(["']).*\1$/, ''))) {
        bad(`line ${n}: ${key} contains "#", which starts a comment; wrap the value in double quotes`)
        problems++
      }
    })
  if (!problems) ok('format looks fine')
}

console.log('\n1. Values in .env.local')
const authUrl = v('VITE_NEON_AUTH_URL').replace(/\/$/, '')
const dataUrl = v('VITE_NEON_DATA_API_URL').replace(/\/$/, '')
const dbUrl = v('DATABASE_URL')
const jwksUrl = v('NEON_AUTH_JWKS_URL') || (authUrl ? `${authUrl}/.well-known/jwks.json` : '')

if (!authUrl) bad('VITE_NEON_AUTH_URL is empty (Neon → Settings → Better Auth → Auth URL)')
else if (!/neonauth\..+\/auth$/.test(authUrl))
  warn('VITE_NEON_AUTH_URL should look like https://ep-…neonauth….neon.tech/neondb/auth')
else ok('VITE_NEON_AUTH_URL looks right')

if (!dataUrl) bad('VITE_NEON_DATA_API_URL is empty (Neon → Data API → API URL)')
else if (!/apirest\..+\/rest\/v1$/.test(dataUrl))
  warn('VITE_NEON_DATA_API_URL should look like https://ep-…apirest….neon.tech/neondb/rest/v1')
else ok('VITE_NEON_DATA_API_URL looks right')

if (!dbUrl) bad('DATABASE_URL is empty (Neon → Connect → connection string)')
else if (!/^postgres(ql)?:\/\//.test(dbUrl)) bad('DATABASE_URL should start with postgresql://')
else
  ok(
    `DATABASE_URL is set${dbUrl.includes('-pooler') ? ' (pooled, good for Vercel)' : ' (tip: tick "Connection pooling" in Neon → Connect for Vercel)'}`,
  )

if (!v('NEON_AUTH_JWKS_URL')) warn('NEON_AUTH_JWKS_URL is empty; using Auth URL + /.well-known/jwks.json')
else ok('NEON_AUTH_JWKS_URL is set')
if (!v('APP_URL')) warn('APP_URL is empty (fine until you know your Vercel address)')
else if (v('APP_URL').endsWith('/')) warn('APP_URL ends with "/"; remove it (https://the-ivy-hub.vercel.app)')
else ok(`APP_URL is ${v('APP_URL')}`)
if (!v('SEED_TEMP_PASSWORD')) warn('SEED_TEMP_PASSWORD is empty (needed only for npm run db:seed-users)')
v('CRON_SECRET').length >= 24
  ? ok('CRON_SECRET is set')
  : warn('CRON_SECRET is empty or short (needed on Vercel for the daily retry job)')

console.log('\n2. Connections')
if (jwksUrl) {
  try {
    const res = await fetch(jwksUrl)
    const body = await res.json()
    body.keys?.length
      ? ok(`Neon Auth signing keys reachable (${body.keys.length})`)
      : bad(`JWKS URL answered but has no keys (${res.status})`)
  } catch (e) {
    bad(`Could not reach the JWKS URL: ${e.message}`)
  }
}
if (dataUrl) {
  try {
    const res = await fetch(`${dataUrl}/app_settings?select=id`)
    res.status < 500
      ? ok(`Data API reachable (HTTP ${res.status}; 401 is normal without signing in)`)
      : bad(`Data API returned ${res.status}`)
  } catch (e) {
    bad(`Could not reach the Data API: ${e.message}`)
  }
}

if (dbUrl) {
  const client = new pg.Client({ connectionString: dbUrl })
  try {
    await client.connect()
    ok('Database connection works')
    const roles = await client.query(
      `select count(*)::int n from pg_roles where rolname in ('authenticated','anonymous')`,
    )
    roles.rows[0].n === 2
      ? ok('Data API roles exist')
      : bad('Data API roles missing: enable the Data API with "Use Neon Auth" first')
    const migrated = await client.query(`select to_regclass('public.walk_ins') is not null as yes`)
    if (!migrated.rows[0].yes) {
      warn('Tables not created yet: run  npm run db:setup')
    } else {
      ok('Ivy Hub tables exist')
      const admins = await client.query(`select count(*)::int n from profiles where role = 'admin' and is_active`)
      const users = await client.query(`select count(*)::int n from profiles`)
      admins.rows[0].n
        ? ok(`${admins.rows[0].n} admin profile(s), ${users.rows[0].n} user(s) in total`)
        : warn('No admin yet: run  npm run db:seed-users')
      try {
        const authAdmins = await client.query(
          `select count(*)::int n from neon_auth."user" u join profiles p on p.id = u.id where p.role = 'admin' and u.role = 'admin'`,
        )
        if (admins.rows[0].n) {
          authAdmins.rows[0].n
            ? ok('Admin also has the Neon Auth admin role (can create users in the app)')
            : warn('Give the admin the Neon Auth admin role: Neon → Better Auth → Users → ⋯ → Make admin')
        }
      } catch {
        warn('Could not read Neon Auth users (check the admin role in Neon → Better Auth → Users)')
      }
    }
  } catch (e) {
    bad(`Database connection failed: ${e.message.replace(dbUrl, '[DATABASE_URL]')}`)
  } finally {
    await client.end().catch(() => {})
  }
}

console.log(process.exitCode ? '\nFix the ✗ items above, then run this again.\n' : '\nAll required checks passed.\n')
