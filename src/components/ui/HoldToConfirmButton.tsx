import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  animate,
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from 'motion/react'
import { CheckIcon, CircleNotchIcon, TrashIcon } from '@phosphor-icons/react'
import { cn } from '../../lib/cn'

type Status = 'idle' | 'holding' | 'working' | 'done'

interface HoldToConfirmButtonProps {
  /** e.g. "Hold to delete" */
  label: string
  /** Shown after the action succeeds, e.g. "Deleted" */
  confirmedLabel: string
  onConfirm: () => Promise<void> | void
  holdMs?: number
  icon?: ReactNode
  tone?: 'danger' | 'gold'
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
  /** Called when the confirmed state finishes showing (e.g. close the drawer). */
  onSettled?: () => void
}

/**
 * Replaces "Are you sure?" dialogs for destructive actions: press and hold until the fill completes.
 * Releasing early cancels. Works with mouse, touch and keyboard (hold Space or Enter).
 */
export function HoldToConfirmButton({
  label,
  confirmedLabel,
  onConfirm,
  holdMs = 1500,
  icon = <TrashIcon weight="bold" />,
  tone = 'danger',
  size = 'md',
  disabled,
  className,
  onSettled,
}: HoldToConfirmButtonProps) {
  const reduce = useReducedMotion()
  const hintId = useId()
  const progress = useMotionValue(0)
  const ring = useTransform(progress, [0, 1], [0, 1])
  const [status, setStatusState] = useState<Status>('idle')
  const [hint, setHint] = useState(false)
  const anim = useRef<AnimationPlaybackControls | null>(null)
  const settleTimer = useRef<number | undefined>(undefined)
  const shake = useAnimationControls()
  // Ref mirrors state synchronously: pointer-up can land in the same tick the hold completes.
  const statusRef = useRef<Status>('idle')
  const setStatus = (next: Status) => {
    statusRef.current = next
    setStatusState(next)
  }

  useEffect(
    () => () => {
      anim.current?.stop()
      window.clearTimeout(settleTimer.current)
    },
    [],
  )

  const confirm = async () => {
    setStatus('working')
    navigator.vibrate?.(30)
    try {
      await onConfirm()
      setStatus('done')
      settleTimer.current = window.setTimeout(() => {
        progress.set(0)
        setStatus('idle')
        onSettled?.()
      }, 1600)
    } catch {
      animate(progress, 0, { duration: 0.3 })
      setStatus('idle')
    }
  }

  const start = () => {
    if (disabled || statusRef.current !== 'idle') return
    setHint(false)
    setStatus('holding')
    navigator.vibrate?.(8)
    anim.current = animate(progress, 1, {
      duration: (holdMs / 1000) * (1 - progress.get()),
      ease: 'linear',
      onComplete: () => void confirm(),
    })
  }

  const cancel = () => {
    if (statusRef.current !== 'holding') return
    anim.current?.stop()
    const early = progress.get() < 0.25
    animate(progress, 0, { duration: 0.25, ease: 'easeOut' })
    setStatus('idle')
    if (early) {
      setHint(true)
      if (!reduce) void shake.start({ x: [0, -4, 4, -2, 0], transition: { duration: 0.3 } })
    }
  }

  const fill =
    tone === 'danger'
      ? 'bg-gradient-to-r from-[#9c463d] via-rose to-[#c96a5f]'
      : 'bg-gradient-to-r from-gold-600 via-gold to-gold-300'

  const text: Record<Status, ReactNode> = {
    idle: (
      <>
        {icon}
        {label}
      </>
    ),
    holding: (
      <>
        {icon}
        Keep holding…
      </>
    ),
    working: (
      <>
        <CircleNotchIcon weight="bold" className="animate-spin" />
        Working…
      </>
    ),
    done: (
      <>
        <CheckIcon weight="bold" />
        {confirmedLabel}
      </>
    ),
  }

  return (
    <div className={cn('inline-flex flex-col items-start gap-1', className)}>
      <motion.button
        type="button"
        animate={shake}
        disabled={disabled}
        aria-label={`${label} (press and hold)`}
        aria-describedby={hintId}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          start()
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault()
            start()
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') cancel()
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
        className={cn(
          'relative inline-flex w-full items-center justify-center overflow-hidden font-semibold whitespace-nowrap focus-ring select-none',
          'border border-gold/30 bg-bg-elevated/60 text-fg transition-[border-color,box-shadow,opacity] duration-200',
          'hover:border-gold/60 hover:shadow-[0_0_0_4px_rgb(201_154_48/0.12)] disabled:pointer-events-none disabled:opacity-50',
          size === 'sm' ? 'h-9 rounded-lg px-3 text-[13px]' : 'h-11 rounded-xl px-4 text-sm',
          status === 'done' && 'border-emerald/50',
        )}
      >
        <motion.span
          aria-hidden
          className={cn('absolute inset-0 origin-left', status === 'done' ? 'bg-emerald/90' : fill)}
          style={{ scaleX: status === 'done' ? 1 : ring }}
        />
        <span
          className={cn(
            'relative inline-flex items-center gap-2 transition-colors [&_svg]:size-[1.1em]',
            status === 'working' && 'text-white',
            status === 'done' && 'text-ink-900',
          )}
          aria-live="polite"
        >
          {text[status]}
        </span>
      </motion.button>
      <span id={hintId} className={cn('text-[11px] text-muted transition-opacity', hint ? 'opacity-100' : 'sr-only')}>
        Press and hold to confirm
      </span>
    </div>
  )
}
