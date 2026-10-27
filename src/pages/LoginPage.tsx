import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import {
  ArrowLeft,
  AtSign,
  Check,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Lock,
  Mail,
  ShieldAlert,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../auth/AuthProvider'
import { Checkbox } from '../components/Checkbox'
import { FloatingInput } from '../components/FloatingInput'
import { IvyLogo } from '../components/IvyLogo'
import { LogoTraceLoader } from '../components/LogoTraceLoader'
import { ThemeToggle } from '../components/ThemeToggle'
import { WaveHero } from '../components/WaveHero'
import { api } from '../data'
import { DEMO_LOGINS } from '../data/demo/seed'
import { useRefData } from '../data/RefDataProvider'
import { IDLE_TIMEOUT_MS, LOCKOUT_MS } from '../lib/config'
import { useTheme } from '../lib/theme'
import { useNairobiClock } from '../lib/useNairobiClock'
import { zodResolver } from '../lib/zodResolver'

const signInSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
  remember: z.boolean(),
})
type SignInValues = z.infer<typeof signInSchema>

const EASE_OUT = [0.22, 1, 0.36, 1] as const

export function LoginPage() {
  const { theme } = useTheme()
  const companyName = useRefData().settings.companyName
  const reduce = useReducedMotion()
  const [view, setView] = useState<'signin' | 'forgot'>('signin')
  const [shakeScope, shake] = useAnimate<HTMLDivElement>()

  const onFailure = () => {
    if (!reduce) shake(shakeScope.current, { x: [0, -14, 12, -9, 6, -3, 0] }, { duration: 0.5, ease: 'easeInOut' })
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <WaveHero theme={theme} focusX={-0.3} className="fixed inset-0" />
      {/* Keeps the brand copy and card legible over the waves. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 transition-opacity duration-700"
        style={{
          background:
            theme === 'dark'
              ? 'radial-gradient(90% 70% at 25% 40%, transparent 30%, rgb(14 21 18 / 0.55) 100%), linear-gradient(90deg, rgb(14 21 18 / 0.55) 0%, transparent 35%, transparent 55%, rgb(14 21 18 / 0.6) 100%)'
              : 'radial-gradient(90% 70% at 25% 40%, transparent 30%, rgb(248 245 238 / 0.6) 100%), linear-gradient(90deg, rgb(248 245 238 / 0.7) 0%, transparent 35%, transparent 55%, rgb(248 245 238 / 0.55) 100%)',
        }}
      />

      <div className="absolute top-8 right-14 z-20 hidden lg:block">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto grid min-h-dvh max-w-[1440px] grid-cols-1 gap-10 px-4 py-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,480px)] lg:px-14 lg:py-8">
        <BrandPanel />

        <section className="flex flex-col items-center justify-center gap-6 pb-6 lg:pb-0">
          <div className="flex w-full max-w-[460px] items-center justify-between lg:hidden">
            <span className="text-xs font-semibold tracking-[0.22em] text-muted uppercase">{companyName}</span>
            <ThemeToggle />
          </div>

          <motion.div
            className="w-full max-w-[460px]"
            initial={reduce ? false : { opacity: 0, x: 40, filter: 'blur(8px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.1 }}
          >
            <div
              ref={shakeScope}
              className="relative overflow-hidden rounded-[var(--radius-card)] border border-glass-line bg-glass p-7 shadow-[0_30px_80px_-20px_rgb(14_21_18/0.45)] backdrop-blur-2xl sm:p-9"
            >
              {/* Hairline gold highlight along the top edge */}
              <div
                aria-hidden
                className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/70 to-transparent"
              />
              {/* No initial={false} here: it would also suppress the logo and form intro inside. */}
              <AnimatePresence mode="wait">
                {view === 'signin' ? (
                  <ViewSlide key="signin" direction={-1}>
                    <SignInView onForgot={() => setView('forgot')} onFailure={onFailure} />
                  </ViewSlide>
                ) : (
                  <ViewSlide key="forgot" direction={1}>
                    <ForgotView onBack={() => setView('signin')} />
                  </ViewSlide>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  )
}

function ViewSlide({ children, direction }: { children: ReactNode; direction: 1 | -1 }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 32 * direction }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -32 * direction }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Left: brand panel                                                   */
/* ------------------------------------------------------------------ */

const HEADLINE = ['Every visitor.', 'Every channel.']

function BrandPanel() {
  const { time, date } = useNairobiClock()
  const companyName = useRefData().settings.companyName
  const reduce = useReducedMotion()
  const line = (i: number) => ({
    initial: reduce ? false : ({ y: '110%' } as const),
    animate: { y: '0%' },
    transition: { duration: 1, ease: EASE_OUT, delay: 0.35 + i * 0.12 },
  })

  return (
    <section className="hidden flex-col justify-between lg:flex">
      <motion.div
        className="flex items-center justify-between"
        initial={reduce ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
      >
        <div className="flex items-center gap-3">
          <IvyLogo intro={false} shimmer={false} className="size-8" />
          <span className="text-xs font-semibold tracking-[0.25em] text-fg/80 uppercase">{companyName}</span>
        </div>
      </motion.div>

      <div className="max-w-xl py-10">
        <motion.p
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-glass-line bg-glass px-3.5 py-1.5 text-xs font-semibold tracking-wide text-fg/80 backdrop-blur-xl"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald" />
          </span>
          Walk-in visitor tracking
        </motion.p>
        <h2 className="font-display text-[clamp(2.75rem,5vw,4.75rem)] leading-[1.02] font-medium tracking-[-0.02em] text-fg">
          {HEADLINE.map((text, i) => (
            <span key={text} className="block overflow-hidden pb-1">
              <motion.span className="block" {...line(i)}>
                {text}
              </motion.span>
            </span>
          ))}
          <span className="block overflow-hidden pb-2">
            <motion.span className="text-gold-sheen block animate-shimmer-text italic" {...line(HEADLINE.length)}>
              One place.
            </motion.span>
          </span>
        </h2>
        <motion.p
          className="mt-6 max-w-md text-base leading-relaxed text-muted"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.85 }}
        >
          Record each walk-in in seconds, then see which channels and which sales people bring clients through the door.
        </motion.p>
      </div>

      <motion.div
        className="flex items-center justify-between gap-4 text-xs text-muted"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.1 }}
      >
        <div className="inline-flex items-center gap-2.5 rounded-full border border-glass-line bg-glass px-3.5 py-2 backdrop-blur-xl">
          <Clock3 className="size-3.5 text-gold" />
          <span>{date}</span>
          <span className="h-3 w-px bg-line" />
          <span className="font-semibold text-fg tabular-nums">{time}</span>
          <span className="text-[10px] font-semibold tracking-wider">EAT</span>
        </div>
        <span>
          © {new Date().getFullYear()} {companyName}
        </span>
      </motion.div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Sign-in view                                                        */
/* ------------------------------------------------------------------ */

function SignInView({ onForgot, onFailure }: { onForgot: () => void; onFailure: () => void }) {
  const { signIn, commitSession, isDemo, signOutReason } = useAuth()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [showPassword, setShowPassword] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'success'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [greeting, setGreeting] = useState('')
  const [exitOrigin, setExitOrigin] = useState<{ x: number; y: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { identifier: '', password: '', remember: true },
  })

  const finish = () => {
    commitSession()
    navigate('/', { replace: true })
  }

  const onLoaderDone = () => {
    if (reduce) return finish()
    const rect = buttonRef.current?.getBoundingClientRect()
    setExitOrigin(
      rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: innerWidth / 2, y: innerHeight / 2 },
    )
  }

  const onSubmit = async (values: SignInValues) => {
    setError(null)
    setPhase('loading')
    const result = await signIn(values.identifier, values.password, values.remember)

    if (result.ok) {
      setGreeting(result.user.name.split(' ')[0])
      // The loader now closes into the full logo; onLoaderDone starts the reveal into the app.
      setPhase('success')
      return
    }

    setPhase('idle')
    onFailure()
    setValue('password', '')
    if (result.reason === 'locked') {
      setLockedUntil(result.lockedUntil)
      return
    }
    if (result.reason === 'inactive') {
      setError('This account has been deactivated. Please contact your admin.')
    } else if (result.reason === 'offline') {
      setError("Can't reach the server. Check the internet connection and try again.")
    } else if (result.reason === 'unavailable') {
      setError('The server is busy or waking up. Wait a few seconds and try again.')
    } else {
      const warn =
        result.attemptsLeft <= 3
          ? ` ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? '' : 's'} left before a ${LOCKOUT_MS / 60000}-minute lock.`
          : ''
      setError(`Those details don't match our records.${warn}`)
    }
    setFocus('password')
  }

  const locked = lockedUntil !== null
  const busy = phase !== 'idle' || locked

  return (
    <>
      <div className="flex flex-col items-center text-center">
        <div className="mb-5 grid size-[84px] place-items-center">
          {phase === 'idle' ? (
            <IvyLogo className="size-[84px]" />
          ) : (
            <LogoTraceLoader
              size={84}
              className="text-gold drop-shadow-[0_8px_22px_rgb(201_154_48/0.35)]"
              isComplete={phase === 'success'}
              ariaLabel={phase === 'success' ? 'Signed in' : 'Signing in'}
              onDone={onLoaderDone}
            />
          )}
        </div>
        <motion.h1
          className="font-display text-[1.9rem] leading-tight font-medium tracking-[-0.01em] text-fg"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: EASE_OUT }}
        >
          Welcome to Ivy Hub
        </motion.h1>
        <motion.p
          className="mt-1.5 text-sm text-muted"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6, ease: EASE_OUT }}
        >
          Sign in to record and review today's walk-ins.
        </motion.p>
      </div>

      <div className="mt-6 space-y-2.5" aria-live="polite">
        <AnimatePresence initial={false}>
          {signOutReason === 'idle' && !error && !locked && (
            <Notice key="idle" tone="info" icon={<Clock3 />}>
              You were signed out after {IDLE_TIMEOUT_MS / 60000} minutes of inactivity.
            </Notice>
          )}
          {locked && (
            <Notice key="locked" tone="danger" icon={<Lock />}>
              <LockCountdown until={lockedUntil} onDone={() => setLockedUntil(null)} />
            </Notice>
          )}
          {error && (
            <Notice key="error" tone="danger" icon={<ShieldAlert />}>
              {error}
            </Notice>
          )}
        </AnimatePresence>
      </div>

      <motion.form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="mt-4 space-y-4"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.7, ease: EASE_OUT }}
      >
        <FloatingInput
          label="Email or username"
          icon={<AtSign />}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          disabled={phase !== 'idle'}
          error={errors.identifier?.message}
          {...register('identifier', {
            onChange: () => {
              setError(null)
              setLockedUntil(null) // lockout is per account; re-checked on submit
            },
          })}
        />
        <FloatingInput
          label="Password"
          icon={<KeyRound />}
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          disabled={phase !== 'idle'}
          error={errors.password?.message}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-fg/5 hover:text-fg focus-visible:text-focus focus-visible:outline-none"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={showPassword ? 'hide' : 'show'}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.15 }}
                >
                  {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </motion.span>
              </AnimatePresence>
            </button>
          }
          {...register('password', { onChange: () => setError(null) })}
        />

        <div className="flex items-center justify-between pt-0.5">
          <Checkbox {...register('remember')}>Remember me</Checkbox>
          <button
            type="button"
            onClick={onForgot}
            className="rounded text-sm font-semibold text-accent underline-offset-4 transition-colors hover:underline focus-visible:underline focus-visible:outline-none"
          >
            Forgot password?
          </button>
        </div>

        <SubmitButton ref={buttonRef} phase={phase} disabled={busy} greeting={greeting} />
      </motion.form>

      {isDemo && (
        <DemoAccounts
          disabled={phase !== 'idle'}
          onPick={(id, pw) => {
            setValue('identifier', id, { shouldValidate: true })
            setValue('password', pw, { shouldValidate: true })
            setError(null)
            setLockedUntil(null)
            setFocus('password')
          }}
        />
      )}

      {exitOrigin && <ExitReveal origin={exitOrigin} onDone={finish} />}
    </>
  )
}

function SubmitButton({
  phase,
  disabled,
  greeting,
  ref,
}: {
  phase: 'idle' | 'loading' | 'success'
  disabled: boolean
  greeting: string
  ref: Ref<HTMLButtonElement>
}) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      ref={ref}
      type="submit"
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      className={clsx(
        'group relative mt-2 flex h-[52px] w-full items-center justify-center overflow-hidden rounded-xl font-semibold tracking-wide',
        'shadow-[0_12px_30px_-12px_rgb(201_154_48/0.6)] transition-[background-color,box-shadow,opacity] duration-300 focus-visible:shadow-[0_0_0_4px_rgb(202_153_48/0.35)] focus-visible:outline-none',
        phase === 'success' ? 'bg-emerald text-ink-900' : 'bg-accent text-accent-fg',
        disabled && phase === 'idle' && 'cursor-not-allowed opacity-60',
      )}
    >
      {/* Gold sheen that sweeps across on hover */}
      <span
        aria-hidden
        className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[420%]"
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={phase}
          className="relative flex items-center gap-2"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          {phase === 'idle' && 'Sign in'}
          {phase === 'loading' && (
            <>
              <LoaderCircle className="size-[18px] animate-spin" />
              Signing in…
            </>
          )}
          {phase === 'success' && (
            <>
              <motion.span
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                className="grid size-6 place-items-center rounded-full bg-ink-900/15"
              >
                <Check className="size-4" strokeWidth={3} />
              </motion.span>
              Welcome back{greeting ? `, ${greeting}` : ''}
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

/** Circular reveal from the sign-in button that hands over to the app. */
function ExitReveal({ origin, onDone }: { origin: { x: number; y: number }; onDone: () => void }) {
  const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y))
  const duration = 0.75
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const id = window.setTimeout(() => done.current(), duration * 1000 + 50)
    return () => window.clearTimeout(id)
  }, [])
  // Portalled: the card's transform and backdrop-filter would otherwise contain a fixed element.
  return createPortal(
    <motion.div
      aria-hidden
      className="fixed inset-0 z-50 bg-bg"
      initial={{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }}
      animate={{ clipPath: `circle(${radius + 20}px at ${origin.x}px ${origin.y}px)` }}
      transition={{ duration, ease: [0.65, 0, 0.35, 1] }}
    />,
    document.body,
  )
}

function Notice({ tone, icon, children }: { tone: 'info' | 'danger'; icon: ReactNode; children: ReactNode }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0, y: -6 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      exit={{ opacity: 0, height: 0, y: -6 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="overflow-hidden"
    >
      <div
        role={tone === 'danger' ? 'alert' : 'status'}
        className={clsx(
          'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-snug [&>svg]:mt-px [&>svg]:size-4 [&>svg]:shrink-0',
          tone === 'danger'
            ? 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'
            : 'border-gold/30 bg-gold/10 text-gold-700 dark:text-gold-200',
        )}
      >
        {icon}
        <span>{children}</span>
      </div>
    </motion.div>
  )
}

function LockCountdown({ until, onDone }: { until: number | null; onDone: () => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const remaining = Math.max(0, (until ?? 0) - now)
  useEffect(() => {
    if (remaining === 0) onDone()
  }, [remaining, onDone])
  const mm = Math.floor(remaining / 60000)
  const ss = Math.floor((remaining % 60000) / 1000)
    .toString()
    .padStart(2, '0')
  return (
    <>
      Too many failed attempts. Sign-in is locked for{' '}
      <strong className="font-semibold tabular-nums">
        {mm}:{ss}
      </strong>
      .
    </>
  )
}

function DemoAccounts({
  onPick,
  disabled,
}: {
  onPick: (identifier: string, password: string) => void
  disabled: boolean
}) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="mb-2.5 text-center text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
        Demo mode · tap to fill
      </p>
      <div className="grid grid-cols-2 gap-2">
        {DEMO_LOGINS.map((a) => (
          <button
            key={a.username}
            type="button"
            disabled={disabled}
            onClick={() => onPick(a.username, a.password)}
            className="rounded-xl border border-line bg-field px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:border-focus/60 hover:shadow-md focus-visible:shadow-[0_0_0_4px_rgb(202_153_48/0.25)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="block text-[13px] font-semibold text-fg">{a.title}</span>
            <span className="block truncate text-[11px] text-muted">{a.username}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Forgot-password view                                                */
/* ------------------------------------------------------------------ */

const forgotSchema = z.object({ email: z.email('Enter a valid email address') })
type ForgotValues = z.infer<typeof forgotSchema>

function ForgotView({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })

  const onSubmit = async ({ email }: ForgotValues) => {
    // Always show the same message so the form can't be used to discover which emails exist.
    await api.requestPasswordReset(email).catch(() => {})
    setSent(true)
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-muted transition-colors hover:text-fg focus-visible:text-focus focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" /> Back to sign in
      </button>

      <div className="mt-6 mb-6 flex flex-col items-center text-center">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
          <KeyRound className="size-6" />
        </div>
        <h1 className="font-display text-[1.75rem] leading-tight font-medium text-fg">Reset your password</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <span className="font-semibold text-fg">Receptionists:</span> ask your admin to reset it from Settings →
          Users.
          <br />
          <span className="font-semibold text-fg">Admins:</span> we'll email you a secure reset link.
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-emerald/30 bg-emerald/10 p-4 text-center text-sm text-fg"
            role="status"
          >
            <Check className="mx-auto mb-2 size-5 text-emerald" strokeWidth={3} />
            If that email belongs to an Ivy Hub admin, a reset link is on its way.
          </motion.div>
        ) : (
          <motion.form
            key="form"
            noValidate
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            exit={{ opacity: 0 }}
          >
            <FloatingInput
              label="Admin email"
              icon={<Mail />}
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-fg shadow-[0_12px_30px_-12px_rgb(201_154_48/0.6)] transition-all hover:-translate-y-0.5 focus-visible:shadow-[0_0_0_4px_rgb(202_153_48/0.35)] focus-visible:outline-none disabled:opacity-70"
            >
              {isSubmitting ? <LoaderCircle className="size-[18px] animate-spin" /> : null}
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
