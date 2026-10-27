import { useState, type ComponentType, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  AddressBookIcon,
  CaretRightIcon,
  ChartPieSliceIcon,
  DeviceMobileIcon,
  DotsThreeOutlineIcon,
  GearSixIcon,
  IdentificationCardIcon,
  KeyIcon,
  MoonIcon,
  PlusIcon,
  ScrollIcon,
  SidebarSimpleIcon,
  SignOutIcon,
  SunIcon,
  TableIcon,
  UserPlusIcon,
  UsersThreeIcon,
  type IconProps,
} from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import type { Role } from '../auth/types'
import { IvyLogo } from '../components/IvyLogo'
import { StaffDirectory, StaffDirectoryButton } from '../components/StaffDirectory'
import { StatusPill } from '../components/StatusPill'
import { ThemeToggle } from '../components/ThemeToggle'
import { Modal } from '../components/ui/Overlay'
import { useRefData } from '../data/RefDataProvider'
import { cn } from '../lib/cn'
import { readJSON, writeJSON } from '../lib/storage'
import { useTheme } from '../lib/theme'
import { useInstallApp } from '../lib/useInstallApp'
import { useNairobiClock } from '../lib/useNairobiClock'

interface NavItem {
  to: string
  label: string
  /** Shorter label for the phone tab bar. */
  short?: string
  icon: ComponentType<IconProps>
  roles: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: ChartPieSliceIcon, roles: ['admin'] },
  { to: '/walk-ins/new', label: 'New Walk-in', icon: UserPlusIcon, roles: ['admin', 'receptionist'] },
  { to: '/records', label: 'Records', icon: TableIcon, roles: ['admin', 'receptionist'] },
  { to: '/team', label: 'Team', icon: UsersThreeIcon, roles: ['admin'] },
  { to: '/users', label: 'Users', icon: IdentificationCardIcon, roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: GearSixIcon, roles: ['admin'] },
  { to: '/activity', label: 'Activity Log', short: 'Activity', icon: ScrollIcon, roles: ['admin'] },
]

const NEW_WALK_IN = '/walk-ins/new'

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

export function AppShell() {
  const { user, signOut } = useAuth()
  const { settings } = useRefData()
  const { time, date } = useNairobiClock()
  const location = useLocation()
  const reduce = useReducedMotion()
  const [collapsed, setCollapsed] = useState(() => readJSON<boolean>('ivy.sidebarCollapsed') ?? false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [staffOpen, setStaffOpen] = useState(false)

  if (!user) return null
  const items = NAV_ITEMS.filter((i) => i.roles.includes(user.role))
  const initials = initialsOf(user.name)

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

        <div className="space-y-1 p-3">
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-2 rounded-xl border border-line bg-bg-sunken/50 px-3.5 py-3"
              >
                <p className="text-lg font-semibold text-fg tabular-nums">{time}</p>
                <p className="text-xs text-muted">{date} · EAT</p>
              </motion.div>
            )}
          </AnimatePresence>
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
        <header className="sticky top-0 z-20 border-b border-line bg-bg/80 pt-safe backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-8 md:h-[76px]">
            {/* Phone: brand on the left; navigation lives in the bottom bar. */}
            <Link to={items[0]?.to ?? '/'} className="flex min-w-0 items-center gap-2.5 md:hidden">
              <IvyLogo intro={false} shimmer={false} className="size-8 shrink-0" />
              <span className="min-w-0 leading-tight">
                <span className="block font-display text-lg font-medium text-fg">Ivy Hub</span>
                <span className="block truncate text-[10px] font-semibold tracking-[0.16em] text-link uppercase">
                  {settings.companyName}
                </span>
              </span>
            </Link>
            <div className="hidden min-w-0 items-baseline gap-3 md:flex">
              <span className="truncate text-sm text-muted">
                {greeting(time)}, <span className="font-semibold text-fg">{user.name.split(' ')[0]}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <StatusPill />
              <div className="hidden items-center gap-2 sm:gap-3 md:flex">
                <StaffDirectoryButton compact />
                <ThemeToggle />
                <div className="flex items-center gap-3 rounded-full border border-line bg-bg-elevated/70 py-1 pr-4 pl-1">
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
                  className="grid size-10 place-items-center rounded-full border border-line text-muted focus-ring transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:text-fg"
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
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:px-8 sm:pt-8 md:pb-10">
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

      <BottomBar items={items} onMore={() => setMoreOpen(true)} onStaff={() => setStaffOpen(true)} />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={items}
        onStaff={() => {
          setMoreOpen(false)
          setStaffOpen(true)
        }}
      />
      <StaffDirectory open={staffOpen} onClose={() => setStaffOpen(false)} />
    </motion.div>
  )
}

function greeting(time: string) {
  const hour = Number(time.slice(0, 2))
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

/** Which nav items get their own tab on phones; the rest go in "More". */
function splitForPhone(items: NavItem[]) {
  const others = items.filter((i) => i.to !== NEW_WALK_IN)
  return { tabs: others.slice(0, 3), rest: others.slice(3) }
}

/* ── Phone navigation ─────────────────────────────────────────────────────── */

function BottomBar({ items, onMore, onStaff }: { items: NavItem[]; onMore: () => void; onStaff: () => void }) {
  const { theme, toggle } = useTheme()
  const { tabs } = splitForPhone(items)
  const canAdd = items.some((i) => i.to === NEW_WALK_IN)
  // Two slots either side of the + button. Reception has fewer pages, so staff contacts and the theme fill in.
  const slots: ReactNode[] = tabs.map((t) => <TabLink key={t.to} item={t} />)
  if (slots.length < 3) slots.push(<TabButton key="staff" icon={AddressBookIcon} label="Staff" onClick={onStaff} />)
  if (slots.length < 3)
    slots.push(<TabButton key="theme" icon={theme === 'dark' ? SunIcon : MoonIcon} label="Theme" onClick={toggle} />)
  slots.push(<TabButton key="more" icon={DotsThreeOutlineIcon} label="More" onClick={onMore} />)

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-elevated/90 pb-safe shadow-[0_-12px_32px_-20px_rgb(0_0_0/0.5)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid h-[68px] max-w-lg grid-cols-5 items-stretch px-1">
        {slots.slice(0, 2)}
        {canAdd ? <AddButton /> : <span />}
        {slots.slice(2, 4)}
      </div>
    </nav>
  )
}

const tabClass = (active: boolean) =>
  cn(
    'relative flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold focus-ring transition-colors',
    active ? 'text-link' : 'text-muted active:text-fg',
  )

function TabLink({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} className={({ isActive }) => tabClass(isActive)}>
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="tab-active"
              className="absolute top-0 h-[3px] w-8 rounded-b-full bg-gold"
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            />
          )}
          <item.icon weight={isActive ? 'fill' : 'duotone'} className="size-6" />
          {item.short ?? item.label}
        </>
      )}
    </NavLink>
  )
}

function TabButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<IconProps>
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={tabClass(false)}>
      <Icon weight="duotone" className="size-6" />
      {label}
    </button>
  )
}

function AddButton() {
  const location = useLocation()
  const navigate = useNavigate()
  const active = location.pathname === NEW_WALK_IN
  return (
    <div className="relative flex justify-center">
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={() => {
          if (active) window.scrollTo({ top: 0, behavior: 'smooth' })
          else navigate(NEW_WALK_IN)
        }}
        aria-label="New walk-in"
        aria-current={active ? 'page' : undefined}
        // On the walk-in form it docks into the bar so it doesn't cover the form's Save bar.
        className={cn(
          'absolute grid place-items-center bg-gradient-to-b from-gold-300 to-gold text-ink-900 focus-ring ring-bg transition-all duration-300',
          active
            ? 'top-2 size-9 rounded-xl ring-0'
            : '-top-6 size-[62px] rounded-full shadow-[0_14px_30px_-10px_rgb(201_154_48/0.85)] ring-[5px]',
        )}
      >
        <PlusIcon weight="bold" className={cn('transition-all', active ? 'size-5' : 'size-7')} />
      </motion.button>
      <span className={cn('absolute bottom-2 text-[11px] font-semibold', active ? 'text-link' : 'text-muted')}>
        New
      </span>
    </div>
  )
}

function MoreSheet({
  open,
  onClose,
  items,
  onStaff,
}: {
  open: boolean
  onClose: () => void
  items: NavItem[]
  onStaff: () => void
}) {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const installApp = useInstallApp()
  const [iosHint, setIosHint] = useState(false)
  if (!user) return null
  const { rest } = splitForPhone(items)

  return (
    <Modal open={open} onClose={onClose} title="More" size="sm">
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-line bg-bg-sunken/60 p-3">
        <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 font-bold text-ink-900">
          {initialsOf(user.name)}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-semibold text-fg">{user.name}</span>
          <span className="block truncate text-sm text-muted">
            {user.title || (user.role === 'admin' ? 'Admin' : 'Receptionist')}
          </span>
        </span>
      </div>

      <div className="space-y-1.5">
        {rest.map((item) => (
          <SheetLink key={item.to} to={item.to} icon={item.icon} label={item.label} onClick={onClose} />
        ))}
        <SheetButton icon={AddressBookIcon} label="Staff contacts" onClick={onStaff} />
        <SheetButton
          icon={theme === 'dark' ? SunIcon : MoonIcon}
          label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={toggle}
        />
        <SheetLink to="/change-password" icon={KeyIcon} label="Change password" onClick={onClose} />
        {(installApp.canPrompt || installApp.needsIOSHint) && (
          <SheetButton
            icon={DeviceMobileIcon}
            label="Install the app on this phone"
            onClick={() => (installApp.canPrompt ? void installApp.install() : setIosHint((v) => !v))}
          />
        )}
        {iosHint && (
          <p className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-fg">
            In Safari, tap <span className="font-semibold">Share</span> (the square with an arrow), then{' '}
            <span className="font-semibold">Add to Home Screen</span>.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          onClose()
          void signOut('manual')
        }}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose/30 text-sm font-semibold text-rose focus-ring transition-colors active:bg-rose/10 dark:text-[#e08a80]"
      >
        <SignOutIcon weight="bold" className="size-5" /> Log out
      </button>
    </Modal>
  )
}

const sheetRow =
  'flex h-13 w-full items-center gap-3 rounded-xl px-3.5 text-left text-[15px] font-semibold text-fg focus-ring transition-colors hover:bg-fg/5 active:bg-gold/10'

function SheetLink({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string
  icon: ComponentType<IconProps>
  label: string
  onClick: () => void
}) {
  return (
    <Link to={to} onClick={onClick} className={sheetRow}>
      <span className="grid size-9 place-items-center rounded-lg bg-gold/10 text-gold">
        <Icon weight="duotone" className="size-5" />
      </span>
      <span className="flex-1">{label}</span>
      <CaretRightIcon weight="bold" className="size-4 text-muted" />
    </Link>
  )
}

function SheetButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<IconProps>
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={sheetRow}>
      <span className="grid size-9 place-items-center rounded-lg bg-gold/10 text-gold">
        <Icon weight="duotone" className="size-5" />
      </span>
      <span className="flex-1">{label}</span>
    </button>
  )
}
