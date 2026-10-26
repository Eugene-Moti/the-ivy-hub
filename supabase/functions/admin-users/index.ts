// Admin-only user management. Creating accounts and setting passwords need the service role, so they
// happen here; profile changes go through the admin's own session so RLS and the audit trail apply.
//
// POST { action: 'create', name, email, username, role, password }
// POST { action: 'update', user_id, name?, role?, title?, is_active? }
// POST { action: 'reset_password', user_id, password }

import { adminClient, corsHeaders, getCaller, json } from '../_shared/auth.ts'

const strongEnough = (p: unknown) => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const caller = await getCaller(req)
    if (!caller) return json({ error: 'Please sign in again.' }, 401)
    if (caller.role !== 'admin') return json({ error: 'Only an admin can manage users.' }, 403)
    const body = await req.json().catch(() => ({}))

    if (body.action === 'create') {
      const email = String(body.email ?? '')
        .trim()
        .toLowerCase()
      const username = String(body.username ?? '')
        .trim()
        .toLowerCase()
      const name = String(body.name ?? '').trim()
      const role = body.role === 'admin' ? 'admin' : 'receptionist'
      if (!name || !email || !username) return json({ error: 'Name, email and username are required.' }, 400)
      if (!strongEnough(body.password))
        return json({ error: 'Password needs 8+ characters with a letter and a number.' }, 400)

      const { data: taken } = await adminClient.from('profiles').select('id').eq('username', username).maybeSingle()
      if (taken) return json({ error: 'That username is taken.' }, 400)

      const { data: created, error } = await adminClient.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        user_metadata: { name, username },
      })
      if (error || !created.user) return json({ error: error?.message ?? 'Could not create the account.' }, 400)

      const { data: profile, error: profileError } = await caller.client
        .from('profiles')
        .insert({
          id: created.user.id,
          name,
          email,
          username,
          role,
          title: role === 'admin' ? 'Admin' : 'Receptionist',
        })
        .select('*')
        .single()
      if (profileError) {
        await adminClient.auth.admin.deleteUser(created.user.id) // keep auth and profiles in step
        return json({ error: profileError.message }, 400)
      }
      return json({ profile })
    }

    if (body.action === 'update') {
      const patch: Record<string, unknown> = {}
      if (typeof body.name === 'string') patch.name = body.name.trim()
      if (body.role === 'admin' || body.role === 'receptionist') patch.role = body.role
      if (typeof body.title === 'string') patch.title = body.title
      if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
      const { data: profile, error } = await caller.client
        .from('profiles')
        .update(patch)
        .eq('id', body.user_id)
        .select('*')
        .single()
      if (error) return json({ error: error.message }, 400)
      if (typeof body.is_active === 'boolean') {
        // A ban stops sign-in and token refresh; RLS already blocks inactive users' data access.
        await adminClient.auth.admin.updateUserById(body.user_id, { ban_duration: body.is_active ? 'none' : '876000h' })
      }
      return json({ profile })
    }

    if (body.action === 'reset_password') {
      if (!strongEnough(body.password))
        return json({ error: 'Password needs 8+ characters with a letter and a number.' }, 400)
      const { error } = await adminClient.auth.admin.updateUserById(body.user_id, { password: body.password })
      if (error) return json({ error: error.message }, 400)
      // Clear any lockout so they can sign in with the new password straight away.
      const { data: target } = await adminClient
        .from('profiles')
        .select('email, username')
        .eq('id', body.user_id)
        .single()
      if (target) {
        await adminClient
          .from('login_attempts')
          .delete()
          .in('identifier', [target.email.toLowerCase(), target.username.toLowerCase()])
      }
      await caller.client.rpc('log_admin_event', { p_action: 'password_reset', p_user_id: body.user_id })
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
