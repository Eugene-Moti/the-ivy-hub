#!/usr/bin/env node
// Creates an Ivy Hub user (Supabase Auth account + profile). Use it for the first admin; after that,
// admins create users from Settings → Users.
//
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/create-user.mjs --name "Grace Wanjiru" --email grace@theivygroup.co.ke \
//     --username grace --role admin --password "ChangeMe#2026"
//
// The service-role key is a server secret: run this on your own machine, never commit the key.

import { createClient } from '@supabase/supabase-js'

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((pairs, a, i, all) => (a.startsWith('--') ? [...pairs, [a.slice(2), all[i + 1]]] : pairs), []),
)

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const { name, email, username, password } = args
const role = args.role === 'admin' ? 'admin' : 'receptionist'

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}
if (!name || !email || !username || !password) {
  console.error(
    'Usage: node scripts/create-user.mjs --name "Full Name" --email you@example.com --username you --role admin|receptionist --password "Secret#123"',
  )
  process.exit(1)
}
if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  console.error('Password needs at least 8 characters, including a letter and a number.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const { data, error } = await supabase.auth.admin.createUser({
  email: email.toLowerCase(),
  password,
  email_confirm: true,
  user_metadata: { name, username },
})
if (error) {
  console.error('Could not create the auth account:', error.message)
  process.exit(1)
}

const { error: profileError } = await supabase.from('profiles').insert({
  id: data.user.id,
  name,
  email: email.toLowerCase(),
  username: username.toLowerCase(),
  role,
  title: role === 'admin' ? 'Marketing Lead' : 'Receptionist',
})
if (profileError) {
  await supabase.auth.admin.deleteUser(data.user.id)
  console.error('Could not create the profile:', profileError.message)
  process.exit(1)
}

console.log(`Created ${role} ${name} <${email}> (username: ${username}).`)
