import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { CheckIcon, CircleNotchIcon, WarningIcon } from '@phosphor-icons/react'
import { cn } from '../../lib/cn'
import { buttonBase, buttonSizes, buttonVariants, type ButtonSize, type ButtonVariant } from './Button'

export type DynamicState = 'idle' | 'loading' | 'success' | 'error'

interface DynamicButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  state: DynamicState
  labels: { idle: ReactNode; loading?: ReactNode; success?: ReactNode; error?: ReactNode }
  /** Icon shown with the idle label. */
  icon?: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  ref?: Ref<HTMLButtonElement>
}

/** Button whose label changes with state: the width animates and the text swaps in place. */
export function DynamicButton({
  state,
  labels,
  icon,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  type = 'button',
  ref,
  ...props
}: DynamicButtonProps) {
  const reduce = useReducedMotion()
  const content: Record<DynamicState, ReactNode> = {
    idle: (
      <>
        {icon}
        {labels.idle}
      </>
    ),
    loading: (
      <>
        <CircleNotchIcon weight="bold" className="animate-spin" />
        {labels.loading ?? labels.idle}
      </>
    ),
    success: (
      <>
        <motion.span
          className="inline-flex"
          initial={reduce ? false : { scale: 0, rotate: -60 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        >
          <CheckIcon weight="bold" />
        </motion.span>
        {labels.success ?? 'Done'}
      </>
    ),
    error: (
      <>
        <WarningIcon weight="bold" />
        {labels.error ?? 'Try again'}
      </>
    ),
  }

  return (
    <motion.button
      ref={ref}
      type={type}
      layout={!reduce}
      transition={{ layout: { type: 'spring', stiffness: 520, damping: 38 } }}
      disabled={disabled || state === 'loading'}
      aria-busy={state === 'loading'}
      className={cn(
        buttonBase,
        buttonVariants[variant],
        buttonSizes[size],
        'overflow-hidden',
        state === 'success' && variant === 'primary' && 'from-[#5fdc95] to-emerald',
        state === 'error' && 'border-rose/40',
        className,
      )}
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          aria-live="polite"
          className="inline-flex items-center gap-[inherit]"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -14, filter: 'blur(4px)' }}
          transition={{ duration: 0.22 }}
        >
          {content[state]}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

/**
 * Drives a DynamicButton: idle → loading → success/error → back to idle.
 * Errors are re-thrown so the caller can show them.
 */
export function useDynamicAction(resetMs = 1800) {
  const [state, setState] = useState<DynamicState>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      window.clearTimeout(timer.current)
      setState('loading')
      try {
        const result = await fn()
        setState('success')
        timer.current = window.setTimeout(() => setState('idle'), resetMs)
        return result
      } catch (err) {
        setState('error')
        timer.current = window.setTimeout(() => setState('idle'), resetMs)
        throw err
      }
    },
    [resetMs],
  )

  return { state, run, setState }
}
