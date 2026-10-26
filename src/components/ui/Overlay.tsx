import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { XIcon } from '@phosphor-icons/react'
import { cn } from '../../lib/cn'
import { IconButton } from './Button'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Open dialogs, innermost last: only the top one reacts to Escape / Tab when dialogs are stacked.
const dialogStack: symbol[] = []

/** Escape to close, focus moved inside on open and restored on close, Tab kept inside, body scroll locked. */
function useDialogBehaviour(open: boolean, onClose: () => void, panel: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const token = Symbol('dialog')
    dialogStack.push(token)
    const isTop = () => dialogStack[dialogStack.length - 1] === token
    const previous = document.activeElement as HTMLElement | null
    const raf = requestAnimationFrame(() => {
      const el = panel.current
      if (!el) return
      const target = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE)
      ;(target ?? el).focus()
    })
    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
      if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null)
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialogStack.splice(dialogStack.indexOf(token), 1)
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, panel])
}

interface OverlayProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
}: OverlayProps & { size?: 'sm' | 'md' | 'lg' }) {
  const reduce = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDialogBehaviour(open, onClose, panel)

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cn(
              'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[var(--radius-card)] border border-glass-line bg-bg-elevated shadow-card outline-none sm:rounded-[var(--radius-card)]',
              size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl',
              className,
            )}
          >
            <div
              aria-hidden
              className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/60 to-transparent"
            />
            <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
              <div>
                <h2 id={titleId} className="font-display text-2xl font-medium text-fg">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
              </div>
              <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2">
                <XIcon />
              </IconButton>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">{children}</div>
            {footer && (
              <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Drawer({ open, onClose, title, description, children, footer, className }: OverlayProps) {
  const reduce = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDialogBehaviour(open, onClose, panel)

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[55]">
          <motion.div
            className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className={cn(
              'absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-glass-line bg-bg-elevated shadow-card outline-none',
              className,
            )}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
              <div className="min-w-0">
                <h2 id={titleId} className="truncate font-display text-2xl font-medium text-fg">
                  {title}
                </h2>
                {description && <div className="mt-1 text-sm text-muted">{description}</div>}
              </div>
              <IconButton label="Close" onClick={onClose} className="-mr-2">
                <XIcon />
              </IconButton>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
            {footer && (
              <footer className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-4">{footer}</footer>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
