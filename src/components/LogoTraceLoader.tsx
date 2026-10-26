import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { LOGO_GROUPS, LOGO_STROKE, LOGO_VIEWBOX_ATTR } from '../lib/logo'

/**
 * Loader built from the Ivy mark. The logo is 11 separate strokes (trunk + 5 mirrored branch pairs),
 * so instead of tracing one outline it "grows" the tree:
 *
 *  loop            a short glowing segment climbs the trunk, then runs out along each branch pair, repeating
 *  closingOutline  once complete, every stroke draws fully (≈60ms stagger per pair)
 *  fadingFill      stroke weight eases up to the real logo weight, so the result matches the logo exactly
 *  done            onDone fires (exactly once)
 *
 * Paths run trunk-end → tip, so travelling forward along a path means growing outward.
 * Colour comes from currentColor.
 */
export type LogoTracePhase = 'loop' | 'closingOutline' | 'fadingFill' | 'done'

export interface LogoTraceLoaderProps {
  /** Show the looping trace. When false and not complete, the finished logo is shown at rest. */
  loading?: boolean
  /** Work finished: close the outline, fill, then call onDone. */
  isComplete?: boolean
  /** Width and height in px (fixed from the first render so layouts never jump). */
  size?: number
  /** Trace stroke width in logo units (the finished logo is 33). */
  strokeWidth?: number
  loopDurationSeconds?: number
  fillFadeSeconds?: number
  className?: string
  ariaLabel?: string
  onDone?: () => void
}

const PAIRS = LOGO_GROUPS.length
const SEGMENT = 0.28 // fraction of each stroke lit by the travelling glow
const CLOSE_STAGGER = 0.06
const CLOSE_DURATION = 0.45

export function LogoTraceLoader({
  loading = true,
  isComplete = false,
  size = 64,
  strokeWidth = 12,
  loopDurationSeconds = 2.4,
  fillFadeSeconds = 0.55,
  className,
  ariaLabel = 'Loading',
  onDone,
}: LogoTraceLoaderProps) {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<LogoTracePhase>(() => (isComplete && reduce ? 'done' : 'loop'))
  const fixedSize = useRef(size).current
  const doneCalled = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Phase machine driven by timers (not animation callbacks), so it always finishes.
  useEffect(() => {
    if (!isComplete) {
      setPhase('loop')
      return
    }
    if (reduce) {
      setPhase('done')
      return
    }
    setPhase('closingOutline')
    const closeMs = (CLOSE_DURATION + CLOSE_STAGGER * (PAIRS - 1)) * 1000
    const t1 = window.setTimeout(() => setPhase('fadingFill'), closeMs)
    const t2 = window.setTimeout(() => setPhase('done'), closeMs + fillFadeSeconds * 1000 + 60)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [isComplete, reduce, fillFadeSeconds])

  useEffect(() => {
    if (phase === 'done' && !doneCalled.current) {
      doneCalled.current = true
      onDoneRef.current?.()
    }
  }, [phase])

  const atRest = phase === 'done' || reduce || (!loading && !isComplete)
  const travel = loopDurationSeconds / (PAIRS + 1.5)

  return (
    <svg
      viewBox={LOGO_VIEWBOX_ATTR}
      width={fixedSize}
      height={fixedSize}
      role="status"
      aria-label={ariaLabel}
      aria-busy={!atRest}
      className={cn('shrink-0 overflow-visible', className)}
      style={{ width: fixedSize, height: fixedSize }}
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {/* Ghost of the full logo */}
        <g opacity={atRest ? 1 : 0.18} strokeWidth={LOGO_STROKE} style={{ transition: 'opacity 0.3s' }}>
          {LOGO_GROUPS.flat().map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        {!atRest && phase === 'loop' && (
          <g strokeWidth={strokeWidth} style={{ filter: 'drop-shadow(0 0 10px currentColor)' }}>
            {LOGO_GROUPS.map((paths, i) =>
              paths.map((d) => {
                const start = 0.01 + i * travel // keyframe times must increase
                const end = start + travel * 1.6
                return (
                  <motion.path
                    key={d}
                    d={d}
                    pathLength={1}
                    strokeDasharray={`${SEGMENT} 2`}
                    initial={{ strokeDashoffset: SEGMENT, opacity: 0 }}
                    animate={{ strokeDashoffset: [SEGMENT, SEGMENT, -1, -1], opacity: [0, 1, 1, 0] }}
                    transition={{
                      duration: loopDurationSeconds,
                      times: [0, start / loopDurationSeconds, Math.min(end / loopDurationSeconds, 0.98), 1],
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )
              }),
            )}
          </g>
        )}

        {(phase === 'closingOutline' || phase === 'fadingFill') && (
          <g>
            {LOGO_GROUPS.map((paths, i) =>
              paths.map((d) => (
                <motion.path
                  key={d}
                  d={d}
                  pathLength={1}
                  strokeDasharray="1 1"
                  initial={{ strokeDashoffset: 1, strokeWidth }}
                  animate={{
                    strokeDashoffset: 0,
                    strokeWidth: phase === 'fadingFill' ? LOGO_STROKE : strokeWidth,
                  }}
                  transition={{
                    strokeDashoffset: { delay: i * CLOSE_STAGGER, duration: CLOSE_DURATION, ease: [0.65, 0, 0.35, 1] },
                    strokeWidth: { duration: fillFadeSeconds, ease: [0.22, 1, 0.36, 1] },
                  }}
                />
              )),
            )}
          </g>
        )}
      </g>
    </svg>
  )
}
