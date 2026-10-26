import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircleIcon, InfoIcon, WarningCircleIcon, WarningIcon, XIcon } from '@phosphor-icons/react'
import { uuid } from '../../lib/ids'
import { cn } from '../../lib/cn'

type Tone = 'success' | 'info' | 'warning' | 'error'

interface Toast {
  id: string
  title: string
  description?: string
  tone: Tone
}

interface ToastApi {
  toast: (t: Omit<Toast, 'id' | 'tone'> & { tone?: Tone; durationMs?: number }) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const ICONS: Record<Tone, ReactNode> = {
  success: <CheckCircleIcon weight="fill" className="text-emerald" />,
  info: <InfoIcon weight="fill" className="text-gold" />,
  warning: <WarningIcon weight="fill" className="text-amber" />,
  error: <WarningCircleIcon weight="fill" className="text-rose" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => setToasts((all) => all.filter((t) => t.id !== id)), [])

  const toast = useCallback<ToastApi['toast']>(
    ({ durationMs = 4200, tone = 'success', ...t }) => {
      const id = uuid()
      setToasts((all) => [...all.slice(-3), { id, tone, ...t }])
      window.setTimeout(() => dismiss(id), durationMs)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-2xl border border-glass-line bg-bg-elevated/90 p-4 shadow-card backdrop-blur-xl',
                '[&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0',
              )}
            >
              {ICONS[t.tone]}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="-m-1 rounded-md p-1 text-muted focus-ring transition-colors hover:text-fg"
              >
                <XIcon className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
