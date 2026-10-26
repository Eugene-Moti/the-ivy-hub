import type { AppSettings, ReferenceData, WalkIn } from '../../data/types'
import {
  addDays,
  eatDateKey,
  eatDayStart,
  eatParts,
  minutesOf,
  startOfMonth,
  startOfWeek,
  weekdayOf,
} from '../../lib/time'

const countBy = <K extends string>(rows: WalkIn[], key: (w: WalkIn) => K | null) => {
  const m = new Map<K, number>()
  for (const w of rows) {
    const k = key(w)
    if (k !== null) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

export function inRange(rows: WalkIn[], from: string, to: string) {
  return rows.filter((w) => {
    const d = eatDateKey(w.visitedAt)
    return d >= from && d <= to
  })
}

/**
 * KPIs: period-to-date compared with the same span of the previous period, up to the same time of day,
 * so a half-finished day is never compared with a full one.
 */
export function kpis(rows: WalkIn[], today: string, now = new Date()) {
  const DAY = 86_400_000
  const t = now.getTime()
  const between = (from: number, to: number) =>
    rows.filter((w) => {
      const v = new Date(w.visitedAt).getTime()
      return v >= from && v <= to
    }).length
  const dayStart = eatDayStart(today).getTime()
  const weekStart = eatDayStart(startOfWeek(today)).getTime()
  const monthStart = eatDayStart(startOfMonth(today)).getTime()
  const prevMonthStart = eatDayStart(startOfMonth(addDays(startOfMonth(today), -1))).getTime()
  const prevMonthCut = Math.min(prevMonthStart + (t - monthStart), monthStart - 1)
  return {
    today: { value: between(dayStart, t), previous: between(dayStart - 7 * DAY, t - 7 * DAY) },
    week: { value: between(weekStart, t), previous: between(weekStart - 7 * DAY, t - 7 * DAY) },
    month: { value: between(monthStart, t), previous: between(prevMonthStart, prevMonthCut) },
  }
}

export interface Slice {
  id: string
  name: string
  value: number
}

/** Part-to-whole by source: top 5 named, the rest folded into "Other" (donuts stay ≤ 6 segments). */
export function bySource(rows: WalkIn[], ref: ReferenceData): { slices: Slice[]; all: Slice[] } {
  const counts = countBy(rows, (w) => w.sourceId as string | null)
  const all = [...counts.entries()]
    .map(([id, value]) => ({ id, name: ref.sources.find((s) => s.id === id)?.name ?? 'Unknown', value }))
    .sort((a, b) => b.value - a.value)
  if (all.length <= 6) return { slices: all, all }
  const top = all.slice(0, 5)
  const rest = all.slice(5).reduce((s, x) => s + x.value, 0)
  return { slices: [...top, { id: 'other', name: `Remaining ${all.length - 5} sources`, value: rest }], all }
}

export interface ProjectGroup {
  id: string
  name: string
  total: number
  units: { id: string; name: string; value: number }[]
}

export function byProjectUnit(rows: WalkIn[], ref: ReferenceData): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>()
  for (const w of rows) {
    if (!w.projectId || !w.unitTypeId) continue
    let g = groups.get(w.projectId)
    if (!g) {
      g = {
        id: w.projectId,
        name: ref.projects.find((p) => p.id === w.projectId)?.name ?? 'Archived project',
        total: 0,
        units: [],
      }
      groups.set(w.projectId, g)
    }
    g.total++
    let u = g.units.find((x) => x.id === w.unitTypeId)
    if (!u) {
      u = {
        id: w.unitTypeId,
        name: ref.unitTypes.find((x) => x.id === w.unitTypeId)?.name ?? 'Archived unit',
        value: 0,
      }
      g.units.push(u)
    }
    u.value++
  }
  return [...groups.values()]
    .map((g) => ({ ...g, units: g.units.sort((a, b) => b.value - a.value) }))
    .sort((a, b) => b.total - a.total)
}

export function topSalesPersons(rows: WalkIn[], ref: ReferenceData, limit = 8) {
  const counts = countBy(rows, (w) => w.salesPersonId)
  return [...counts.entries()]
    .map(([id, value]) => {
      const p = ref.team.find((s) => s.id === id)
      return { id, name: p?.fullName ?? 'Unknown', branch: p?.branch ?? null, value }
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

/** One point per day in range; non-working days only appear when someone walked in. */
export function dailyTrend(rows: WalkIn[], from: string, to: string, settings: AppSettings) {
  const counts = countBy(rows, (w) => eatDateKey(w.visitedAt))
  const out: { day: string; value: number }[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const value = counts.get(d) ?? 0
    if (settings.workingDays.includes(weekdayOf(d)) || value > 0) out.push({ day: d, value })
    if (out.length > 400) break
  }
  return out
}

/** Weekday × hour grid inside office hours, plus a count of visits outside them. */
export function heatmap(rows: WalkIn[], settings: AppSettings) {
  const openH = Math.floor(minutesOf(settings.openTime) / 60)
  const closeMin = minutesOf(settings.closeTime)
  const lastH = Math.floor((closeMin - 1) / 60)
  const hours = Array.from({ length: Math.max(1, lastH - openH + 1) }, (_, i) => openH + i)
  const days = [...settings.workingDays].sort()
  const cells = new Map<string, number>()
  let outside = 0
  for (const w of rows) {
    const p = eatParts(w.visitedAt)
    const minutes = p.hour * 60 + p.minute
    if (!days.includes(p.weekday) || minutes < minutesOf(settings.openTime) || minutes >= closeMin) {
      outside++
      continue
    }
    const k = `${p.weekday}-${p.hour}`
    cells.set(k, (cells.get(k) ?? 0) + 1)
  }
  const max = Math.max(0, ...cells.values())
  return { days, hours, cells, max, outside }
}

/** Walk-ins that were clients (marketing reports only count these). */
export const clientsOnly = (rows: WalkIn[]) => rows.filter((w) => w.visitType === 'client')

/** Non-client visits by type, most common first. */
export function otherVisits(rows: WalkIn[]) {
  const counts = countBy(rows, (w) => (w.visitType === 'client' ? null : w.visitType))
  return [...counts.entries()].map(([type, value]) => ({ type, value })).sort((a, b) => b.value - a.value)
}
