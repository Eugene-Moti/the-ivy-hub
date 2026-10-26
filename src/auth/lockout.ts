import { LOCKOUT_MS, MAX_FAILED_ATTEMPTS } from '../lib/config'
import { readJSON, writeJSON } from '../lib/storage'

// Client-side lockout for demo mode. With the Supabase backend this moves into the
// database so it cannot be bypassed by clearing browser storage.

interface Entry {
  fails: number
  lockedUntil: number | null
}

const KEY = 'ivy.lockout'
const normalise = (identifier: string) => identifier.trim().toLowerCase()

function load(): Record<string, Entry> {
  return readJSON<Record<string, Entry>>(KEY) ?? {}
}

export function getLock(identifier: string): Entry {
  const entry = load()[normalise(identifier)]
  if (!entry) return { fails: 0, lockedUntil: null }
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) return { fails: 0, lockedUntil: null }
  return entry
}

export function recordFailure(identifier: string): Entry {
  const all = load()
  const fails = getLock(identifier).fails + 1
  const next: Entry =
    fails >= MAX_FAILED_ATTEMPTS ? { fails, lockedUntil: Date.now() + LOCKOUT_MS } : { fails, lockedUntil: null }
  all[normalise(identifier)] = next
  writeJSON(KEY, all)
  return next
}

export function clearFailures(identifier: string) {
  const all = load()
  delete all[normalise(identifier)]
  writeJSON(KEY, all)
}
