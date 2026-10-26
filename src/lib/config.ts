/** Fallback until settings load; the live company name is editable in Admin → Settings. */
export const DEFAULT_COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME?.trim() || 'The Ivy Group'
export const TIMEZONE = 'Africa/Nairobi'

/** Sign the user out after this long without any input. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000
/** Failed sign-ins allowed before the account is locked. */
export const MAX_FAILED_ATTEMPTS = 5
export const LOCKOUT_MS = 15 * 60 * 1000

// Neon: Managed Better Auth + Data API. Both URLs are public endpoints (not secrets), shown in the
// Neon Console under Better Auth → Configuration and Postgres database → Data API.
export const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL?.trim() || ''
export const NEON_DATA_API_URL = import.meta.env.VITE_NEON_DATA_API_URL?.trim() || ''
/** Demo mode runs entirely in the browser on seeded data. It switches off once Neon is configured. */
export const IS_DEMO = !NEON_AUTH_URL || !NEON_DATA_API_URL
