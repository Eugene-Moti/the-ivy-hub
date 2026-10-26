import { TIMEZONE } from './config'

// Africa/Nairobi is UTC+3 all year (no DST), so day boundaries can use a fixed offset.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export interface EatParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  /** ISO weekday: 1 = Monday … 7 = Sunday */
  weekday: number
}

export function eatParts(date: Date | string): EatParts {
  const t = new Date(new Date(date).getTime() + EAT_OFFSET_MS)
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    weekday: ((t.getUTCDay() + 6) % 7) + 1,
  }
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** 'YYYY-MM-DD' of the given instant, in Nairobi. */
export function eatDateKey(date: Date | string = new Date()): string {
  const p = eatParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

export const todayKey = () => eatDateKey(new Date())

/** UTC instant of 00:00 EAT on the given day. */
export function eatDayStart(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) - EAT_OFFSET_MS)
}

/** UTC instant of 00:00 EAT on the following day (exclusive end). */
export function eatDayEnd(key: string): Date {
  return new Date(eatDayStart(key).getTime() + DAY_MS)
}

export function addDays(key: string, days: number): string {
  return eatDateKey(new Date(eatDayStart(key).getTime() + days * DAY_MS))
}

export function weekdayOf(key: string): number {
  return eatParts(eatDayStart(key)).weekday
}

export function startOfWeek(key: string): string {
  return addDays(key, 1 - weekdayOf(key))
}

export function startOfMonth(key: string): string {
  return `${key.slice(0, 8)}01`
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((eatDayStart(toKey).getTime() - eatDayStart(fromKey).getTime()) / DAY_MS)
}

/** 'YYYYMMDD' for reference numbers. */
export const compactDate = (date: Date | string) => eatDateKey(date).replaceAll('-', '')

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-KE', { timeZone: TIMEZONE, ...opts })
const dateFmt = fmt({ day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = fmt({ hour: '2-digit', minute: '2-digit', hour12: false })
const dayMonthFmt = fmt({ day: 'numeric', month: 'short' })
const longDateFmt = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export const formatDate = (iso: string | Date) => dateFmt.format(new Date(iso))
export const formatTime = (iso: string | Date) => timeFmt.format(new Date(iso))
export const formatDateTime = (iso: string | Date) => `${formatDate(iso)}, ${formatTime(iso)}`
export const formatDayMonth = (iso: string | Date) => dayMonthFmt.format(new Date(iso))
export const formatLongDate = (iso: string | Date) => longDateFmt.format(new Date(iso))

/** "HH:MM" → minutes after midnight */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return formatDate(iso)
}
