import { createClient } from '@neondatabase/neon-js'
import type { SignInResult } from '../../auth/types'
import { MAX_FAILED_ATTEMPTS, NEON_AUTH_URL, NEON_DATA_API_URL } from '../../lib/config'
import { normalisePhone } from '../../lib/phone'
import { readJSON, remove, writeJSON } from '../../lib/storage'
import { eatDayEnd, eatDayStart, todayKey } from '../../lib/time'
import { ApiError, type Api } from '../api'
import { searchDigits } from '../walkInUtils'
import type {
  ActivityEntry,
  AppSettings,
  LeadSource,
  Profile,
  Project,
  TeamMember,
  UnitType,
  WalkIn,
  WalkInFilters,
  WalkInNotification,
} from '../types'

// Live backend on Neon:
//   - Managed Better Auth: sign-in, sessions (HTTP-only cookies), admin user management
//   - Data API (PostgREST): every table read/write, permissions enforced by Postgres RLS
//   - /api/* (Vercel functions): login lockout and email/WhatsApp notifications, which need secrets

export const neon = createClient({
  auth: { url: NEON_AUTH_URL || 'https://auth.invalid' },
  dataApi: { url: NEON_DATA_API_URL || 'https://data.invalid' },
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
  mustChangePassword: r.must_change_password,
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
const toMember = (r: Row): TeamMember => ({
  id: r.id,
  fullName: r.full_name,
  phone: r.phone,
  whatsapp: r.whatsapp,
  email: r.email,
  title: r.title,
  branch: r.branch,
  isSalesPerson: r.is_sales_person,
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
  visitType: r.visit_type,
  projectId: r.project_id,
  unitTypeId: r.unit_type_id,
  sourceId: r.source_id,
  salesPersonId: r.sales_person_id,
  otherSourceText: r.other_source_text,
  hostId: r.host_id,
  hostName: r.host_name,
  organisation: r.organisation,
  purpose: r.purpose,
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
  recipientId: r.recipient_id,
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
  visitType: 'visit_type',
  projectId: 'project_id',
  unitTypeId: 'unit_type_id',
  sourceId: 'source_id',
  salesPersonId: 'sales_person_id',
  otherSourceText: 'other_source_text',
  hostId: 'host_id',
  hostName: 'host_name',
}
const MEMBER_COLUMNS: Record<string, string> = {
  fullName: 'full_name',
  isSalesPerson: 'is_sales_person',
  isActive: 'is_active',
}

function toColumns(patch: Record<string, unknown>, map: Record<string, string>) {
  return Object.fromEntries(Object.entries(patch).map(([k, v]) => [map[k] ?? k, v]))
}

/* ------------------------------------------------------------------ */
/* Errors and helpers                                                   */
/* ------------------------------------------------------------------ */

interface PgError {
  message: string
  code?: string
}

function fail(error: PgError): never {
  if (error.code === '42501') throw new ApiError('You do not have permission to do that.', 'forbidden')
  if (error.code === 'PGRST116') throw new ApiError('Record not found.', 'not_found')
  if (error.code === '23505') throw new ApiError('That already exists.', 'conflict')
  if (error.code === 'P0001') throw new ApiError(error.message, 'invalid') // raised by our triggers
  throw new Error(error.message)
}

function unwrap<T>(res: { data: T | null; error: PgError | null }): T {
  if (res.error) fail(res.error)
  return res.data as T
}

/** Short-lived JWT for the signed-in user, sent to our /api functions. */
async function accessToken(): Promise<string | null> {
  try {
    const { data } = await neon.auth.token()
    return data?.token ?? null
  } catch {
    return null
  }
}

/** Calls a Vercel function in /api (same origin). */
async function callApi<T>(path: string, body: Record<string, unknown>, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = await accessToken()
    if (!token) throw new ApiError('Your session has ended. Please sign in again.', 'forbidden')
    headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`/api/${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new ApiError(payload.error ?? `Request failed (${res.status})`, res.status === 403 ? 'forbidden' : 'invalid')
  return payload as T
}

// "Remember me" off: the session should end with the browser tab. Neon keeps the session in an
// HTTP-only cookie we can't move, so a sessionStorage marker tells us whether this tab signed in.
const REMEMBER_KEY = 'ivy.remember'
const TAB_KEY = 'ivy.tabSession'

// Filters apply to any PostgREST builder; typed loosely to avoid fighting the generic chain.
function applyFilters(q: any, f: WalkInFilters) {
  if (!f.includeDeleted) q = q.is('deleted_at', null)
  if (f.visitType) q = q.eq('visit_type', f.visitType)
  if (f.projectId) q = q.eq('project_id', f.projectId)
  if (f.unitTypeId) q = q.eq('unit_type_id', f.unitTypeId)
  if (f.sourceId) q = q.eq('source_id', f.sourceId)
  if (f.salesPersonId) q = q.eq('sales_person_id', f.salesPersonId)
  if (f.from) q = q.gte('visited_at', eatDayStart(f.from).toISOString())
  if (f.to) q = q.lt('visited_at', eatDayEnd(f.to).toISOString())
  const search = f.search?.trim()
  if (search) {
    const s = search.replace(/[%,()*]/g, ' ').trim()
    const ors = [`full_name.ilike.*${s}*`, `email.ilike.*${s}*`, `reference.ilike.*${s}*`, `organisation.ilike.*${s}*`]
    const digits = searchDigits(search)
    if (digits) ors.push(`phone.ilike.*${digits}*`)
    q = q.or(ors.join(','))
  }
  return q
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const res = await neon.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (res.error) throw new Error(res.error.message)
  return res.data ? toProfile(res.data) : null
}

const nowIso = () => new Date().toISOString()

export const neonApi: Api = {
  mode: 'live',

  async restoreSession() {
    const remember = readJSON<boolean>(REMEMBER_KEY) ?? true
    const tabSignedIn = readJSON<boolean>(TAB_KEY, 'session') ?? false
    const { data, error } = await neon.auth.getSession()
    if (error && !navigator.onLine) throw new Error('offline')
    const user = data?.user
    if (!user) return null
    if (!remember && !tabSignedIn) {
      // Browser was closed since a "don't remember me" sign-in: end that session.
      await neon.auth.signOut().catch(() => {})
      return null
    }
    const profile = await loadProfile(user.id)
    if (!profile?.isActive) {
      await neon.auth.signOut().catch(() => {})
      return null
    }
    return profile
  },

  async signIn(identifier, password, remember): Promise<SignInResult> {
    const id = identifier.trim().toLowerCase()
    let guard: { email: string | null; lockedUntil: string | null }
    try {
      guard = await callApi('login-guard', { action: 'check', identifier: id }, false)
    } catch (err) {
      return err instanceof ApiError
        ? { ok: false, reason: 'invalid', attemptsLeft: MAX_FAILED_ATTEMPTS }
        : { ok: false, reason: 'offline' }
    }
    if (guard.lockedUntil) return { ok: false, reason: 'locked', lockedUntil: new Date(guard.lockedUntil).getTime() }

    const registerFailure = async (): Promise<SignInResult> => {
      const r = await callApi<{ fails: number; lockedUntil: string | null }>(
        'login-guard',
        { action: 'fail', identifier: guard.email ?? id },
        false,
      ).catch(() => ({ fails: 1, lockedUntil: null }))
      if (r.lockedUntil) return { ok: false, reason: 'locked', lockedUntil: new Date(r.lockedUntil).getTime() }
      return { ok: false, reason: 'invalid', attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - r.fails) }
    }

    if (!guard.email) return registerFailure()
    let result
    try {
      result = await neon.auth.signIn.email({ email: guard.email, password })
    } catch {
      return { ok: false, reason: 'offline' }
    }
    if (result.error) {
      if (result.error.code === 'BANNED_USER' || /banned/i.test(result.error.message ?? '')) {
        return { ok: false, reason: 'inactive' }
      }
      if (!result.error.status) return { ok: false, reason: 'offline' }
      return registerFailure()
    }

    const profile = await loadProfile(result.data.user.id).catch(() => null)
    if (!profile?.isActive) {
      await neon.auth.signOut().catch(() => {})
      return { ok: false, reason: 'inactive' }
    }
    writeJSON(REMEMBER_KEY, remember)
    writeJSON(TAB_KEY, true, 'session')
    await callApi('login-guard', { action: 'clear', identifier: guard.email }).catch(() => {})
    await neon.rpc('log_session_event', { p_action: 'login', p_details: {} })
    return { ok: true, user: profile }
  },

  async signOut(reason) {
    try {
      await neon.rpc('log_session_event', { p_action: 'logout', p_details: { reason } })
    } catch {
      /* offline: still sign out locally */
    }
    remove(TAB_KEY, 'session')
    await neon.auth.signOut().catch(() => {})
  },

  async requestPasswordReset(email) {
    await neon.auth.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` })
  },

  async completePasswordReset(token, newPassword) {
    const { error } = await neon.auth.resetPassword({ token, newPassword })
    if (error) throw new ApiError(error.message ?? 'The reset link has expired. Request a new one.', 'invalid')
  },

  async changePassword(currentPassword, newPassword) {
    const { error } = await neon.auth.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
    if (error) {
      const wrong = /invalid password|incorrect/i.test(error.message ?? '')
      throw new ApiError(
        wrong ? 'Your current password is not correct.' : (error.message ?? 'Could not change password.'),
        'invalid',
      )
    }
    unwrap(await neon.rpc('complete_password_change'))
  },

  async getReferenceData() {
    const [projects, unitTypes, sources, team, settings] = await Promise.all([
      neon.from('projects').select('*').is('deleted_at', null).order('sort_order'),
      neon.from('unit_types').select('*').is('deleted_at', null).order('sort_order'),
      neon.from('lead_sources').select('*').is('deleted_at', null).order('sort_order'),
      neon.from('team_members').select('*').order('full_name'),
      neon.from('app_settings').select('*').eq('id', 1).single(),
    ])
    return {
      projects: unwrap<Row[]>(projects).map(toProject),
      unitTypes: unwrap<Row[]>(unitTypes).map(toUnitType),
      sources: unwrap<Row[]>(sources).map(toSource),
      team: unwrap<Row[]>(team).map(toMember),
      settings: toSettings(unwrap<Row>(settings)),
    }
  },

  async createWalkIn(input) {
    // ON CONFLICT DO NOTHING on the client-generated id makes offline retries safe.
    const res = await neon.from('walk_ins').upsert(
      {
        id: input.id,
        visited_at: input.visitedAt,
        full_name: input.fullName,
        phone: input.phone,
        email: input.email,
        visit_type: input.visitType,
        project_id: input.projectId,
        unit_type_id: input.unitTypeId,
        source_id: input.sourceId,
        sales_person_id: input.salesPersonId,
        other_source_text: input.otherSourceText,
        host_id: input.hostId,
        host_name: input.hostName,
        organisation: input.organisation,
        purpose: input.purpose,
        notes: input.notes,
        consent: input.consent,
        is_returning: input.isReturning,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (res.error) fail(res.error)
    return toWalkIn(unwrap<Row>(await neon.from('walk_in_rows').select('*').eq('id', input.id).single()))
  },

  async updateWalkIn(id, patch) {
    const rows = unwrap<Row[]>(
      await neon.from('walk_ins').update(toColumns(patch, WALK_IN_COLUMNS)).eq('id', id).select('id'),
    )
    if (!rows.length) throw new ApiError('This record can no longer be edited.', 'forbidden')
    return toWalkIn(unwrap<Row>(await neon.from('walk_in_rows').select('*').eq('id', id).single()))
  },

  async deleteWalkIn(id, reason) {
    const rows = unwrap<Row[]>(
      await neon
        .from('walk_ins')
        .update({ deleted_at: nowIso(), delete_reason: reason.trim() })
        .eq('id', id)
        .select('id'),
    )
    if (!rows.length) throw new ApiError('Only an admin can delete records.', 'forbidden')
  },

  async getWalkIn(id) {
    const row = unwrap<Row | null>(await neon.from('walk_in_rows').select('*').eq('id', id).maybeSingle())
    return row ? toWalkIn(row) : null
  },

  async listWalkIns(filters, page, pageSize) {
    const q = applyFilters(neon.from('walk_in_rows').select('*', { count: 'exact' }), filters)
    const res = await q.order('visited_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1)
    if (res.error) fail(res.error)
    return { rows: (res.data as Row[]).map(toWalkIn), total: res.count ?? 0 }
  },

  async queryWalkIns(filters) {
    // The Data API caps response size, so page through.
    const out: WalkIn[] = []
    const size = 1000
    for (let page = 0; page < 100; page++) {
      const q = applyFilters(neon.from('walk_in_rows').select('*'), filters)
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
    const rows = unwrap<Row[]>(
      await neon
        .from('walk_in_rows')
        .select('*')
        .is('deleted_at', null)
        .or(ors)
        .order('visited_at', { ascending: false })
        .limit(1),
    )
    return rows.length ? toWalkIn(rows[0]) : null
  },

  async countToday() {
    const today = todayKey()
    const res = await neon
      .from('walk_ins')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('visited_at', eatDayStart(today).toISOString())
      .lt('visited_at', eatDayEnd(today).toISOString())
    if (res.error) fail(res.error)
    return res.count ?? 0
  },

  async listNotifications(walkInId) {
    return unwrap<Row[]>(await neon.from('notifications').select('*').eq('walk_in_id', walkInId).order('channel')).map(
      toNotification,
    )
  },

  async dispatchNotifications(walkInId) {
    const data = await callApi<{ notifications: Row[] }>('notify', { walk_in_id: walkInId })
    return data.notifications.map(toNotification)
  },

  async resendNotification(id) {
    const data = await callApi<{ notifications: Row[] }>('notify', { notification_id: id, resend: true })
    const row = data.notifications.find((n) => n.id === id)
    if (!row) throw new ApiError('Notification not found.', 'not_found')
    return toNotification(row)
  },

  async getNotificationSetup() {
    const data = await callApi<{
      setup: { email: boolean; whatsapp: boolean; email_provider: string; whatsapp_provider: string }
    }>('notify', { check: true })
    return {
      email: data.setup.email,
      whatsapp: data.setup.whatsapp,
      emailProvider: data.setup.email_provider,
      whatsappProvider: data.setup.whatsapp_provider,
    }
  },

  async createTeamMember(input) {
    const res = await neon.from('team_members').upsert(
      {
        id: input.id,
        full_name: input.fullName,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        title: input.title,
        branch: input.branch,
        is_sales_person: input.isSalesPerson,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (res.error) fail(res.error)
    return toMember(unwrap<Row>(await neon.from('team_members').select('*').eq('id', input.id).single()))
  },

  async updateTeamMember(id, patch) {
    return toMember(
      unwrap<Row>(
        await neon.from('team_members').update(toColumns(patch, MEMBER_COLUMNS)).eq('id', id).select('*').single(),
      ),
    )
  },

  async saveProject({ id, name, isActive }) {
    const values = { name, is_active: isActive }
    const res = id
      ? await neon.from('projects').update(values).eq('id', id).select('*').single()
      : await neon.from('projects').insert(values).select('*').single()
    return toProject(unwrap<Row>(res))
  },

  async deleteProject(id) {
    unwrap(await neon.from('projects').update({ deleted_at: nowIso(), is_active: false }).eq('id', id).select('id'))
  },

  async saveUnitType({ id, name, projectId, isActive }) {
    const res = id
      ? await neon.from('unit_types').update({ name, is_active: isActive }).eq('id', id).select('*').single()
      : await neon.from('unit_types').insert({ name, project_id: projectId, is_active: isActive }).select('*').single()
    return toUnitType(unwrap<Row>(res))
  },

  async deleteUnitType(id) {
    unwrap(await neon.from('unit_types').update({ deleted_at: nowIso(), is_active: false }).eq('id', id).select('id'))
  },

  async saveSource({ id, name, icon, kind, isActive }) {
    const values = { name, icon, kind, is_active: isActive }
    const res = id
      ? await neon.from('lead_sources').update(values).eq('id', id).select('*').single()
      : await neon.from('lead_sources').insert(values).select('*').single()
    return toSource(unwrap<Row>(res))
  },

  async deleteSource(id) {
    unwrap(await neon.from('lead_sources').update({ deleted_at: nowIso(), is_active: false }).eq('id', id).select('id'))
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
    return toSettings(
      unwrap<Row>(await neon.from('app_settings').update(toColumns(patch, map)).eq('id', 1).select('*').single()),
    )
  },

  async listUsers() {
    return unwrap<Row[]>(await neon.from('profiles').select('*').order('created_at')).map(toProfile)
  },

  // User accounts live in Neon Auth; the profile row (role, active flag) lives in our database and
  // is what RLS checks. Admin APIs act through the signed-in admin's own session.
  async createUser(input) {
    const email = input.email.trim().toLowerCase()
    const username = input.username.trim().toLowerCase()
    const { data: taken } = await neon
      .from('profiles')
      .select('id')
      .or(`email.eq.${email},username.eq.${username}`)
      .limit(1)
    if (taken?.length) throw new ApiError('That email or username is already in use.', 'conflict')

    const created = await neon.auth.admin.createUser({
      email,
      password: input.password,
      name: input.name.trim(),
      role: input.role === 'admin' ? 'admin' : 'user',
    })
    if (created.error || !created.data)
      throw new ApiError(created.error?.message ?? 'Could not create the account.', 'invalid')
    const userId = created.data.user.id
    const res = await neon
      .from('profiles')
      .insert({
        id: userId,
        name: input.name.trim(),
        email,
        username,
        role: input.role,
        title: input.role === 'admin' ? 'Admin' : 'Receptionist',
        must_change_password: true,
      })
      .select('*')
      .single()
    if (res.error) {
      await neon.auth.admin.removeUser({ userId }).catch(() => {}) // keep auth and profiles in step
      fail(res.error)
    }
    return toProfile(res.data as Row)
  },

  async updateUser(id, patch) {
    const map = { isActive: 'is_active' }
    const profile = toProfile(
      unwrap<Row>(await neon.from('profiles').update(toColumns(patch, map)).eq('id', id).select('*').single()),
    )
    // Keep Neon Auth in step: admins need the auth "admin" role for user management, and a ban
    // stops a deactivated user signing in (RLS already blocks their data access).
    if (patch.role) await neon.auth.admin.setRole({ userId: id, role: patch.role === 'admin' ? 'admin' : 'user' })
    if (patch.isActive === false) {
      await neon.auth.admin.banUser({ userId: id, banReason: 'Deactivated in Ivy Hub' })
      await neon.auth.admin.revokeUserSessions({ userId: id })
    }
    if (patch.isActive === true) await neon.auth.admin.unbanUser({ userId: id })
    return profile
  },

  async resetPassword(id, newPassword) {
    const { error } = await neon.auth.admin.setUserPassword({ userId: id, newPassword })
    if (error) throw new ApiError(error.message ?? 'Could not reset the password.', 'invalid')
    // Forces a new password at next sign-in, clears any lockout and writes the audit entry.
    unwrap(await neon.rpc('admin_mark_password_reset', { p_user_id: id }))
    await neon.auth.admin.revokeUserSessions({ userId: id }).catch(() => {})
  },

  async listActivity(filters, page, pageSize) {
    let q = neon.from('activity_log').select('*', { count: 'exact' })
    if (filters.userId) q = q.eq('user_id', filters.userId)
    if (filters.action) q = q.eq('action', filters.action)
    if (filters.from) q = q.gte('created_at', eatDayStart(filters.from).toISOString())
    if (filters.to) q = q.lt('created_at', eatDayEnd(filters.to).toISOString())
    const res = await q.order('created_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1)
    if (res.error) fail(res.error)
    return { rows: (res.data as Row[]).map(toActivity), total: res.count ?? 0 }
  },

  async logExport(meta) {
    unwrap(await neon.rpc('log_export', { p_format: meta.format, p_filters: meta.filters, p_row_count: meta.rowCount }))
  },
}
