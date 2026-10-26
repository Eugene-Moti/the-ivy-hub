import { lazy, Suspense, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import type { Role } from './auth/types'
import { LogoTraceLoader } from './components/LogoTraceLoader'
import { PrintProvider } from './components/ui/Primitives'
import { ToastProvider } from './components/ui/Toaster'
import { RefDataProvider } from './data/RefDataProvider'
import { AppShell } from './layouts/AppShell'
import { ThemeProvider } from './lib/theme'
import { SyncProvider } from './offline/SyncProvider'
import { LoginPage } from './pages/LoginPage'
import { ChangePasswordPage, ResetPasswordPage } from './pages/PasswordPages'
import { WalkInPage } from './pages/WalkInPage'

// The receptionist's screens load with the app; heavier admin pages load on demand
// (the service worker precaches them, so they still open offline).
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const RecordsPage = lazy(() => import('./pages/RecordsPage').then((m) => ({ default: m.RecordsPage })))
const TeamPage = lazy(() => import('./pages/TeamPage').then((m) => ({ default: m.TeamPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const ActivityPage = lazy(() => import('./pages/ActivityPage').then((m) => ({ default: m.ActivityPage })))

function RouteFallback() {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <LogoTraceLoader size={64} className="text-gold" ariaLabel="Loading page" />
    </div>
  )
}

/** Full-screen growing-tree loader while the stored session is checked. */
function BootGate({ children }: { children: ReactNode }) {
  const { ready } = useAuth()
  const [done, setDone] = useState(false)
  return (
    <>
      {done && children}
      <AnimatePresence>
        {!done && (
          <motion.div
            key="boot"
            className="fixed inset-0 z-[100] grid place-items-center bg-ink-900"
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
          >
            <LogoTraceLoader
              size={104}
              className="text-gold drop-shadow-[0_0_30px_rgb(201_154_48/0.35)]"
              isComplete={ready}
              fillFadeSeconds={0.4}
              ariaLabel="Starting Ivy Hub"
              onDone={() => setDone(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace />
  // Temporary passwords (seeded accounts, admin resets) must be replaced before anything else.
  if (user.mustChangePassword && location.pathname !== '/change-password')
    return <Navigate to="/change-password" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'admin' ? '/dashboard' : '/walk-ins/new'} replace />
}

function LoginRoute() {
  const { user } = useAuth()
  return user ? <Navigate to="/" replace /> : <LoginPage />
}

const lazyPage = (page: ReactNode) => <Suspense fallback={<RouteFallback />}>{page}</Suspense>
const adminOnly = (page: ReactNode) => <RequireAuth roles={['admin']}>{lazyPage(page)}</RequireAuth>

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <RefDataProvider>
            <SyncProvider>
              <PrintProvider>
                <BrowserRouter>
                  <BootGate>
                    <Routes>
                      <Route path="/login" element={<LoginRoute />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                      <Route
                        path="/change-password"
                        element={
                          <RequireAuth>
                            <ChangePasswordPage />
                          </RequireAuth>
                        }
                      />
                      <Route
                        element={
                          <RequireAuth>
                            <AppShell />
                          </RequireAuth>
                        }
                      >
                        <Route index element={<HomeRedirect />} />
                        <Route path="dashboard" element={adminOnly(<DashboardPage />)} />
                        <Route path="walk-ins/new" element={<WalkInPage />} />
                        <Route path="records" element={lazyPage(<RecordsPage />)} />
                        <Route path="team" element={adminOnly(<TeamPage />)} />
                        <Route path="settings" element={adminOnly(<SettingsPage />)} />
                        <Route path="activity" element={adminOnly(<ActivityPage />)} />
                      </Route>
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </BootGate>
                </BrowserRouter>
              </PrintProvider>
            </SyncProvider>
          </RefDataProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
