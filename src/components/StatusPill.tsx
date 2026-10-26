import { AnimatePresence, motion } from 'motion/react'
import { ArrowsClockwiseIcon, WarningIcon } from '@phosphor-icons/react'
import { cn } from '../lib/cn'
import { useSync } from '../offline/SyncProvider'
import { LogoTraceLoader } from './LogoTraceLoader'
import { DynamicButton, useDynamicAction } from './ui/DynamicButton'

/** Connection + offline-queue status for the top bar. */
export function StatusPill() {
  const { online, pending, pendingWalkIns, syncing, syncNow } = useSync()
  const action = useDynamicAction(2000)
  const failed = pending.filter((p) => p.lastError)
  const waiting = pendingWalkIns
  const label = !online
    ? waiting
      ? `Offline – ${waiting} walk-in${waiting === 1 ? '' : 's'} waiting to sync`
      : 'Offline'
    : syncing
      ? 'Syncing…'
      : pending.length
        ? `${pending.length} waiting to sync`
        : 'Online'
  const tone = !online || pending.length ? 'amber' : 'emerald'

  return (
    <div className="flex items-center gap-2">
      <motion.div
        layout
        role="status"
        aria-live="polite"
        title={failed.length ? `Last sync error: ${failed[0].lastError}` : undefined}
        className={cn(
          'flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap',
          tone === 'emerald'
            ? 'border-emerald/30 bg-emerald/10 text-[#1f8f4f] dark:text-emerald'
            : 'border-amber/35 bg-amber/12 text-[#9a6a12] dark:text-amber',
        )}
      >
        {syncing ? (
          <LogoTraceLoader
            size={16}
            strokeWidth={22}
            loopDurationSeconds={1.8}
            className="text-current"
            ariaLabel="Syncing"
          />
        ) : (
          <span className="relative flex size-2">
            {online && !pending.length && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald opacity-50" />
            )}
            <span
              className={cn('relative inline-flex size-2 rounded-full', tone === 'emerald' ? 'bg-emerald' : 'bg-amber')}
            />
          </span>
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{online ? (pending.length ? pending.length : 'Online') : 'Offline'}</span>
          </motion.span>
        </AnimatePresence>
        {failed.length > 0 && (
          <WarningIcon weight="fill" className="size-4" aria-label={`${failed.length} item(s) failed to sync`} />
        )}
      </motion.div>
      {online && (pending.length > 0 || action.state !== 'idle') && (
        <DynamicButton
          size="sm"
          variant="secondary"
          state={syncing && action.state === 'idle' ? 'loading' : action.state}
          icon={<ArrowsClockwiseIcon weight="bold" />}
          labels={{ idle: 'Sync now', loading: 'Syncing…', success: 'Synced', error: 'Retry' }}
          onClick={() => void action.run(syncNow).catch(() => {})}
          className="rounded-full"
        />
      )}
    </div>
  )
}
