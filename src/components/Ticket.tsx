import { useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import Tilt from 'react-parallax-tilt'
import { cn } from '../lib/cn'

interface TicketProps {
  /** Ticket body (left). */
  children: ReactNode
  /** Tear-off stub (right). */
  stub: ReactNode
  className?: string
  /** Subtle 3D tilt + glare on hover (desktop pointers only, never with reduced motion). */
  tilt?: boolean
}

function useFinePointer() {
  const [fine, setFine] = useState(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const on = () => setFine(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return fine
}

// Half-circle notches where the stub tears off.
const NOTCH_MASK =
  'radial-gradient(circle 11px at calc(100% - var(--stub)) 0, #0000 98%, #000) top / 100% 51% no-repeat, radial-gradient(circle 11px at calc(100% - var(--stub)) 100%, #0000 98%, #000) bottom / 100% 51% no-repeat'

/** Gold paper ticket with charcoal ink and a perforated stub. Prints in colour. */
export function Ticket({ children, stub, className, tilt = true }: TicketProps) {
  const reduce = useReducedMotion()
  const finePointer = useFinePointer()
  const enableTilt = tilt && !reduce && finePointer

  const ticket = (
    <div
      className="ivy-ticket relative flex overflow-hidden rounded-[18px] text-ink-900 shadow-[0_22px_45px_-22px_rgb(158_118_32/0.9)] [--stub:9.5rem]"
      style={{
        background: 'linear-gradient(135deg, #e3c06a 0%, #c99a30 46%, #b8892a 100%)',
        mask: NOTCH_MASK,
        WebkitMask: NOTCH_MASK,
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-multiply"
        style={{ backgroundImage: 'url(/textures/receipt-paper.svg)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20 mix-blend-soft-light"
        style={{ backgroundImage: 'url(/textures/plastic-noise.svg)' }}
      />
      <div className="relative min-w-0 flex-1 p-6">{children}</div>
      <div className="relative w-[var(--stub)] shrink-0 border-l-2 border-dashed border-ink-900/30 p-5">{stub}</div>
    </div>
  )

  if (!enableTilt) return <div className={className}>{ticket}</div>
  return (
    <Tilt
      className={cn('[transform-style:preserve-3d]', className)}
      tiltMaxAngleX={7}
      tiltMaxAngleY={9}
      perspective={1100}
      scale={1.015}
      transitionSpeed={1400}
      glareEnable
      glareMaxOpacity={0.28}
      glareColor="#fff8e6"
      glarePosition="all"
      glareBorderRadius="18px"
    >
      {ticket}
    </Tilt>
  )
}
