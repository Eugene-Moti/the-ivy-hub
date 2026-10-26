import type { SignInResult, SignOutReason } from '../auth/types'
import type {
  ActivityEntry,
  ActivityFilters,
  AppSettings,
  ExportMeta,
  LeadSource,
  NewTeamMember,
  NewUser,
  NewWalkIn,
  Page,
  Profile,
  Project,
  ReferenceData,
  TeamMember,
  UnitType,
  WalkIn,
  WalkInFilters,
  WalkInNotification,
  WalkInPatch,
} from './types'

/**
 * Everything the UI needs from the backend. Two implementations:
 * - demoApi: in-browser, seeded data (no backend needed; used until Supabase is configured)
 * - neonApi: Neon Postgres + Managed Better Auth + Data API (RLS) + Vercel functions in /api
 */
export interface Api {
  mode: 'demo' | 'live'

  // Auth
  restoreSession(): Promise<Profile | null>
  signIn(identifier: string, password: string, remember: boolean): Promise<SignInResult>
  signOut(reason: SignOutReason): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  /** Finish the emailed reset link flow (token comes from the link). */
  completePasswordReset(token: string, newPassword: string): Promise<void>
  /** Signed-in user changes their own password (also clears a forced change). */
  changePassword(currentPassword: string, newPassword: string): Promise<void>

  // Reference lists
  getReferenceData(): Promise<ReferenceData>

  // Walk-ins
  /** Idempotent on input.id: re-sending the same record (e.g. an offline retry) returns the existing row. */
  createWalkIn(input: NewWalkIn): Promise<WalkIn>
  updateWalkIn(id: string, patch: WalkInPatch): Promise<WalkIn>
  deleteWalkIn(id: string, reason: string): Promise<void>
  getWalkIn(id: string): Promise<WalkIn | null>
  listWalkIns(filters: WalkInFilters, page: number, pageSize: number): Promise<Page<WalkIn>>
  /** All rows matching the filters (for export and analytics). */
  queryWalkIns(filters: WalkInFilters): Promise<WalkIn[]>
  findReturning(phone: string | null, email: string | null): Promise<WalkIn | null>
  countToday(): Promise<number>

  // Sales-person notifications (sent by a backend function, never from the browser)
  listNotifications(walkInId: string): Promise<WalkInNotification[]>
  dispatchNotifications(walkInId: string): Promise<WalkInNotification[]>
  resendNotification(id: string): Promise<WalkInNotification>
  /** Which providers have keys configured on the server (keys themselves never reach the browser). */
  getNotificationSetup(): Promise<{
    email: boolean
    whatsapp: boolean
    emailProvider: string
    whatsappProvider: string
  }>

  // Team members (sales persons and other staff visitors can ask for)
  createTeamMember(input: NewTeamMember): Promise<TeamMember>
  updateTeamMember(id: string, patch: Partial<Omit<TeamMember, 'id' | 'createdBy' | 'createdAt'>>): Promise<TeamMember>

  // Admin-managed lists. "Delete" archives the row so history keeps its labels.
  saveProject(project: Pick<Project, 'name' | 'isActive'> & { id?: string }): Promise<Project>
  deleteProject(id: string): Promise<void>
  saveUnitType(unitType: Pick<UnitType, 'name' | 'projectId' | 'isActive'> & { id?: string }): Promise<UnitType>
  deleteUnitType(id: string): Promise<void>
  saveSource(source: Pick<LeadSource, 'name' | 'icon' | 'kind' | 'isActive'> & { id?: string }): Promise<LeadSource>
  deleteSource(id: string): Promise<void>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>

  // Users
  listUsers(): Promise<Profile[]>
  createUser(input: NewUser): Promise<Profile>
  updateUser(id: string, patch: Partial<Pick<Profile, 'name' | 'role' | 'title' | 'isActive'>>): Promise<Profile>
  resetPassword(id: string, newPassword: string): Promise<void>

  // Activity log (read-only; entries are written by the backend)
  listActivity(filters: ActivityFilters, page: number, pageSize: number): Promise<Page<ActivityEntry>>
  logExport(meta: ExportMeta): Promise<void>
}

/** Thrown for permission / validation problems that retrying will not fix. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: 'forbidden' | 'invalid' | 'not_found' | 'conflict' | 'unknown' = 'unknown',
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** True when the failure looks like a dropped connection rather than a server-side rejection. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (err instanceof TypeError) return true // fetch() network failure
  const msg = err instanceof Error ? err.message : String(err)
  return /failed to fetch|network|load failed|fetch failed|timeout/i.test(msg)
}
