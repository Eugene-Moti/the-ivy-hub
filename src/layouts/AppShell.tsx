import { useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ChartPieSliceIcon,
  GearSixIcon,
  KeyIcon,
  ScrollIcon,
  SidebarSimpleIcon,
  SignOutIcon,
  TableIcon,
  UserPlusIcon,
  UsersThreeIcon,
  type IconProps,
} from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import type { Role } from '../auth/types'
import { IvyLogo } from '../components/IvyLogo'
import { StatusPill } from '../components/StatusPill'
import { ThemeToggle } from '../components/ThemeToggle'
import { useRefData } from '../data/RefDataProvider'
import { cn } from '../lib/cn'
import { readJSON, writeJSON } from '../lib/storage'
import { useNairobiClock } from '../lib/useNairobiClock'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<IconProps>
  roles: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: ChartPieSliceIcon, roles: ['admin'] },
  { to: '/walk-ins/new', label: 'New Walk-in', icon: UserPlusIcon, roles: ['admin', 'receptionist'] },
  { to: '/records', label: 'Records', icon: TableIcon, roles: ['admin', 'receptionist'] },
  { to: '/team', label: 'Team', icon: UsersThreeIcon, roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: GearSixIcon, roles: ['admin'] },
  { to: '/activity', label: 'Activity Log', icon: ScrollIcon, roles: ['admin'] },
]

export function AppShell() {
  const { user, signOut } = useAuth()
  const { settings } = useRefData()
  const { time, date } = useNairobiClock()
  const location = useLocation()
  const reduce = useReducedMotion()
  const [collapsed, setCollapsed] = useState(() => readJSON<boolean>('ivy.sidebarCollapsed') ?? false)

  if (!user) return null
  const items = NAV_ITEMS.filter((i) => i.roles.includes(user.role))
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      writeJSON('ivy.sidebarCollapsed', !c)
      return !c
    })
  }

  return (
    <motion.div
      className="flex min-h-dvh bg-bg"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.aside
        className="sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg-elevated/70 backdrop-blur-xl md:flex"
        animate={{ width: collapsed ? 84 : 260 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <div className="flex h-[76px] items-center gap-3 overflow-hidden px-[22px]">
          <IvyLogo intro={false} shimmer={false} hoverGlow className="size-10 shrink-0" />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                className="min-w-0 leading-tight"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
              >
                <p className="font-display text-xl font-medium whitespace-nowrap text-fg">Ivy Hub</p>
                <p className="truncate text-[11px] font-semibold tracking-[0.16em] text-link uppercase">
                  {settings.companyName}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main">
          {items.map((item, i) => (
            <motion.div
              key={item.to}
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 + i * 0.05, duration: 0.4 }}
            >
              <NavLink
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold focus-ring transition-colors',
                    isActive ? 'text-ink-900' : 'text-muted hover:bg-fg/5 hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-xl bg-gradient-to-b from-gold-300 to-gold shadow-[0_10px_24px_-12px_rgb(201_154_48/0.9)]"
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      />
                    )}
                    <item.icon weight={isActive ? 'fill' : 'duotone'} className="relative size-5 shrink-0" />
                    {!collapsed && <span className="relative whitespace-nowrap">{item.label}</span>}
                  </>
                )}
              </NavLink>
            </motion.div>
          ))}
        </nav>

        <div className="p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-10 w-full items-center gap-3 rounded-xl px-3.5 text-sm text-muted focus-ring transition-colors hover:bg-fg/5 hover:text-fg"
          >
            <SidebarSimpleIcon weight="duotone" className="size-5" />
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <IvyLogo intro={false} shimmer={false} hoverGlow className="size-8" />
          </div>
          <div className="hidden items-baseline gap-3 lg:flex">
            <span className="text-2xl font-semibold text-fg tabular-nums">{time}</span>
            <span className="text-sm text-muted">{date} · EAT</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <StatusPill />
            <ThemeToggle />
            <div className="hidden items-center gap-3 rounded-full border border-line bg-bg-elevated/70 py-1 pr-4 pl-1 sm:flex">
              <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 text-xs font-bold text-ink-900">
                {initials}
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold text-fg">{user.name}</span>
                <span className="block text-[11px] text-muted">{user.title}</span>
              </span>
            </div>
            <Link
              to="/change-password"
              aria-label="Change password"
              title="Change password"
              className="hidden size-10 place-items-center rounded-full border border-line text-muted focus-ring transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:text-fg sm:grid"
            >
              <KeyIcon weight="bold" className="size-[18px]" />
            </Link>
            <button
              type="button"
              onClick={() => signOut('manual')}
              aria-label="Log out"
              title="Log out"
              className="grid size-10 place-items-center rounded-full border border-line text-muted focus-ring transition-all hover:-translate-y-0.5 hover:border-rose/40 hover:text-rose"
            >
              <SignOutIcon weight="bold" className="size-[18px]" />
            </button>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden" aria-label="Main">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold',
                  isActive ? 'bg-gold text-ink-900' : 'text-muted',
                )
              }
            >
              <item.icon weight="duotone" className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </motion.div>
  )
}
