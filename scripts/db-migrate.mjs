#!/usr/bin/env node
// Sets up the database: applies db/migrations/*.sql in order (each once, tracked in
// public._migrations), then loads the default lists from db/seed.sql. Safe to run again.
// Reads DATABASE_URL from the environment / .env.local; never prints it.
//
//   npm run db:setup                 # tables, permissions, default lists
//   npm run db:setup -- --samples    # ...plus sample projects and team, for trying things out

import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Add it to .env.local (Neon Console → Connect → connection string).')
  process.exit(1)
}

const root = path.resolve(import.meta.dirname, '..')
const client = new pg.Client({ connectionString: url })
await client.connect()

try {
  await client.query(
    `create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())`,
  )
  const applied = new Set((await client.query('select name from public._migrations')).rows.map((r) => r.name))
  const files = fs
    .readdirSync(path.join(root, 'db/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`✓ ${file} (already applied)`)
      continue
    }
    const sql = fs.readFileSync(path.join(root, 'db/migrations', file), 'utf8')
    await client.query('begin')
    try {
      await client.query(sql)
      await client.query('insert into public._migrations (name) values ($1)', [file])
      await client.query('commit')
      console.log(`✓ ${file} applied`)
    } catch (err) {
      await client.query('rollback')
      throw new Error(`${file}: ${err.message}`)
    }
  }

  // Default lists (lead sources) are always safe to load: existing rows are never changed.
  await client.query(fs.readFileSync(path.join(root, 'db/seed.sql'), 'utf8'))
  console.log('✓ default lists ready ("How did you find out about us?" options)')
  if (process.argv.includes('--samples')) {
    await client.query(fs.readFileSync(path.join(root, 'db/sample-data.sql'), 'utf8'))
    console.log('✓ sample projects and team loaded (placeholder numbers: replace before going live)')
  }
  console.log('\nDone. In the Neon Console, open Data API and click "Refresh schema cache".')
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
