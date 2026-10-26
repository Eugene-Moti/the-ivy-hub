import { useEffect, useRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '../lib/cn'

export type PrinterStage = 'idle' | 'processing' | 'printing' | 'complete'

interface ReceiptPrinterProps {
  stage: PrinterStage
  labels?: Partial<Record<Exclude<PrinterStage, 'idle'>, string>>
  /** Extra line under the status on the complete stage, e.g. "Saved offline. Will sync". */
  completeNote?: ReactNode
  /** Fires when the paper has finished feeding out (move the stage to "complete"). */
  onPrinted?: () => void
  /** The paper content. */
  children: ReactNode
  className?: string
}

const DEFAULT_LABELS = { processing: 'Processing…', printing: 'Printing…', complete: 'Done' }
const PRINT_SECONDS = 2

/** A small thermal printer that feeds out a receipt once the work is saved. */
export function ReceiptPrinter({ stage, labels, completeNote, onPrinted, children, className }: ReceiptPrinterProps) {
  const reduce = useReducedMotion()
  const text = { ...DEFAULT_LABELS, ...labels }
  const onPrintedRef = useRef(onPrinted)
  onPrintedRef.current = onPrinted

  // Timer-driven so "complete" always arrives even if an animation callback is skipped.
  useEffect(() => {
    if (stage !== 'printing') return
    const id = window.setTimeout(() => onPrintedRef.current?.(), reduce ? 50 : PRINT_SECONDS * 1000 + 100)
    return () => window.clearTimeout(id)
  }, [stage, reduce])

  const led =
    stage === 'processing'
      ? 'bg-amber animate-pulse shadow-[0_0_10px_#e0a336]'
      : stage === 'printing'
        ? 'bg-gold-300 animate-pulse shadow-[0_0_10px_#e3c06a]'
        : stage === 'complete'
          ? 'bg-emerald shadow-[0_0_10px_#2ecc71]'
          : 'bg-ink-600'

  const paperVisible = stage === 'printing' || stage === 'complete'

  return (
    <div className={cn('mx-auto w-full max-w-[360px]', className)}>
      {/* Printer body */}
      <div className="relative z-10 rounded-2xl border border-gold/25 bg-gradient-to-b from-ink-700 to-ink-900 px-5 pt-4 pb-5 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.7)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-30 mix-blend-overlay"
          style={{ backgroundImage: 'url(/textures/plastic-noise.svg)' }}
        />
        <div
          aria-hidden
          className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/60 to-transparent"
        />
        <div className="relative flex items-center gap-2.5" role="status" aria-live="polite">
          <span className={cn('size-2.5 rounded-full transition-colors', led)} />
          <span className="text-[13px] font-semibold text-ivory/90">{stage === 'idle' ? 'Ready' : text[stage]}</span>
        </div>
        {stage === 'complete' && completeNote && (
          <p className="relative mt-1 pl-5 text-xs text-amber">{completeNote}</p>
        )}
        {/* Paper slot */}
        <div className="relative mt-4 h-2.5 rounded-full bg-ink-950 shadow-[inset_0_2px_4px_rgb(0_0_0/0.8)]" />
      </div>

      {/* Paper feed: clipped just under the slot so the receipt appears to come out of it */}
      <div className="relative -mt-3 overflow-hidden px-4 pt-3">
        <motion.div
          initial={false}
          animate={
            paperVisible
              ? reduce
                ? { y: '0%', opacity: 1 }
                : { y: ['-102%', '-72%', '-70%', '-38%', '-36%', '0%'], opacity: 1 }
              : { y: '-102%', opacity: reduce ? 0 : 1 }
          }
          transition={
            paperVisible && !reduce && stage === 'printing'
              ? { duration: PRINT_SECONDS, times: [0, 0.3, 0.38, 0.68, 0.76, 1], ease: 'easeOut' }
              : { duration: reduce ? 0.2 : 0 }
          }
          className="relative"
        >
          <div
            className="relative bg-[#fbf8f1] px-6 pt-6 pb-10 text-ink-900 shadow-[0_14px_30px_-16px_rgb(0_0_0/0.55)]"
            style={{
              // Torn zig-zag bottom edge
              mask: 'conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 16px 100%',
              WebkitMask: 'conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 16px 100%',
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: 'url(/textures/receipt-paper.svg)' }}
            />
            <div className="relative">{children}</div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
