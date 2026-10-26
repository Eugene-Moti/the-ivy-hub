import { clearFailures, getLock, recordFailure } from '../../auth/lockout'
import type { SignInResult } from '../../auth/types'
import { MAX_FAILED_ATTEMPTS } from '../../lib/config'
import { uuid } from '../../lib/ids'
import { normalisePhone } from '../../lib/phone'
import { readJSON, remove, writeJSON } from '../../lib/storage'
import { compactDate, eatDateKey, todayKey } from '../../lib/time'
import { ApiError, type Api } from '../api'
import { matchesFilters, sortByVisitDesc, walkInDiff } from '../walkInUtils'
import type { ActivityAction, ActivityEntry, Profile, WalkIn, WalkInNotification } from '../types'
import { createSeed, DEMO_DB_VERSION, type DemoDb, type DemoUser } from './seed'

// In-browser stand-in for the Supabase backend. It applies the same rules the database enforces
// (roles, edit window, soft deletes, audit trail) so the UI behaves the same in both modes.

const DB_KEY = 'ivy.demo.db'
const SESSION_KEY = 'ivy.demo.session'
const NOTIFY_MODE_KEY = 'ivy.demo.notifyMode'
const MAX_ACTIVITY = 3000

export type DemoNotifyMode = 'sent' | 'pending_setup' | 'failed'
export const getDemoNotifyMode = (): DemoNotifyMode => readJSON<DemoNotifyMode>(NOTIFY_MODE_KEY) ?? 'sent'
export const setDemoNotifyMode = (mode: DemoNotifyMode) => writeJSON(NOTIFY_MODE_KEY, mode)

let memoryDb: DemoDb | null = null

function load(): DemoDb {
  const stored = readJSON<DemoDb>(DB_KEY)
  if (stored && stored.version === DEMO_DB_VERSION) return (memoryDb = stored)
  if (memoryDb) return memoryDb
  memoryDb = createSeed()
  save(memoryDb)
  return memoryDb
}

function save(db: DemoDb) {
  memoryDb = db
  writeJSON(DB_KEY, db)
}

const wait = (min = 150, max = 400) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)))
const nowIso = () => new Date().toISOString()

function toProfile(u: DemoUser): Profile {
  const { password: _password, ...profile } = u
  return profile
}

function sessionUserId(): string | null {
  return readJSON<string>(SESSION_KEY, 'local') ?? readJSON<string>(SESSION_KEY, 'session')
}

function actor(db: DemoDb): DemoUser {
  const id = sessionUserId()
  const user = db.users.find((u) => u.id === id && u.isActive)
  if (!user) throw new ApiError('Your session has ended. Please sign in again.', 'forbidden')
  return user
}

function requireAdmin(db: DemoDb): DemoUser {
  const user = actor(db)
  if (user.role !== 'admin') throw new ApiError('Only an admin can do that.', 'forbidden')
  return user
}

function log(
  db: DemoDb,
  user: Pick<Profile, 'id' | 'name'> | null,
  action: ActivityAction,
  entity: string | null,
  entityId: string | null,
  oldValues: Record<string, unknown> | null = null,
  newValues: Record<string, unknown> | null = null,
) {
  const entry: ActivityEntry = {
    id: uuid(),
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    action,
    entity,
    entityId,
    oldValues,
    newValues,
    createdAt: nowIso(),
  }
  db.activity.unshift(entry)
  if (db.activity.length > MAX_ACTIVITY) db.activity.length = MAX_ACTIVITY
}

function withName(db: DemoDb, w: WalkIn): WalkIn {
  return { ...w, createdByName: db.users.find((u) => u.id === w.createdBy)?.name ?? w.createdByName }
}

function nextReference(db: DemoDb, visitedAt: string): string {
  const prefix = `IVY-${compactDate(visitedAt)}-`
  const max = db.walkIns
    .filter((w) => w.reference?.startsWith(prefix))
    .reduce((m, w) => Math.max(m, Number(w.reference!.slice(prefix.length)) || 0), 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

const NOTIFY_ERRORS: Record<DemoNotifyMode, Record<'email' | 'whatsapp', string | null>> = {
  sent: { email: null, whatsapp: null },
  pending_setup: {
    email: 'Email provider not configured (set RESEND_API_KEY)',
    whatsapp: 'WhatsApp provider not configured (set WHATSAPP_TOKEN)',
  },
  failed: { email: 'Simulated failure: provider timed out', whatsapp: 'Simulated failure: recipient not on WhatsApp' },
}

function deliver(db: DemoDb, n: WalkInNotification, user: Pick<Profile, 'id' | 'name'> | null) {
  const mode = getDemoNotifyMode()
  n.attempts += mode === 'failed' ? 3 : 1
  n.error = NOTIFY_ERRORS[mode][n.channel]
  if (mode === 'sent') {
    n.status = 'sent'
    n.sentAt = nowIso()
  } else {
    n.status = mode
  }
  const action: ActivityAction =
    mode === 'sent' ? 'notification_sent' : mode === 'failed' ? 'notification_failed' : 'notification_pending_setup'
  log(db, user, action, 'notification', n.id, null, { channel: n.channel, walk_in_id: n.walkInId, error: n.error })
}

export const demoApi: Api = {
  mode: 'demo',

  async restoreSession() {
    const db = load()
    const id = sessionUserId()
    const user = db.users.find((u) => u.id === id && u.isActive)
    return user ? toProfile(user) : null
  },

  async signIn(identifier, password, remember): Promise<SignInResult> {
    const lock = getLock(identifier)
    if (lock.lockedUntil) return { ok: false, reason: 'locked', lockedUntil: lock.lockedUntil }
    await wait(700, 1100)
    const db = load()
    const id = identifier.trim().toLowerCase()
    const user = db.users.find((u) => u.email.toLowerCase() === id || u.username.toLowerCase() === id)
    if (!user || user.password !== password) {
      const entry = recordFailure(identifier)
      log(db, user ? { id: user.id, name: user.name } : null, 'failed_login', 'session', null, null, { identifier: id })
      save(db)
      if (entry.lockedUntil) return { ok: false, reason: 'locked', lockedUntil: entry.lockedUntil }
      return { ok: false, reason: 'invalid', attemptsLeft: MAX_FAILED_ATTEMPTS - entry.fails }
    }
    if (!user.isActive) return { ok: false, reason: 'inactive' }
    clearFailures(identifier)
    remove(SESSION_KEY, 'local')
    remove(SESSION_KEY, 'session')
    writeJSON(SESSION_KEY, user.id, remember ? 'local' : 'session')
    log(db, user, 'login', 'session', null)
    save(db)
    return { ok: true, user: toProfile(user) }
  },

  async signOut(reason) {
    const db = load()
    const id = sessionUserId()
    const user = db.users.find((u) => u.id === id)
    if (user) {
      log(db, user, 'logout', 'session', null, null, { reason })
      save(db)
    }
    remove(SESSION_KEY, 'local')
    remove(SESSION_KEY, 'session')
  },

  async requestPasswordReset() {
    await wait(700, 1000)
  },

  async getReferenceData() {
    await wait(200, 450)
    const db = load()
    actor(db)
    return {
      projects: db.projects.filter((p) => !p.deletedAt),
      unitTypes: db.unitTypes.filter((u) => !u.deletedAt),
      sources: db.sources.filter((s) => !s.deletedAt),
      salesPersons: db.salesPersons,
      settings: db.settings,
    }
  },

  async createWalkIn(input) {
    await wait(350, 700)
    const db = load()
    const user = actor(db)
    const existing = db.walkIns.find((w) => w.id === input.id)
    if (existing) return withName(db, existing)
    if (!input.consent) throw new ApiError('Client consent is required.', 'invalid')
    const now = nowIso()
    const walkIn: WalkIn = {
      ...input,
      reference: nextReference(db, input.visitedAt),
      createdBy: user.id,
      createdByName: user.name,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deleteReason: null,
    }
    db.walkIns.push(walkIn)
    const source = db.sources.find((s) => s.id === input.sourceId)
    if (source?.kind === 'sales_person' && input.salesPersonId) {
      for (const channel of ['email', 'whatsapp'] as const) {
        db.notifications.push({
          id: uuid(),
          walkInId: walkIn.id,
          salesPersonId: input.salesPersonId,
          channel,
          status: 'queued',
          error: null,
          attempts: 0,
          sentAt: null,
          createdAt: now,
        })
      }
    }
    log(db, user, 'walk_in_created', 'walk_in', walkIn.id, null, {
      reference: walkIn.reference,
      full_name: walkIn.fullName,
      visited_at: walkIn.visitedAt,
    })
    save(db)
    return walkIn
  },

  async updateWalkIn(id, patch) {
    await wait()
    const db = load()
    const user = actor(db)
    const w = db.walkIns.find((x) => x.id === id && !x.deletedAt)
    if (!w) throw new ApiError('Record not found.', 'not_found')
    if (user.role !== 'admin') {
      const ageHours = (Date.now() - new Date(w.createdAt).getTime()) / 3600_000
      if (w.createdBy !== user.id || ageHours > db.settings.editWindowHours) {
        throw new ApiError(
          `You can only edit your own records within ${db.settings.editWindowHours} hours.`,
          'forbidden',
        )
      }
    }
    const before = { ...w }
    Object.assign(w, patch, { updatedAt: nowIso() })
    const { oldValues, newValues } = walkInDiff(before, w)
    if (Object.keys(newValues).length) {
      log(db, user, 'walk_in_edited', 'walk_in', id, { reference: w.reference, ...oldValues }, newValues)
    }
    save(db)
    return withName(db, w)
  },

  async deleteWalkIn(id, reason) {
    await wait()
    const db = load()
    const user = requireAdmin(db)
    if (!reason.trim()) throw new ApiError('A reason is required.', 'invalid')
    const w = db.walkIns.find((x) => x.id === id && !x.deletedAt)
    if (!w) throw new ApiError('Record not found.', 'not_found')
    w.deletedAt = nowIso()
    w.deleteReason = reason.trim()
    log(
      db,
      user,
      'walk_in_deleted',
      'walk_in',
      id,
      { reference: w.reference, full_name: w.fullName },
      { delete_reason: w.deleteReason },
    )
    save(db)
  },

  async getWalkIn(id) {
    await wait(100, 250)
    const db = load()
    actor(db)
    const w = db.walkIns.find((x) => x.id === id)
    return w ? withName(db, w) : null
  },

  async listWalkIns(filters, page, pageSize) {
    await wait(250, 550)
    const db = load()
    const user = actor(db)
    const f = { ...filters, includeDeleted: user.role === 'admin' && filters.includeDeleted }
    const rows = sortByVisitDesc(db.walkIns.filter((w) => matchesFilters(w, f)))
    return {
      rows: rows.slice(page * pageSize, page * pageSize + pageSize).map((w) => withName(db, w)),
      total: rows.length,
    }
  },

  async queryWalkIns(filters) {
    await wait(250, 500)
    const db = load()
    const user = actor(db)
    const f = { ...filters, includeDeleted: user.role === 'admin' && filters.includeDeleted }
    return sortByVisitDesc(db.walkIns.filter((w) => matchesFilters(w, f))).map((w) => withName(db, w))
  },

  async findReturning(phone, email) {
    await wait(120, 260)
    const db = load()
    actor(db)
    const p = phone ? normalisePhone(phone) : null
    const e = email?.trim().toLowerCase() || null
    if (!p && !e) return null
    const match = sortByVisitDesc(
      db.walkIns.filter((w) => !w.deletedAt && ((p && w.phone === p) || (e && w.email?.toLowerCase() === e))),
    )[0]
    return match ? withName(db, match) : null
  },

  async countToday() {
    const db = load()
    actor(db)
    const today = todayKey()
    return db.walkIns.filter((w) => !w.deletedAt && eatDateKey(w.visitedAt) === today).length
  },

  async listNotifications(walkInId) {
    await wait(80, 200)
    const db = load()
    actor(db)
    return db.notifications.filter((n) => n.walkInId === walkInId)
  },

  async dispatchNotifications(walkInId) {
    await wait(900, 1600)
    const db = load()
    const user = actor(db)
    const pending = db.notifications.filter(
      (n) => n.walkInId === walkInId && (n.status === 'queued' || (n.status === 'failed' && n.attempts < 3)),
    )
    for (const n of pending) deliver(db, n, user)
    save(db)
    return db.notifications.filter((n) => n.walkInId === walkInId)
  },

  async resendNotification(id) {
    await wait(800, 1400)
    const db = load()
    const user = actor(db)
    const n = db.notifications.find((x) => x.id === id)
    if (!n) throw new ApiError('Notification not found.', 'not_found')
    n.attempts = 0
    deliver(db, n, user)
    save(db)
    return n
  },

  async getNotificationSetup() {
    const ok = getDemoNotifyMode() !== 'pending_setup'
    return { email: ok, whatsapp: ok, emailProvider: 'Demo (simulated)', whatsappProvider: 'Demo (simulated)' }
  },

  async createSalesPerson(input) {
    await wait(300, 600)
    const db = load()
    const user = actor(db)
    const existing = db.salesPersons.find((s) => s.id === input.id)
    if (existing) return existing
    const person = { ...input, isActive: true, createdBy: user.id, createdAt: nowIso() }
    db.salesPersons.push(person)
    log(db, user, 'sales_person_added', 'sales_person', person.id, null, {
      full_name: person.fullName,
      phone: person.phone,
      whatsapp: person.whatsapp,
      email: person.email,
      team: person.team,
    })
    save(db)
    return person
  },

  async updateSalesPerson(id, patch) {
    await wait()
    const db = load()
    const user = requireAdmin(db)
    const person = db.salesPersons.find((s) => s.id === id)
    if (!person) throw new ApiError('Sales person not found.', 'not_found')
    const before = { ...person }
    Object.assign(person, patch)
    const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => before[k] !== person[k])
    if (changed.length) {
      log(
        db,
        user,
        'sales_person_edited',
        'sales_person',
        id,
        Object.fromEntries([['full_name', before.fullName], ...changed.map((k) => [k, before[k]])]),
        Object.fromEntries(changed.map((k) => [k, person[k]])),
      )
    }
    save(db)
    return person
  },

  async saveProject(input) {
    await wait()
    const db = load()
    const user = requireAdmin(db)
    if (input.id) {
      const p = db.projects.find((x) => x.id === input.id)
      if (!p) throw new ApiError('Project not found.', 'not_found')
      const before = { name: p.name, is_active: p.isActive }
      Object.assign(p, { name: input.name, isActive: input.isActive })
      log(db, user, 'settings_changed', 'project', p.id, before, { name: p.name, is_active: p.isActive })
      save(db)
      return p
    }
    const p = {
      id: uuid(),
      name: input.name,
      isActive: input.isActive,
      sortOrder: db.projects.length + 1,
      deletedAt: null,
    }
    db.projects.push(p)
    log(db, user, 'settings_changed', 'project', p.id, null, { name: p.name, is_active: p.isActive })
    save(db)
    return p
  },

  async deleteProject(id) {
    await wait()
    const db = load()
    const user = requireAdmin(db)
    const p = db.projects.find((x) => x.id === id)
    if (!p) throw new ApiError('Project not found.', 'not_found')
    p.deletedAt = nowIso()
    p.isActive = false
    log(db, user, 'settings_changed', 'project', id, { name: p.name }, { deleted: true })
    save(db)
  },

  async saveUnitType(input) {
    await wait()
    const db = load()
    const user = requireAdmin(db)
    if (input.id) {
      const u = db.unitTypes.find((x) => x.id === input.id)
      if (!u) throw new ApiError('Unit type not found.', 'not_found')
      const before = { name: u.name, is_active: u.isActive }
      Object.assign(u, { name: input.name, isActive: input.isActive })
      log(db, user, 'settings_changed', 'unit_type', u.id, before, { name: u.name, is_active: u.isActive })
      save(db)
      return u
    }
    const u = {
      id: uuid(),
      projectId: input.projectId,
      name: input.name,
      isActive: input.isActive,
      sortOrder: db.unitTypes.filter((x) => x.projectId === input.projectId).length + 1,
      deletedAt: null,
    }
    db.unitTypes.push(u)
    log(db, user, 'settings_changed', 'unit_type', u.id, null, { name: u.name, project_id: u.projectId })
    save(db)
    return u
  },

  async deleteUnitType(id) {
    await wait()
    const db = load()
    const user = requireAdmin(db)
    const u = db.unitTypes.find((x) => x.id === id)
    if (!u) throw new ApiError('Unit type not found.', 'not_found')
    u.deletedAt = nowIso()
    u.isActive = false
    log(db, user, 'settings_changed', 'unit_type', id, { name: u.name }, { deleted: true })
    save(db)
  },

  async saveSource(input) {
    await wait()
    const db = load()
    const user = requireAdmin(db)
    if (input.id) {
      const s = db.sources.find((x) => x.id === input.id)
      if (!s) throw new ApiError('Source not found.', 'not_found')
      const before = { name: s.name, icon: s.icon, kind: s.kind, is_active: s.isActive }
      Object.assign(s, { name: input.name, icon: input.icon, kind: input.kind, isActive: input.isActive })
      log(db, user, 'settings_changed', 'lead_source', s.id, before, {
        name: s.name,
        icon: s.icon,
        kind: s.kind,
        is_active: s.isActive,
      })
      save(db)
      return s
    }
    const created = {
      id: uuid(),
      name: input.name,
      icon: input.icon,
      kind: input.kind,
      isActive: input.isActive,
      sortOrder: db.sources.length + 1,
      deletedAt: null,
    }
    db.sources.push(created)
    log(db, user, 'settings_changed', 'lead_source', created.id, null, { name: created.name, kind: created.kind })
    save(db)
    return created
  },

  async deleteSource(id) {
    await wait()
    const db = load()
    const user = requireAdmin(db)
    const s = db.sources.find((x) => x.id === id)
    if (!s) throw new ApiError('Source not found.', 'not_found')
    s.deletedAt = nowIso()
    s.isActive = false
    log(db, user, 'settings_changed', 'lead_source', id, { name: s.name }, { deleted: true })
    save(db)
  },

  async updateSettings(patch) {
    await wait()
    const db = load()
    const user = requireAdmin(db)
    const before = db.settings
    db.settings = { ...db.settings, ...patch }
    const keys = (Object.keys(patch) as (keyof typeof patch)[]).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(db.settings[k]),
    )
    if (keys.length) {
      log(
        db,
        user,
        'settings_changed',
        'app_settings',
        null,
        Object.fromEntries(keys.map((k) => [k, before[k]])),
        Object.fromEntries(keys.map((k) => [k, db.settings[k]])),
      )
    }
    save(db)
    return db.settings
  },

  async listUsers() {
    await wait()
    const db = load()
    requireAdmin(db)
    return db.users.map(toProfile)
  },

  async createUser(input) {
    await wait(500, 800)
    const db = load()
    const admin = requireAdmin(db)
    const email = input.email.trim().toLowerCase()
    const username = input.username.trim().toLowerCase()
    if (db.users.some((u) => u.email.toLowerCase() === email))
      throw new ApiError('That email is already in use.', 'conflict')
    if (db.users.some((u) => u.username.toLowerCase() === username))
      throw new ApiError('That username is taken.', 'conflict')
    const user: DemoUser = {
      id: uuid(),
      name: input.name.trim(),
      email,
      username,
      role: input.role,
      title: input.role === 'admin' ? 'Admin' : 'Receptionist',
      isActive: true,
      createdAt: nowIso(),
      password: input.password,
    }
    db.users.push(user)
    log(db, admin, 'user_created', 'user', user.id, null, { name: user.name, email, username, role: user.role })
    save(db)
    return toProfile(user)
  },

  async updateUser(id, patch) {
    await wait()
    const db = load()
    const admin = requireAdmin(db)
    const user = db.users.find((u) => u.id === id)
    if (!user) throw new ApiError('User not found.', 'not_found')
    if (id === admin.id && (patch.isActive === false || (patch.role && patch.role !== 'admin'))) {
      throw new ApiError('You cannot deactivate or demote your own account.', 'forbidden')
    }
    const before = { ...user }
    Object.assign(user, patch)
    const keys = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => before[k] !== user[k])
    if (keys.length) {
      const deactivated = patch.isActive === false && before.isActive
      log(
        db,
        admin,
        deactivated ? 'user_deactivated' : 'user_updated',
        'user',
        id,
        Object.fromEntries([['name', before.name], ...keys.map((k) => [k, before[k]])]),
        Object.fromEntries(keys.map((k) => [k, user[k]])),
      )
    }
    save(db)
    return toProfile(user)
  },

  async resetPassword(id, newPassword) {
    await wait(500, 800)
    const db = load()
    const admin = requireAdmin(db)
    const user = db.users.find((u) => u.id === id)
    if (!user) throw new ApiError('User not found.', 'not_found')
    user.password = newPassword
    clearFailures(user.username)
    clearFailures(user.email)
    log(db, admin, 'password_reset', 'user', id, null, { name: user.name })
    save(db)
  },

  async listActivity(filters, page, pageSize) {
    await wait(250, 500)
    const db = load()
    requireAdmin(db)
    const rows = db.activity.filter((a) => {
      if (filters.userId && a.userId !== filters.userId) return false
      if (filters.action && a.action !== filters.action) return false
      const day = eatDateKey(a.createdAt)
      if (filters.from && day < filters.from) return false
      if (filters.to && day > filters.to) return false
      return true
    })
    return { rows: rows.slice(page * pageSize, page * pageSize + pageSize), total: rows.length }
  },

  async logExport(meta) {
    const db = load()
    const user = actor(db)
    if (user.role !== 'admin' && !db.settings.receptionistCanExport) {
      throw new ApiError('Only an admin can export records.', 'forbidden')
    }
    log(db, user, 'data_exported', 'walk_in', null, null, {
      format: meta.format,
      row_count: meta.rowCount,
      filters: meta.filters,
    })
    save(db)
  },
}

/** Wipes demo data back to the seed (Settings → General, demo mode only). */
export function resetDemoData() {
  memoryDb = null
  remove(DB_KEY)
}
