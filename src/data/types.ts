export type Role = 'admin' | 'receptionist'

export interface Profile {
  id: string
  name: string
  email: string
  username: string
  role: Role
  title: string
  isActive: boolean
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

export interface SalesPerson {
  id: string
  fullName: string
  phone: string
  whatsapp: string
  email: string
  team: string | null
  isActive: boolean
  createdBy: string | null
  createdAt: string
}

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
  projectId: string
  unitTypeId: string
  sourceId: string
  salesPersonId: string | null
  otherSourceText: string | null
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
export interface NewWalkIn {
  id: string
  visitedAt: string
  fullName: string
  phone: string
  email: string | null
  projectId: string
  unitTypeId: string
  sourceId: string
  salesPersonId: string | null
  otherSourceText: string | null
  notes: string | null
  consent: boolean
  isReturning: boolean
}

export type WalkInPatch = Partial<
  Pick<
    WalkIn,
    | 'fullName'
    | 'phone'
    | 'email'
    | 'projectId'
    | 'unitTypeId'
    | 'sourceId'
    | 'salesPersonId'
    | 'otherSourceText'
    | 'notes'
  >
>

export interface NewSalesPerson {
  id: string
  fullName: string
  phone: string
  whatsapp: string
  email: string
  team: string | null
}

export type NotificationChannel = 'email' | 'whatsapp'
export type NotificationStatus = 'queued' | 'sent' | 'failed' | 'pending_setup'

export interface WalkInNotification {
  id: string
  walkInId: string
  salesPersonId: string
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
  'sales_person_added',
  'sales_person_edited',
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
  salesPersons: SalesPerson[]
  settings: AppSettings
}

export interface WalkInFilters {
  search?: string
  /** Inclusive 'YYYY-MM-DD' (Nairobi) */
  from?: string
  to?: string
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
