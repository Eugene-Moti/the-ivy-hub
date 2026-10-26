import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LogoTraceLoader } from './LogoTraceLoader'

/**
 * First-load gate for data pages: the growing-tree loader runs while loading, then resolves into the
 * logo before the content appears. Very fast loads (<300ms) skip the finishing flourish.
 */
export function PageLoader({
  loading,
  label = 'Loading',
  children,
}: {
  loading: boolean
  label?: string
  children: ReactNode
}) {
  const [state, setState] = useState<'loading' | 'finishing' | 'ready'>(loading ? 'loading' : 'ready')
  const shownAt = useRef(Date.now())

  useEffect(() => {
    if (!loading && state === 'loading') setState(Date.now() - shownAt.current < 300 ? 'ready' : 'finishing')
  }, [loading, state])

  if (state === 'ready') return <>{children}</>
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <div className="flex flex-col items-center gap-4">
        <LogoTraceLoader
          size={76}
          className="text-gold"
          isComplete={state === 'finishing'}
          fillFadeSeconds={0.35}
          ariaLabel={label}
          onDone={() => setState('ready')}
        />
        <p className="text-sm text-muted">{label}…</p>
      </div>
    </div>
  )
}
