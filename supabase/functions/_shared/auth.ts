import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const url = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/** Service-role client: bypasses RLS. Only ever used server-side. */
export const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } })

export interface Caller {
  id: string
  name: string
  role: 'admin' | 'receptionist'
  /** Client acting as the caller, so RLS and the audit trail see the real user. */
  client: SupabaseClient
}

/** Resolves the signed-in, active Ivy Hub user behind the request, or null. */
export async function getCaller(req: Request): Promise<Caller | null> {
  const authorization = req.headers.get('Authorization')
  if (!authorization) return null
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data } = await client.auth.getUser()
  if (!data.user) return null
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, name, role, is_active')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!profile?.is_active) return null
  return { id: profile.id, name: profile.name, role: profile.role, client }
}
