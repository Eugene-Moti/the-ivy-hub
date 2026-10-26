#!/usr/bin/env node
// Creates the first admin and receptionist: a Neon Auth account + an Ivy Hub profile for each.
// Both start with the temporary password from SEED_TEMP_PASSWORD and must change it at first sign-in.
//
// Reads from the environment / .env.local (never printed):
//   DATABASE_URL, VITE_NEON_AUTH_URL, SEED_TEMP_PASSWORD
//   SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, [SEED_ADMIN_USERNAME], [SEED_ADMIN_TITLE]
//   [SEED_RECEPTIONIST_EMAIL, SEED_RECEPTIONIST_NAME, SEED_RECEPTIONIST_USERNAME]  (optional)
//   [SEED_ORIGIN] (defaults to http://localhost:5173; must be allowed in Neon → Better Auth → Domains)
//
// Run once, *before* turning off "Sign-up with Email" in the Neon Console:  npm run db:seed-users

import pg from 'pg'

const need = (key) => {
  const v = process.env[key]?.trim()
  if (!v) {
    console.error(`Missing ${key}. Add it to .env.local (see .env.example).`)
    process.exit(1)
  }
  return v
}

const authUrl = need('VITE_NEON_AUTH_URL').replace(/\/$/, '')
const dbUrl = process.env.DATABASE_URL_UNPOOLED || need('DATABASE_URL')
const password = need('SEED_TEMP_PASSWORD')
const origin = process.env.SEED_ORIGIN?.trim() || 'http://localhost:5173'
if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  console.error('SEED_TEMP_PASSWORD needs at least 8 characters with a letter and a number.')
  process.exit(1)
}

const usernameFrom = (email) =>
  email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
const people = [
  {
    role: 'admin',
    title: process.env.SEED_ADMIN_TITLE?.trim() || 'Marketing Lead',
    email: need('SEED_ADMIN_EMAIL').toLowerCase(),
    name: need('SEED_ADMIN_NAME'),
    username: process.env.SEED_ADMIN_USERNAME?.trim().toLowerCase(),
  },
  {
    role: 'receptionist',
    title: 'Receptionist',
    email: process.env.SEED_RECEPTIONIST_EMAIL?.trim().toLowerCase(),
    name: process.env.SEED_RECEPTIONIST_NAME?.trim(),
    username: process.env.SEED_RECEPTIONIST_USERNAME?.trim().toLowerCase(),
  },
]
  // The receptionist is optional here: the admin can add them later in Settings → Users.
  .filter((p) => p.email && p.name)
  .map((p) => ({ ...p, username: p.username || usernameFrom(p.email) }))

const db = new pg.Client({ connectionString: dbUrl })
await db.connect()

async function findAuthUserId(email) {
  try {
    const r = await db.query('select id from neon_auth."user" where lower(email) = $1', [email])
    return r.rows[0]?.id ?? null
  } catch {
    return null
  }
}

try {
  for (const p of people) {
    let userId = await findAuthUserId(p.email)
    if (userId) {
      console.log(`• ${p.email}: Neon Auth account already exists`)
    } else {
      const res = await fetch(`${authUrl}/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ email: p.email, password, name: p.name }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          `${p.email}: sign-up failed (${res.status} ${body?.message ?? body?.code ?? ''}). ` +
            'Is "Sign-up with Email" still on, and is the origin allowed under Better Auth → Domains?',
        )
      }
      userId = body?.user?.id ?? (await findAuthUserId(p.email))
      if (!userId) throw new Error(`${p.email}: account created but its id could not be read`)
      console.log(`✓ ${p.email}: Neon Auth account created`)
    }

    if (p.role === 'admin') {
      // The admin needs Neon Auth's "admin" role to manage users from the app.
      try {
        await db.query(`update neon_auth."user" set role = 'admin' where id = $1`, [userId])
        console.log(`✓ ${p.email}: granted Neon Auth admin role`)
      } catch {
        console.log(`! ${p.email}: set the admin role manually: Neon Console → Better Auth → Users → ⋯ → Make admin`)
      }
    }

    const r = await db.query(
      `insert into public.profiles (id, name, email, username, role, title, must_change_password)
       values ($1, $2, $3, $4, $5, $6, true)
       on conflict (id) do nothing
       returning id`,
      [userId, p.name, p.email, p.username, p.role, p.title],
    )
    console.log(
      r.rowCount
        ? `✓ ${p.email}: Ivy Hub profile created (${p.role}, username "${p.username}")`
        : `• ${p.email}: profile already exists`,
    )
  }
  console.log('\nSign in with SEED_TEMP_PASSWORD; you will be asked to choose your own password straight away.')
  console.log('Next: turn OFF "Sign-up with Email" in Neon → Better Auth so nobody else can register.')
} catch (err) {
  console.error('Seeding failed:', err.message)
  process.exitCode = 1
} finally {
  await db.end()
}
