#!/usr/bin/env node
// Runs db/migrations + db/seed.sql in an in-memory Postgres (PGlite) with stand-ins for Neon's
// Data API roles and auth.user_id(), then checks the permission rules as a receptionist and an admin.
// No Neon account needed:  npm run db:test

import fs from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const root = path.resolve(import.meta.dirname, '..')
const db = new PGlite()
const results = []
const check = async (label, fn, expectError = false) => {
  try {
    const r = await fn()
    const shown = r && typeof r === 'object' && ('rows' in r || (Array.isArray(r) && r[0]?.command)) ? undefined : r
    results.push(`${expectError ? 'FAIL' : 'ok  '} ${label}${shown !== undefined ? ' → ' + JSON.stringify(shown) : ''}`)
  } catch (e) {
    results.push(`${expectError ? 'ok  ' : 'FAIL'} ${label} ✗ ${e.message.split('\n')[0]}`)
  }
}
const q = (sql, params) => db.query(sql, params)
const as = async (uid) => {
  await db.exec(`reset role; select set_config('test.uid', '${uid}', false); set role authenticated;`)
}
const owner = async () => {
  await db.exec(`reset role; select set_config('test.uid', '', false);`)
}

// Neon stand-ins: Data API roles and auth.user_id()
await db.exec(`
  create role authenticated nologin; create role anonymous nologin;
  create schema auth;
  create function auth.user_id() returns text language sql stable as $$ select nullif(current_setting('test.uid', true), '') $$;
  grant usage on schema auth to authenticated; grant execute on function auth.user_id() to authenticated;
`)
const migration = fs
  .readdirSync(path.join(root, 'db/migrations'))
  .sort()
  .map((f) => fs.readFileSync(path.join(root, 'db/migrations', f), 'utf8'))
  .join(String.fromCharCode(10))
const seed = fs.readFileSync(path.join(root, 'db/seed.sql'), 'utf8')
await check('migration', () => db.exec(migration))
await check('seed', () => db.exec(seed))
await check('seed is re-runnable', () => db.exec(seed))
await check('owner creates profiles', () =>
  db.exec(`insert into profiles (id, name, email, username, role) values
  ('u-admin','Grace Wanjiru','grace@x.co','grace','admin'), ('u-rec','Mercy Achieng','mercy@x.co','mercy','receptionist')`),
)

const P = '11111111-0000-4000-8000-000000000001'
const U = '22222222-0000-4000-8000-000000000002'
const SRC_SALES = '33333333-0000-4000-8000-000000000008'
const SRC_WEB = '33333333-0000-4000-8000-000000000001'
const SP = '44444444-0000-4000-8000-000000000002'
const HOST = '44444444-0000-4000-8000-000000000006'

await as('u-rec')
await check('receptionist reads lists', async () => (await q('select count(*)::int n from team_members')).rows[0].n)
await check(
  'client walk-in with sales person',
  async () =>
    (
      await q(
        `insert into walk_ins (full_name, phone, visit_type, project_id, unit_type_id, source_id, sales_person_id, consent, visited_at)
    values ('Amina Odhiambo','+254712345678','client',$1,$2,$3,$4,true, now()) returning reference, created_by, is_returning`,
        [P, U, SRC_SALES, SP],
      )
    ).rows[0],
)
await check(
  'notifications queued for sales person',
  async () =>
    (await q(`select channel, status, recipient_id = $1 as to_sp from notifications order by channel`, [SP])).rows,
)
await check(
  'returning visitor detected',
  async () =>
    (
      await q(
        `insert into walk_ins (full_name, phone, project_id, unit_type_id, source_id, consent)
    values ('Amina O','+254712345678',$1,$2,$3,true) returning is_returning, reference`,
        [P, U, SRC_WEB],
      )
    ).rows[0],
)
await check(
  'visitor (meeting) with host, project ignored',
  async () =>
    (
      await q(
        `insert into walk_ins (full_name, phone, visit_type, host_id, organisation, purpose, project_id, consent)
    values ('John Banker','+254722000111','meeting',$1,'KCB','Financing',$2,true) returning visit_type, project_id, host_id is not null as has_host`,
        [HOST, P],
      )
    ).rows[0],
)
await check(
  'host notification queued',
  async () => (await q(`select count(*)::int n from notifications where recipient_id = $1`, [HOST])).rows[0].n,
)
await check(
  'visitor with free-text host',
  async () =>
    (
      await q(`insert into walk_ins (full_name, phone, visit_type, host_name, consent)
    values ('Jane Delivery','+254733000222','delivery','Mr. Otieno (IT)',true) returning host_name`)
    ).rows[0],
)
await check(
  'visitor without host is rejected',
  () =>
    q(`insert into walk_ins (full_name, phone, visit_type, consent) values ('X Y','+254733000333','interview',true)`),
  true,
)
await check(
  'client without project is rejected',
  () =>
    q(`insert into walk_ins (full_name, phone, source_id, consent) values ('X Y','+254733000444',$1,true)`, [SRC_WEB]),
  true,
)
await check(
  'sales-person source without sales person rejected',
  () =>
    q(
      `insert into walk_ins (full_name, phone, project_id, unit_type_id, source_id, consent) values ('X Y','+254733000555',$1,$2,$3,true)`,
      [P, U, SRC_SALES],
    ),
  true,
)
await check(
  'no consent rejected',
  () =>
    q(
      `insert into walk_ins (full_name, phone, project_id, unit_type_id, source_id, consent) values ('X Y','+254733000666',$1,$2,$3,false)`,
      [P, U, SRC_WEB],
    ),
  true,
)
await check(
  'receptionist edits own record',
  async () => (await q(`update walk_ins set notes='Typo fixed' where full_name='Amina O' returning notes`)).rows.length,
)
await check(
  'receptionist cannot soft-delete',
  () => q(`update walk_ins set deleted_at=now(), delete_reason='x' where full_name='Amina O'`),
  true,
)
await check('hard delete denied', () => q(`delete from walk_ins`), true)
await check(
  'receptionist sees no activity log',
  async () => (await q(`select count(*)::int n from activity_log`)).rows[0].n,
)
await check(
  'receptionist cannot update profiles (0 rows)',
  async () => (await q(`update profiles set role='admin' where id='u-rec' returning id`)).rows.length,
)
await check(
  'receptionist can add team member',
  async () =>
    (
      await q(
        `insert into team_members (full_name, phone, whatsapp, email) values ('New Sales','+254700000199','+254700000199','new@x.co') returning created_by`,
      )
    ).rows[0],
)
await check(
  'receptionist cannot edit team member (0 rows)',
  async () => (await q(`update team_members set title='x' where full_name='Brian Otieno' returning id`)).rows.length,
)
await check('receptionist cannot read login_attempts', () => q(`select * from login_attempts`), true)
await check('receptionist cannot call lockout functions', () => q(`select register_failed_login('grace')`), true)
await check('receptionist cannot mark resets', () => q(`select admin_mark_password_reset('u-admin')`), true)
await check('receptionist completes forced password change', async () => {
  await q(`select complete_password_change()`)
  return (await q(`select must_change_password from profiles where id='u-rec'`)).rows[0]
})
await check('export blocked for receptionist by default', () => q(`select log_export('csv','{}'::jsonb, 3)`), true)

await as('u-admin')
await check(
  'admin soft-deletes with reason',
  async () =>
    (
      await q(
        `update walk_ins set deleted_at=now(), delete_reason='Duplicate' where full_name='Amina O' returning reference`,
      )
    ).rows.length,
)
await check(
  'admin still sees deleted row',
  async () => (await q(`select count(*)::int n from walk_in_rows where deleted_at is not null`)).rows[0].n,
)
await check('admin marks password reset', async () => {
  await q(`select admin_mark_password_reset('u-rec')`)
  return (await q(`select must_change_password from profiles where id='u-rec'`)).rows[0]
})
await check('admin cannot clear must_change_password directly', async () => {
  await q(`update profiles set must_change_password=false where id='u-rec'`)
  return (await q(`select must_change_password from profiles where id='u-rec'`)).rows[0]
})
await check('admin cannot demote self', () => q(`update profiles set role='receptionist' where id='u-admin'`), true)
await check(
  'admin updates settings',
  async () =>
    (await q(`update app_settings set receptionist_can_export=true where id=1 returning receptionist_can_export`))
      .rows[0],
)
await check('admin export logged', () => q(`select log_export('xlsx','{"from":"2026-10-01"}'::jsonb, 42)`))

await as('u-rec')
await check('receptionist export allowed after toggle', () => q(`select log_export('csv','{}'::jsonb, 3)`))

await owner()
await check('lockout after 5 failures', async () => {
  let r
  for (let i = 0; i < 5; i++) r = (await q(`select register_failed_login('grace') r`)).rows[0].r
  return r
})
await check('lock status', async () => Boolean((await q(`select login_lock_status('GRACE') t`)).rows[0].t))
await check('resolve username → email', async () => (await q(`select resolve_login_email('Grace') e`)).rows[0].e)
await check('activity log immutable (owner)', () => q(`update activity_log set action='x'`), true)
await check('activity actions recorded', async () =>
  (await q(`select action, count(*)::int n from activity_log group by action order by action`)).rows
    .map((r) => `${r.action}:${r.n}`)
    .join(' '),
)
await check(
  'audit actor on receptionist insert',
  async () => (await q(`select user_name from activity_log where action='walk_in_created' limit 1`)).rows[0],
)
await check('server acting for a user via ivy.actor', async () => {
  await db.exec(
    `begin; select set_config('ivy.actor','u-admin', true); update notifications set status='sent', attempts=1 where channel='email' and recipient_id='${SP}'; commit;`,
  )
  return (await q(`select user_name, action from activity_log where action='notification_sent'`)).rows[0]
})
console.log(results.join('\n'))
const failures = results.filter((r) => r.startsWith('FAIL')).length
console.log(`
${failures} failure(s) of ${results.length} checks`)
process.exitCode = failures ? 1 : 0
