#!/usr/bin/env node
// Applies db/migrations/*.sql in order (each once, tracked in public._migrations), then optionally
// db/seed.sql. Reads DATABASE_URL from the environment / .env.local; never prints it.
//
//   npm run db:migrate            # migrations only
//   npm run db:migrate -- --seed  # migrations + sample lists

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

  if (process.argv.includes('--seed')) {
    await client.query(fs.readFileSync(path.join(root, 'db/seed.sql'), 'utf8'))
    console.log('✓ seed lists loaded (projects, unit types, sources, team)')
  }
  console.log('\nDone. In the Neon Console, open Data API and click "Refresh schema cache".')
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
