/** Fallback until settings load; the live company name is editable in Admin → Settings. */
export const DEFAULT_COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME?.trim() || 'The Ivy Group'
export const TIMEZONE = 'Africa/Nairobi'

/** Sign the user out after this long without any input. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000
/** Failed sign-ins allowed before the account is locked. */
export const MAX_FAILED_ATTEMPTS = 5
export const LOCKOUT_MS = 15 * 60 * 1000

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || ''
/** Demo mode runs entirely in the browser on seeded data. It switches off once Supabase is configured. */
export const IS_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY
