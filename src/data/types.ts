export type Role = 'admin' | 'receptionist'

export interface Profile {
  id: string
  name: string
  email: string
  username: string
  role: Role
  title: string
  isActive: boolean
  /** Set for seeded accounts and after an admin reset: the user must choose a new password at sign-in. */
  mustChangePassword: boolean
  createdAt: string
}

export interface Project {
  id: string
  name: string
  isActive: boolean
  sortOrder: number
}

export interface UnitType {
  id: string
  projectId: string
  name: string
  isActive: boolean
  sortOrder: number
}

/** "sales_person" reveals the sales-person picker; "other" reveals a free-text field. */
export type SourceKind = 'standard' | 'sales_person' | 'other'

export interface LeadSource {
  id: string
  name: string
  icon: string
  kind: SourceKind
  isActive: boolean
  sortOrder: number
}

/** Anyone a visitor can come to see. Sales persons are the members who can be assigned clients. */
export interface TeamMember {
  id: string
  fullName: string
  phone: string
  whatsapp: string
  email: string
  /** Job title, e.g. "Sales Executive", "CEO", "Accounts" */
  title: string | null
  branch: string | null
  isSalesPerson: boolean
  isActive: boolean
  createdBy: string | null
  createdAt: string
}

/** Why someone walked in. Only "client" visits count towards marketing reports. */
export type VisitType = 'client' | 'meeting' | 'delivery' | 'interview' | 'other'

export interface AppSettings {
  companyName: string
  /** Receptionists may edit their own records for this many hours after creating them. */
  editWindowHours: number
  receptionistCanExport: boolean
  /** ISO weekdays the office is open: 1 = Monday … 7 = Sunday */
  workingDays: number[]
  /** "HH:MM", Nairobi time */
  openTime: string
  closeTime: string
}

export interface WalkIn {
  id: string
  reference: string | null
  visitedAt: string
  fullName: string
  phone: string
  email: string | null
  visitType: VisitType
  /** Client visits only */
  projectId: string | null
  unitTypeId: string | null
  sourceId: string | null
  salesPersonId: string | null
  otherSourceText: string | null
  /** Other visits: the team member they came to see, or a free-text name when not listed */
  hostId: string | null
  hostName: string | null
  organisation: string | null
  purpose: string | null
  notes: string | null
  consent: boolean
  isReturning: boolean
  createdBy: string
  createdByName: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  deleteReason: string | null
}

/** What the walk-in form submits. The id is generated on the client so offline retries never duplicate. */
export type WalkInDetails = Pick<
  WalkIn,
  | 'fullName'
  | 'phone'
  | 'email'
  | 'visitType'
  | 'projectId'
  | 'unitTypeId'
  | 'sourceId'
  | 'salesPersonId'
  | 'otherSourceText'
  | 'hostId'
  | 'hostName'
  | 'organisation'
  | 'purpose'
  | 'notes'
>

export interface NewWalkIn extends WalkInDetails {
  id: string
  visitedAt: string
  consent: boolean
  isReturning: boolean
}

export type WalkInPatch = Partial<WalkInDetails>

export type NewTeamMember = Pick<
  TeamMember,
  'id' | 'fullName' | 'phone' | 'whatsapp' | 'email' | 'title' | 'branch' | 'isSalesPerson'
>

export type NotificationChannel = 'email' | 'whatsapp'
export type NotificationStatus = 'queued' | 'sent' | 'failed' | 'pending_setup'

export interface WalkInNotification {
  id: string
  walkInId: string
  /** The team member being told: the sales person (client visits) or the host (other visits) */
  recipientId: string
  channel: NotificationChannel
  status: NotificationStatus
  error: string | null
  attempts: number
  sentAt: string | null
  createdAt: string
}

export const ACTIVITY_ACTIONS = [
  'login',
  'logout',
  'failed_login',
  'walk_in_created',
  'walk_in_edited',
  'walk_in_deleted',
  'team_member_added',
  'team_member_edited',
  'settings_changed',
  'user_created',
  'user_updated',
  'user_deactivated',
  'password_reset',
  'data_exported',
  'notification_sent',
  'notification_failed',
  'notification_pending_setup',
] as const
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]

export interface ActivityEntry {
  id: string
  userId: string | null
  userName: string | null
  action: ActivityAction
  entity: string | null
  entityId: string | null
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  createdAt: string
}

export interface ReferenceData {
  projects: Project[]
  unitTypes: UnitType[]
  sources: LeadSource[]
  team: TeamMember[]
  settings: AppSettings
}

export interface WalkInFilters {
  search?: string
  /** Inclusive 'YYYY-MM-DD' (Nairobi) */
  from?: string
  to?: string
  visitType?: VisitType
  projectId?: string
  unitTypeId?: string
  sourceId?: string
  salesPersonId?: string
  includeDeleted?: boolean
}

export interface ActivityFilters {
  userId?: string
  action?: ActivityAction
  from?: string
  to?: string
}

export interface Page<T> {
  rows: T[]
  total: number
}

export interface ExportMeta {
  format: 'csv' | 'xlsx'
  filters: WalkInFilters
  rowCount: number
}

export interface NewUser {
  name: string
  email: string
  username: string
  role: Role
  password: string
}
