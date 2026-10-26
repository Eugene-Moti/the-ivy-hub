import type { NewTeamMember, NewWalkIn } from '../data/types'

// Durable queue of writes made while offline, kept in IndexedDB so it survives reloads and restarts.

export type OutboxItem =
  | {
      id: string
      kind: 'team_member'
      payload: NewTeamMember
      queuedAt: string
      attempts: number
      lastError: string | null
    }
  | { id: string; kind: 'walk_in'; payload: NewWalkIn; queuedAt: string; attempts: number; lastError: string | null }

const DB_NAME = 'ivy-hub'
const STORE = 'outbox'
let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        t.oncomplete = () => resolve(req.result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

export async function enqueue(item: Omit<OutboxItem, 'attempts' | 'lastError'>): Promise<void> {
  await tx('readwrite', (s) => s.put({ ...item, attempts: 0, lastError: null }))
}

/**
 * Items in replay order: sales persons first (walk-ins may reference them), then walk-ins in the
 * order they were recorded.
 */
export async function listOutbox(): Promise<OutboxItem[]> {
  const items = await tx<OutboxItem[]>('readonly', (s) => s.getAll() as IDBRequest<OutboxItem[]>)
  return items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'team_member' ? -1 : 1
    return a.queuedAt.localeCompare(b.queuedAt)
  })
}

export async function removeFromOutbox(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
}

export async function markAttempt(item: OutboxItem, error: string): Promise<void> {
  await tx('readwrite', (s) => s.put({ ...item, attempts: item.attempts + 1, lastError: error }))
}
