import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import { cn } from '../lib/cn'
import { GOLD, GOLD_DARK, GOLD_LIGHT, LOGO_GROUPS, LOGO_STROKE, LOGO_VIEWBOX, LOGO_VIEWBOX_ATTR } from '../lib/logo'

// Intro timeline (seconds): trunk grows, then each branch pair draws outward (~1.8s), then the
// strokes fill out to full gold weight, then a light sweep loops every few seconds.
const TRUNK_DURATION = 0.55
const PAIR_START = 0.42
const PAIR_STAGGER = 0.2
const PAIR_DURATION = 0.55
const DRAW_END = PAIR_START + PAIR_STAGGER * (LOGO_GROUPS.length - 2) + PAIR_DURATION // ≈ 1.77
const FILL_DURATION = 0.6
const IDLE_START = DRAW_END + FILL_DURATION

interface IvyLogoProps {
  className?: string
  /** Play the draw-on intro. When false (or with reduced motion) the finished mark is shown. */
  intro?: boolean
  /** Looping light sweep after the intro. */
  shimmer?: boolean
  /** Soft glow on hover (sidebar / header marks). */
  hoverGlow?: boolean
  title?: string
}

export function IvyLogo({
  className,
  intro = true,
  shimmer = true,
  hoverGlow = false,
  title = 'The Ivy Group',
}: IvyLogoProps) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const gold = `ivy-gold-${uid}`
  const shine = `ivy-shine-${uid}`
  const mask = `ivy-mask-${uid}`
  const playIntro = intro && !reduce
  const playShimmer = shimmer && !reduce
  const shimmerDelay = playIntro ? IDLE_START + 0.3 : 1.2

  const timing = (group: number) =>
    group === 0
      ? { delay: 0.1, duration: TRUNK_DURATION }
      : { delay: PAIR_START + (group - 1) * PAIR_STAGGER, duration: PAIR_DURATION }

  return (
    <svg
      viewBox={LOGO_VIEWBOX_ATTR}
      className={cn(
        'overflow-visible transition-[filter] duration-500',
        hoverGlow
          ? 'drop-shadow-[0_0_0_rgb(201_154_48/0)] hover:drop-shadow-[0_0_14px_rgb(227_192_106/0.65)]'
          : 'drop-shadow-[0_8px_22px_rgb(201_154_48/0.35)]',
        className,
      )}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient
          id={gold}
          x1="0"
          y1={LOGO_VIEWBOX.y}
          x2="0"
          y2={LOGO_VIEWBOX.y + LOGO_VIEWBOX.h}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={GOLD_LIGHT} />
          <stop offset="0.5" stopColor={GOLD} />
          <stop offset="1" stopColor={GOLD_DARK} />
        </linearGradient>
        <linearGradient id={shine} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#FFF8E6" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFF8E6" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFF8E6" stopOpacity="0" />
        </linearGradient>
        {playShimmer && (
          <mask
            id={mask}
            maskUnits="userSpaceOnUse"
            x={LOGO_VIEWBOX.x}
            y={LOGO_VIEWBOX.y}
            width={LOGO_VIEWBOX.w}
            height={LOGO_VIEWBOX.h}
          >
            <g fill="none" stroke="white" strokeWidth={LOGO_STROKE} strokeLinecap="round" strokeLinejoin="round">
              {LOGO_GROUPS.flat().map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
          </mask>
        )}
      </defs>

      <g fill="none" stroke={`url(#${gold})`} strokeLinecap="round" strokeLinejoin="round">
        {LOGO_GROUPS.map((paths, i) =>
          paths.map((d) =>
            playIntro ? (
              <motion.path
                key={d}
                d={d}
                initial={{ pathLength: 0, opacity: 0, strokeWidth: 7 }}
                animate={{ pathLength: 1, opacity: 1, strokeWidth: LOGO_STROKE }}
                transition={{
                  pathLength: { ...timing(i), ease: [0.65, 0, 0.35, 1] },
                  opacity: { delay: timing(i).delay, duration: 0.15 },
                  strokeWidth: { delay: DRAW_END + i * 0.03, duration: FILL_DURATION, ease: [0.22, 1, 0.36, 1] },
                }}
              />
            ) : (
              <path key={d} d={d} strokeWidth={LOGO_STROKE} />
            ),
          ),
        )}
      </g>

      {playShimmer && (
        <g mask={`url(#${mask})`}>
          <g transform="skewX(-18)">
            <motion.rect
              y={LOGO_VIEWBOX.y - 40}
              width={170}
              height={LOGO_VIEWBOX.h + 80}
              fill={`url(#${shine})`}
              initial={{ x: LOGO_VIEWBOX.x - 120 }}
              animate={{ x: [LOGO_VIEWBOX.x - 120, LOGO_VIEWBOX.x + LOGO_VIEWBOX.w + 260] }}
              transition={{ delay: shimmerDelay, duration: 1.8, repeat: Infinity, repeatDelay: 3.6, ease: 'easeInOut' }}
            />
          </g>
        </g>
      )}
    </svg>
  )
}
