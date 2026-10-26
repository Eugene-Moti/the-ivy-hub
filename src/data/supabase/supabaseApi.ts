import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { SignInResult } from '../../auth/types'
import { MAX_FAILED_ATTEMPTS, SUPABASE_ANON_KEY, SUPABASE_URL } from '../../lib/config'
import { normalisePhone } from '../../lib/phone'
import { readJSON, writeJSON } from '../../lib/storage'
import { eatDayEnd, eatDayStart, todayKey } from '../../lib/time'
import { ApiError, type Api } from '../api'
import { searchDigits } from '../walkInUtils'
import type {
  ActivityEntry,
  AppSettings,
  LeadSource,
  Profile,
  Project,
  SalesPerson,
  UnitType,
  WalkIn,
  WalkInFilters,
  WalkInNotification,
} from '../types'

// "Remember me" decides where Supabase keeps the session: localStorage (survives restarts)
// or sessionStorage (cleared when the tab closes).
const REMEMBER_KEY = 'ivy.remember'
const rememberStorage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key) ?? sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      const remember = readJSON<boolean>(REMEMBER_KEY) ?? true
      ;(remember ? localStorage : sessionStorage).setItem(key, value)
    } catch {
      /* storage unavailable */
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {
      /* storage unavailable */
    }
  },
}

export const supabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_ANON_KEY || 'anon', {
  auth: { persistSession: true, autoRefreshToken: true, storage: rememberStorage, storageKey: 'ivy.auth' },
})

/* ------------------------------------------------------------------ */
/* Row mappers (snake_case columns → camelCase domain types)           */
/* ------------------------------------------------------------------ */

type Row = Record<string, any>

const toProfile = (r: Row): Profile => ({
  id: r.id,
  name: r.name,
  email: r.email,
  username: r.username,
  role: r.role,
  title: r.title ?? (r.role === 'admin' ? 'Admin' : 'Receptionist'),
  isActive: r.is_active,
  createdAt: r.created_at,
})

const toProject = (r: Row): Project => ({ id: r.id, name: r.name, isActive: r.is_active, sortOrder: r.sort_order })
const toUnitType = (r: Row): UnitType => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  isActive: r.is_active,
  sortOrder: r.sort_order,
})
const toSource = (r: Row): LeadSource => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  kind: r.kind,
  isActive: r.is_active,
  sortOrder: r.sort_order,
})
const toSalesPerson = (r: Row): SalesPerson => ({
  id: r.id,
  fullName: r.full_name,
  phone: r.phone,
  whatsapp: r.whatsapp,
  email: r.email,
  team: r.team,
  isActive: r.is_active,
  createdBy: r.created_by,
  createdAt: r.created_at,
})
const toSettings = (r: Row): AppSettings => ({
  companyName: r.company_name,
  editWindowHours: r.edit_window_hours,
  receptionistCanExport: r.receptionist_can_export,
  workingDays: r.working_days,
  openTime: r.open_time,
  closeTime: r.close_time,
})
const toWalkIn = (r: Row): WalkIn => ({
  id: r.id,
  reference: r.reference,
  visitedAt: r.visited_at,
  fullName: r.full_name,
  phone: r.phone,
  email: r.email,
  projectId: r.project_id,
  unitTypeId: r.unit_type_id,
  sourceId: r.source_id,
  salesPersonId: r.sales_person_id,
  otherSourceText: r.other_source_text,
  notes: r.notes,
  consent: r.consent,
  isReturning: r.is_returning,
  createdBy: r.created_by,
  createdByName: r.created_by_name ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
  deleteReason: r.delete_reason,
})
const toNotification = (r: Row): WalkInNotification => ({
  id: r.id,
  walkInId: r.walk_in_id,
  salesPersonId: r.sales_person_id,
  channel: r.channel,
  status: r.status,
  error: r.error,
  attempts: r.attempts,
  sentAt: r.sent_at,
  createdAt: r.created_at,
})
const toActivity = (r: Row): ActivityEntry => ({
  id: String(r.id),
  userId: r.user_id,
  userName: r.user_name,
  action: r.action,
  entity: r.entity,
  entityId: r.entity_id,
  oldValues: r.old_values,
  newValues: r.new_values,
  createdAt: r.created_at,
})

const WALK_IN_COLUMNS: Record<string, string> = {
  fullName: 'full_name',
  phone: 'phone',
  email: 'email',
  projectId: 'project_id',
  unitTypeId: 'unit_type_id',
  sourceId: 'source_id',
  salesPersonId: 'sales_person_id',
  otherSourceText: 'other_source_text',
  notes: 'notes',
}

function toColumns(patch: Record<string, unknown>, map: Record<string, string>) {
  return Object.fromEntries(Object.entries(patch).map(([k, v]) => [map[k] ?? k, v]))
}

/* ------------------------------------------------------------------ */
/* Error handling                                                       */
/* ------------------------------------------------------------------ */

function fail(error: PostgrestError | { message: string; code?: string }): never {
  const code = 'code' in error ? error.code : undefined
  if (code === '42501') throw new ApiError('You do not have permission to do that.', 'forbidden')
  if (code === 'PGRST116') throw new ApiError('Record not found.', 'not_found')
  if (code === '23505') throw new ApiError('That already exists.', 'conflict')
  if (code === 'P0001') throw new ApiError(error.message, 'invalid') // raised by our triggers
  throw new Error(error.message)
}

function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) fail(res.error)
  return res.data as T
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    // FunctionsHttpError carries the JSON body our functions return ({ error: "…" })
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const payload = await ctx.json().catch(() => null)
      if (payload?.error) throw new ApiError(payload.error, ctx.status === 403 ? 'forbidden' : 'invalid')
    }
    throw new Error(error.message)
  }
  return data as T
}

/* ------------------------------------------------------------------ */
/* Queries                                                              */
/* ------------------------------------------------------------------ */

// Filters apply to any PostgREST builder; typed loosely to avoid fighting the generic chain.
function applyFilters(q: any, f: WalkInFilters) {
  if (!f.includeDeleted) q = q.is('deleted_at', null)
  if (f.projectId) q = q.eq('project_id', f.projectId)
  if (f.unitTypeId) q = q.eq('unit_type_id', f.unitTypeId)
  if (f.sourceId) q = q.eq('source_id', f.sourceId)
  if (f.salesPersonId) q = q.eq('sales_person_id', f.salesPersonId)
  if (f.from) q = q.gte('visited_at', eatDayStart(f.from).toISOString())
  if (f.to) q = q.lt('visited_at', eatDayEnd(f.to).toISOString())
  const search = f.search?.trim()
  if (search) {
    const s = search.replace(/[%,()*]/g, ' ').trim()
    const ors = [`full_name.ilike.*${s}*`, `email.ilike.*${s}*`, `reference.ilike.*${s}*`]
    const digits = searchDigits(search)
    if (digits) ors.push(`phone.ilike.*${digits}*`)
    q = q.or(ors.join(','))
  }
  return q
}

let currentUserId: string | null = null

export const supabaseApi: Api = {
  mode: 'supabase',

  async restoreSession() {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) {
      // Offline, the token refresh fails and no session comes back; let the caller use its cached profile.
      if (!navigator.onLine && rememberStorage.getItem('ivy.auth')) throw new Error('offline')
      return null
    }
    const res = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (res.error) throw new Error(res.error.message)
    const profile = res.data
    if (!profile || !profile.is_active) {
      await supabase.auth.signOut()
      return null
    }
    currentUserId = user.id
    return toProfile(profile)
  },

  async signIn(identifier, password, remember): Promise<SignInResult> {
    writeJSON(REMEMBER_KEY, remember)
    const id = identifier.trim().toLowerCase()
    try {
      const email = id.includes('@')
        ? id
        : ((await supabase.rpc('resolve_login_email', { p_identifier: id })).data as string | null)
      const key = email ?? id

      const { data: lockedUntil } = await supabase.rpc('login_lock_status', { p_identifier: key })
      if (lockedUntil) return { ok: false, reason: 'locked', lockedUntil: new Date(lockedUntil).getTime() }

      const registerFailure = async (): Promise<SignInResult> => {
        const { data } = await supabase.rpc('register_failed_login', { p_identifier: key })
        const row = (Array.isArray(data) ? data[0] : data) as { fails: number; locked_until: string | null } | null
        if (row?.locked_until) return { ok: false, reason: 'locked', lockedUntil: new Date(row.locked_until).getTime() }
        return { ok: false, reason: 'invalid', attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - (row?.fails ?? 1)) }
      }

      if (!email) return registerFailure()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (/banned/i.test(error.message)) return { ok: false, reason: 'inactive' }
        if (error.status === 0 || /fetch/i.test(error.message)) return { ok: false, reason: 'offline' }
        return registerFailure()
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
      if (!profile || !profile.is_active) {
        await supabase.auth.signOut()
        return { ok: false, reason: 'inactive' }
      }
      currentUserId = data.user.id
      await supabase.rpc('clear_failed_logins', { p_identifier: key })
      await supabase.rpc('log_session_event', { p_action: 'login', p_details: {} })
      return { ok: true, user: toProfile(profile) }
    } catch {
      return { ok: false, reason: 'offline' }
    }
  },

  async signOut(reason) {
    try {
      await supabase.rpc('log_session_event', { p_action: 'logout', p_details: { reason } })
    } catch {
      /* offline: still sign out locally */
    }
    currentUserId = null
    await supabase.auth.signOut({ scope: 'local' })
  },

  async requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error && !/rate/i.test(error.message)) throw new Error(error.message)
  },

  async getReferenceData() {
    const [projects, unitTypes, sources, salesPersons, settings] = await Promise.all([
      supabase.from('projects').select('*').is('deleted_at', null).order('sort_order'),
      supabase.from('unit_types').select('*').is('deleted_at', null).order('sort_order'),
      supabase.from('lead_sources').select('*').is('deleted_at', null).order('sort_order'),
      supabase.from('sales_persons').select('*').order('full_name'),
      supabase.from('app_settings').select('*').eq('id', 1).single(),
    ])
    return {
      projects: unwrap(projects).map(toProject),
      unitTypes: unwrap(unitTypes).map(toUnitType),
      sources: unwrap(sources).map(toSource),
      salesPersons: unwrap(salesPersons).map(toSalesPerson),
      settings: toSettings(unwrap(settings)),
    }
  },

  async createWalkIn(input) {
    // ON CONFLICT DO NOTHING on the client-generated id makes offline retries safe.
    const res = await supabase.from('walk_ins').upsert(
      {
        id: input.id,
        visited_at: input.visitedAt,
        full_name: input.fullName,
        phone: input.phone,
        email: input.email,
        project_id: input.projectId,
        unit_type_id: input.unitTypeId,
        source_id: input.sourceId,
        sales_person_id: input.salesPersonId,
        other_source_text: input.otherSourceText,
        notes: input.notes,
        consent: input.consent,
        is_returning: input.isReturning,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (res.error) fail(res.error)
    return toWalkIn(unwrap(await supabase.from('walk_in_rows').select('*').eq('id', input.id).single()))
  },

  async updateWalkIn(id, patch) {
    const res = await supabase.from('walk_ins').update(toColumns(patch, WALK_IN_COLUMNS)).eq('id', id).select('id')
    const rows = unwrap(res)
    if (!rows.length) throw new ApiError('This record can no longer be edited.', 'forbidden')
    return toWalkIn(unwrap(await supabase.from('walk_in_rows').select('*').eq('id', id).single()))
  },

  async deleteWalkIn(id, reason) {
    const rows = unwrap(
      await supabase
        .from('walk_ins')
        .update({ deleted_at: new Date().toISOString(), delete_reason: reason.trim() })
        .eq('id', id)
        .select('id'),
    )
    if (!rows.length) throw new ApiError('Only an admin can delete records.', 'forbidden')
  },

  async getWalkIn(id) {
    const row = unwrap(await supabase.from('walk_in_rows').select('*').eq('id', id).maybeSingle())
    return row ? toWalkIn(row) : null
  },

  async listWalkIns(filters, page, pageSize) {
    const q = applyFilters(supabase.from('walk_in_rows').select('*', { count: 'exact' }), filters)
    const res = await q.order('visited_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1)
    if (res.error) fail(res.error)
    return { rows: (res.data as Row[]).map(toWalkIn), total: res.count ?? 0 }
  },

  async queryWalkIns(filters) {
    // PostgREST caps responses (1000 rows by default), so page through.
    const out: WalkIn[] = []
    const size = 1000
    for (let page = 0; page < 100; page++) {
      const q = applyFilters(supabase.from('walk_in_rows').select('*'), filters)
      const res = await q.order('visited_at', { ascending: false }).range(page * size, page * size + size - 1)
      if (res.error) fail(res.error)
      out.push(...(res.data as Row[]).map(toWalkIn))
      if ((res.data as Row[]).length < size) break
    }
    return out
  },

  async findReturning(phone, email) {
    const p = phone ? normalisePhone(phone) : null
    const e = email?.trim().toLowerCase() || null
    if (!p && !e) return null
    const ors = [p && `phone.eq.${p}`, e && `email.ilike.${e.replace(/[%,()*]/g, '')}`].filter(Boolean).join(',')
    const res = await supabase
      .from('walk_in_rows')
      .select('*')
      .is('deleted_at', null)
      .or(ors)
      .order('visited_at', { ascending: false })
      .limit(1)
    const rows = unwrap(res)
    return rows.length ? toWalkIn(rows[0]) : null
  },

  async countToday() {
    const today = todayKey()
    const res = await supabase
      .from('walk_ins')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('visited_at', eatDayStart(today).toISOString())
      .lt('visited_at', eatDayEnd(today).toISOString())
    if (res.error) fail(res.error)
    return res.count ?? 0
  },

  async listNotifications(walkInId) {
    const rows = unwrap(await supabase.from('notifications').select('*').eq('walk_in_id', walkInId).order('channel'))
    return rows.map(toNotification)
  },

  async dispatchNotifications(walkInId) {
    const data = await invoke<{ notifications: Row[] }>('notify-walk-in', { walk_in_id: walkInId })
    return data.notifications.map(toNotification)
  },

  async resendNotification(id) {
    const data = await invoke<{ notifications: Row[] }>('notify-walk-in', { notification_id: id, resend: true })
    const row = data.notifications.find((n) => n.id === id)
    if (!row) throw new ApiError('Notification not found.', 'not_found')
    return toNotification(row)
  },

  async getNotificationSetup() {
    const data = await invoke<{
      setup: { email: boolean; whatsapp: boolean; email_provider: string; whatsapp_provider: string }
    }>('notify-walk-in', { check: true })
    return {
      email: data.setup.email,
      whatsapp: data.setup.whatsapp,
      emailProvider: data.setup.email_provider,
      whatsappProvider: data.setup.whatsapp_provider,
    }
  },

  async createSalesPerson(input) {
    const res = await supabase.from('sales_persons').upsert(
      {
        id: input.id,
        full_name: input.fullName,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        team: input.team,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (res.error) fail(res.error)
    return toSalesPerson(unwrap(await supabase.from('sales_persons').select('*').eq('id', input.id).single()))
  },

  async updateSalesPerson(id, patch) {
    const map = { fullName: 'full_name', isActive: 'is_active' }
    const row = unwrap<Row>(
      await supabase.from('sales_persons').update(toColumns(patch, map)).eq('id', id).select('*').single(),
    )
    return toSalesPerson(row)
  },

  async saveProject({ id, name, isActive }) {
    const values = { name, is_active: isActive }
    const res = id
      ? await supabase.from('projects').update(values).eq('id', id).select('*').single()
      : await supabase.from('projects').insert(values).select('*').single()
    return toProject(unwrap(res))
  },

  async deleteProject(id) {
    unwrap(
      await supabase
        .from('projects')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', id)
        .select('id'),
    )
  },

  async saveUnitType({ id, name, projectId, isActive }) {
    const res = id
      ? await supabase.from('unit_types').update({ name, is_active: isActive }).eq('id', id).select('*').single()
      : await supabase
          .from('unit_types')
          .insert({ name, project_id: projectId, is_active: isActive })
          .select('*')
          .single()
    return toUnitType(unwrap(res))
  },

  async deleteUnitType(id) {
    unwrap(
      await supabase
        .from('unit_types')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', id)
        .select('id'),
    )
  },

  async saveSource({ id, name, icon, kind, isActive }) {
    const values = { name, icon, kind, is_active: isActive }
    const res = id
      ? await supabase.from('lead_sources').update(values).eq('id', id).select('*').single()
      : await supabase.from('lead_sources').insert(values).select('*').single()
    return toSource(unwrap(res))
  },

  async deleteSource(id) {
    unwrap(
      await supabase
        .from('lead_sources')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', id)
        .select('id'),
    )
  },

  async updateSettings(patch) {
    const map = {
      companyName: 'company_name',
      editWindowHours: 'edit_window_hours',
      receptionistCanExport: 'receptionist_can_export',
      workingDays: 'working_days',
      openTime: 'open_time',
      closeTime: 'close_time',
    }
    const row = unwrap<Row>(
      await supabase.from('app_settings').update(toColumns(patch, map)).eq('id', 1).select('*').single(),
    )
    return toSettings(row)
  },

  async listUsers() {
    return unwrap(await supabase.from('profiles').select('*').order('created_at')).map(toProfile)
  },

  async createUser(input) {
    const data = await invoke<{ profile: Row }>('admin-users', { action: 'create', ...input })
    return toProfile(data.profile)
  },

  async updateUser(id, patch) {
    const data = await invoke<{ profile: Row }>('admin-users', {
      action: 'update',
      user_id: id,
      name: patch.name,
      role: patch.role,
      title: patch.title,
      is_active: patch.isActive,
    })
    return toProfile(data.profile)
  },

  async resetPassword(id, newPassword) {
    await invoke('admin-users', { action: 'reset_password', user_id: id, password: newPassword })
  },

  async listActivity(filters, page, pageSize) {
    let q = supabase.from('activity_log').select('*', { count: 'exact' })
    if (filters.userId) q = q.eq('user_id', filters.userId)
    if (filters.action) q = q.eq('action', filters.action)
    if (filters.from) q = q.gte('created_at', eatDayStart(filters.from).toISOString())
    if (filters.to) q = q.lt('created_at', eatDayEnd(filters.to).toISOString())
    const res = await q.order('created_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1)
    if (res.error) fail(res.error)
    return { rows: (res.data as Row[]).map(toActivity), total: res.count ?? 0 }
  },

  async logExport(meta) {
    unwrap(
      await supabase.rpc('log_export', {
        p_format: meta.format,
        p_filters: meta.filters,
        p_row_count: meta.rowCount,
      }),
    )
  },
}

/** Fires when Supabase ends the session on its own (refresh token revoked, user banned, …). */
export function onSupabaseSignedOut(cb: () => void) {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && currentUserId) {
      currentUserId = null
      cb()
    }
  })
  return () => data.subscription.unsubscribe()
}
