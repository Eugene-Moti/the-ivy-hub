// Browser storage can throw (private mode, blocked site data), so every access is guarded.

type Area = 'local' | 'session'

function area(which: Area): Storage | null {
  try {
    return which === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readJSON<T>(key: string, which: Area = 'local'): T | null {
  try {
    const raw = area(which)?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJSON(key: string, value: unknown, which: Area = 'local') {
  try {
    area(which)?.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

export function remove(key: string, which: Area = 'local') {
  try {
    area(which)?.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}
