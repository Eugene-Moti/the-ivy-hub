import { eatDateKey } from '../lib/time'
import type { WalkIn, WalkInFilters } from './types'

/** Digits used for loose phone search: "0712 345" matches +254712345678. */
export function searchDigits(query: string): string | null {
  const d = query.replace(/\D/g, '')
  if (d.length < 3) return null
  return d.startsWith('0') ? `254${d.slice(1)}` : d
}

export function matchesFilters(w: WalkIn, f: WalkInFilters): boolean {
  if (w.deletedAt && !f.includeDeleted) return false
  if (f.projectId && w.projectId !== f.projectId) return false
  if (f.unitTypeId && w.unitTypeId !== f.unitTypeId) return false
  if (f.sourceId && w.sourceId !== f.sourceId) return false
  if (f.salesPersonId && w.salesPersonId !== f.salesPersonId) return false
  if (f.from || f.to) {
    const day = eatDateKey(w.visitedAt)
    if (f.from && day < f.from) return false
    if (f.to && day > f.to) return false
  }
  const q = f.search?.trim().toLowerCase()
  if (q) {
    const digits = searchDigits(q)
    const hit =
      w.fullName.toLowerCase().includes(q) ||
      (w.email?.toLowerCase().includes(q) ?? false) ||
      (w.reference?.toLowerCase().includes(q) ?? false) ||
      (digits !== null && w.phone.replace(/\D/g, '').includes(digits))
    if (!hit) return false
  }
  return true
}

export const sortByVisitDesc = (rows: WalkIn[]) => [...rows].sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))

const AUDITED: [keyof WalkIn, string][] = [
  ['fullName', 'full_name'],
  ['phone', 'phone'],
  ['email', 'email'],
  ['projectId', 'project_id'],
  ['unitTypeId', 'unit_type_id'],
  ['sourceId', 'source_id'],
  ['salesPersonId', 'sales_person_id'],
  ['otherSourceText', 'other_source_text'],
  ['notes', 'notes'],
]

/** Changed fields only, keyed like the database columns (matches what the audit trigger records). */
export function walkInDiff(before: WalkIn, after: WalkIn) {
  const oldValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}
  for (const [key, column] of AUDITED) {
    if ((before[key] ?? null) !== (after[key] ?? null)) {
      oldValues[column] = before[key] ?? null
      newValues[column] = after[key] ?? null
    }
  }
  return { oldValues, newValues }
}
