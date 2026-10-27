import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '../../lib/cn'

/* ------------------------------------------------------------------ */
/* Layout                                                               */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold tracking-[0.2em] text-link uppercase sm:mb-1.5 sm:text-xs">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[1.85rem] leading-tight font-medium tracking-[-0.01em] text-fg sm:text-[2.15rem]">
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted sm:mt-1.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({
  className,
  children,
  hover = false,
}: {
  className?: string
  children: ReactNode
  hover?: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      whileHover={hover && !reduce ? { y: -3 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-bg-elevated/75 shadow-card backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Badges                                                               */
/* ------------------------------------------------------------------ */

const BADGE_TONES = {
  neutral: 'border-line bg-fg/[0.04] text-muted',
  gold: 'border-gold/35 bg-gold/12 text-link',
  success: 'border-emerald/30 bg-emerald/10 text-[#1f8f4f] dark:text-emerald',
  warning: 'border-amber/35 bg-amber/12 text-[#9a6a12] dark:text-amber',
  danger: 'border-rose/35 bg-rose/10 text-rose dark:text-[#e08a80]',
} as const

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: keyof typeof BADGE_TONES
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap [&_svg]:size-3',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Segmented control / tabs                                             */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
  className?: string
  ariaLabel: string
}) {
  const layoutId = useId()
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex rounded-xl border border-line bg-bg-sunken/70 p-1', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative rounded-lg px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap focus-ring transition-colors [&_svg]:size-4',
            value === o.value ? 'text-ink-900' : 'text-muted hover:text-fg',
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 rounded-lg bg-gradient-to-b from-gold-300 to-gold shadow-sm"
              transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            />
          )}
          <span className="relative inline-flex items-center gap-1.5">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Empty state                                                          */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold [&_svg]:size-7">
        {icon}
      </div>
      <p className="font-display text-xl text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Printing                                                             */
/* ------------------------------------------------------------------ */

const PrintContext = createContext<((node: ReactNode) => void) | null>(null)

/** Renders print-only content into #print-root (everything else is hidden by @media print). */
export function PrintProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null)
  const print = useCallback((content: ReactNode) => {
    setNode(content)
    // Two frames: let React commit the portal and the browser lay it out before printing.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }, [])
  useEffect(() => {
    const after = () => setNode(null)
    window.addEventListener('afterprint', after)
    return () => window.removeEventListener('afterprint', after)
  }, [])
  const root = typeof document !== 'undefined' ? document.getElementById('print-root') : null
  return (
    <PrintContext.Provider value={print}>
      {children}
      {root && node ? createPortal(node, root) : null}
    </PrintContext.Provider>
  )
}

export function usePrint() {
  const ctx = useContext(PrintContext)
  if (!ctx) throw new Error('usePrint must be used inside PrintProvider')
  return ctx
}
