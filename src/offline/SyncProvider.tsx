import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../components/ui/Toaster'
import { api } from '../data'
import { isNetworkError } from '../data/api'
import { useRefData } from '../data/RefDataProvider'
import type { NewTeamMember, NewWalkIn, TeamMember, WalkIn, WalkInNotification } from '../data/types'
import { compactDate } from '../lib/time'
import { enqueue, listOutbox, markAttempt, removeFromOutbox, type OutboxItem } from './outbox'

// Offline-first writes. Walk-ins and sales persons go straight to the backend when online; if the
// connection is down (or drops mid-request) they are queued in IndexedDB and replayed in order later.

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/** Expired tokens right after reconnecting are worth retrying rather than counting as failures. */
const isRetryable = (err: unknown) =>
  isNetworkError(err) || /jwt expired|invalid jwt|refresh token/i.test(err instanceof Error ? err.message : '')

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Unknown error')

export interface SubmitWalkInResult {
  walkIn: WalkIn
  queued: boolean
  /** Resolves once the backend has tried to notify the sales person (null when nothing to send yet). */
  notifications: Promise<WalkInNotification[]> | null
}

interface SyncValue {
  online: boolean
  pending: OutboxItem[]
  pendingWalkIns: number
  syncing: boolean
  submitWalkIn: (input: NewWalkIn) => Promise<SubmitWalkInResult>
  submitTeamMember: (input: NewTeamMember) => Promise<{ person: TeamMember; queued: boolean }>
  syncNow: () => Promise<number>
}

const SyncContext = createContext<SyncValue | null>(null)

export function provisionalReference(input: Pick<NewWalkIn, 'id' | 'visitedAt'>) {
  return `IVY-${compactDate(input.visitedAt)}-P${input.id.slice(0, 3).toUpperCase()}`
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { refresh: refreshRefData, addLocalMember } = useRefData()
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine)
  const [pending, setPending] = useState<OutboxItem[]>([])
  const [syncing, setSyncing] = useState(false)
  const syncLock = useRef(false)

  const reloadOutbox = useCallback(async () => {
    try {
      setPending(await listOutbox())
    } catch {
      setPending([])
    }
  }, [])

  useEffect(() => {
    void reloadOutbox()
  }, [reloadOutbox])

  // Someone to notify: the sales person (client visits) or the host (other visits).
  const dispatchFor = useCallback((walkIn: Pick<WalkIn, 'id' | 'salesPersonId' | 'hostId'>) => {
    if (!walkIn.salesPersonId && !walkIn.hostId) return null
    return api.dispatchNotifications(walkIn.id).catch(() => [] as WalkInNotification[])
  }, [])

  const submitWalkIn = useCallback(
    async (input: NewWalkIn): Promise<SubmitWalkInResult> => {
      if (navigator.onLine) {
        try {
          const walkIn = await api.createWalkIn(input)
          return { walkIn, queued: false, notifications: dispatchFor(walkIn) }
        } catch (err) {
          if (!isNetworkError(err)) throw err
        }
      }
      await enqueue({ id: input.id, kind: 'walk_in', payload: input, queuedAt: new Date().toISOString() })
      await reloadOutbox()
      const now = new Date().toISOString()
      return {
        queued: true,
        notifications: null,
        walkIn: {
          ...input,
          reference: provisionalReference(input),
          createdBy: user?.id ?? '',
          createdByName: user?.name ?? null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          deleteReason: null,
        },
      }
    },
    [dispatchFor, reloadOutbox, user],
  )

  const submitTeamMember = useCallback(
    async (input: NewTeamMember) => {
      if (navigator.onLine) {
        try {
          const person = await api.createTeamMember(input)
          addLocalMember(person)
          return { person, queued: false }
        } catch (err) {
          if (!isNetworkError(err)) throw err
        }
      }
      await enqueue({ id: input.id, kind: 'team_member', payload: input, queuedAt: new Date().toISOString() })
      await reloadOutbox()
      // "local:" marks it as unsynced so a refresh from the server does not drop it.
      const person: TeamMember = {
        ...input,
        isActive: true,
        createdBy: user?.id ?? null,
        createdAt: `local:${new Date().toISOString()}`,
      }
      addLocalMember(person)
      return { person, queued: true }
    },
    [addLocalMember, reloadOutbox, user],
  )

  const syncNow = useCallback(async () => {
    if (syncLock.current || !navigator.onLine) return 0
    syncLock.current = true
    setSyncing(true)
    const syncedWalkIns: WalkIn[] = []
    let syncedPeople = 0
    try {
      for (const item of await listOutbox()) {
        try {
          if (item.kind === 'team_member') {
            await api.createTeamMember(item.payload)
            syncedPeople++
          } else {
            syncedWalkIns.push(await api.createWalkIn(item.payload))
          }
          await removeFromOutbox(item.id)
        } catch (err) {
          if (isRetryable(err)) break // connection dropped again: keep the rest in order for next time
          await markAttempt(item, errorText(err))
        }
      }
    } finally {
      syncLock.current = false
      setSyncing(false)
      await reloadOutbox()
    }
    if (syncedPeople) void refreshRefData()
    if (syncedWalkIns.length) {
      const n = syncedWalkIns.length
      toast({ title: `${n} offline walk-in${n === 1 ? '' : 's'} synced`, tone: 'success' })
      // Notify sales persons only now that the records exist on the server.
      for (const w of syncedWalkIns) void dispatchFor(w)
    }
    return syncedWalkIns.length
  }, [dispatchFor, refreshRefData, reloadOutbox, toast])

  // Replay automatically when the connection returns, on sign-in, and every 30s while items wait.
  const hasPending = pending.length > 0
  useEffect(() => {
    if (user && online && hasPending) void syncNow()
  }, [user, online, hasPending, syncNow])

  useEffect(() => {
    if (!user || !pending.length) return
    const id = window.setInterval(() => navigator.onLine && void syncNow(), 30_000)
    return () => window.clearInterval(id)
  }, [user, pending.length, syncNow])

  const value = useMemo<SyncValue>(
    () => ({
      online,
      pending,
      pendingWalkIns: pending.filter((p) => p.kind === 'walk_in').length,
      syncing,
      submitWalkIn,
      submitTeamMember,
      syncNow,
    }),
    [online, pending, syncing, submitWalkIn, submitTeamMember, syncNow],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used inside SyncProvider')
  return ctx
}
