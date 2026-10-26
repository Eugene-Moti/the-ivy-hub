import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../data'
import { IDLE_TIMEOUT_MS } from '../lib/config'
import { readJSON, remove, writeJSON } from '../lib/storage'
import type { SessionUser, SignInResult, SignOutReason } from './types'

const ACTIVITY_KEY = 'ivy.lastActivity'
const PROFILE_KEY = 'ivy.profile'
const SESSION_STORAGE_KEYS = ['ivy.demo.session']
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

interface AuthContextValue {
  user: SessionUser | null
  /** False until the stored session has been checked on boot. */
  ready: boolean
  isDemo: boolean
  /** Verifies credentials and starts the session, but does not switch the UI over yet. */
  signIn: (identifier: string, password: string, remember: boolean) => Promise<SignInResult>
  /** Activates the session from signIn (lets the login screen finish its exit animation first). */
  commitSession: () => void
  signOut: (reason?: SignOutReason) => void
  /** The forced (or voluntary) password change succeeded. */
  markPasswordChanged: () => void
  /** Why the last session ended, so the login screen can explain an idle sign-out. */
  signOutReason: SignOutReason | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

function idleExpired() {
  const last = readJSON<number>(ACTIVITY_KEY)
  return last !== null && Date.now() - last > IDLE_TIMEOUT_MS
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)
  const [signOutReason, setSignOutReason] = useState<SignOutReason | null>(null)
  const pending = useRef<SessionUser | null>(null)

  // Boot: restore the stored session unless it went idle while the app was closed.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let restored: SessionUser | null = null
      if (idleExpired()) {
        await api.signOut('idle').catch(() => {})
        remove(ACTIVITY_KEY)
        if (!cancelled) setSignOutReason('idle')
      } else {
        try {
          restored = await api.restoreSession()
        } catch {
          // Offline with a stored session: keep the receptionist signed in so offline mode works.
          restored = navigator.onLine ? null : readJSON<SessionUser>(PROFILE_KEY)
        }
      }
      if (cancelled) return
      if (restored) writeJSON(PROFILE_KEY, restored)
      setUser(restored)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (identifier: string, password: string, remember: boolean) => {
    const result = await api.signIn(identifier, password, remember)
    if (result.ok) {
      pending.current = result.user
      writeJSON(ACTIVITY_KEY, Date.now())
      writeJSON(PROFILE_KEY, result.user)
      setSignOutReason(null)
    }
    return result
  }, [])

  const commitSession = useCallback(() => {
    if (pending.current) setUser(pending.current)
    pending.current = null
  }, [])

  const markPasswordChanged = useCallback(() => {
    setUser((u) => {
      if (!u) return u
      const next = { ...u, mustChangePassword: false }
      writeJSON(PROFILE_KEY, next)
      return next
    })
  }, [])

  const signOut = useCallback((reason: SignOutReason = 'manual') => {
    void api.signOut(reason).catch(() => {})
    remove(ACTIVITY_KEY)
    remove(PROFILE_KEY)
    setSignOutReason(reason)
    setUser(null)
  }, [])

  // Inactivity sign-out. Activity is shared through storage so any open tab keeps the session alive.
  useEffect(() => {
    if (!user) return
    let lastWrite = 0
    const markActive = () => {
      const now = Date.now()
      if (now - lastWrite < 5000) return
      lastWrite = now
      writeJSON(ACTIVITY_KEY, now)
    }
    markActive()
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }))
    const check = window.setInterval(() => {
      if (idleExpired()) signOut('idle')
    }, 15_000)
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive))
      window.clearInterval(check)
    }
  }, [user, signOut])

  // Signing out in one tab (or the backend revoking the session) signs out everywhere.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && SESSION_STORAGE_KEYS.includes(e.key) && e.newValue === null) setUser(null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        isDemo: api.mode === 'demo',
        signIn,
        commitSession,
        signOut,
        markPasswordChanged,
        signOutReason,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
