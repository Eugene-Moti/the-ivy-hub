import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CaretDownIcon, CheckIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { cn } from '../../lib/cn'
import { inputClass } from './Field'

export interface ComboOption {
  value: string
  label: string
  description?: string
}

interface ComboboxProps {
  id?: string
  options: ComboOption[]
  value: string | null
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  /** Pinned action at the bottom of the list, e.g. "+ Add new sales person". */
  footerAction?: { label: ReactNode; onSelect: (query: string) => void }
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  autoFocus?: boolean
}

/** Searchable single-select (ARIA combobox pattern). Type to filter; arrows, Enter and Escape work. */
export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder = 'Search…',
  emptyText = 'No matches',
  footerAction,
  autoFocus,
  ...aria
}: ComboboxProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q)) : options
  }, [options, query])
  const count = filtered.length + (footerAction ? 1 : 0)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => setActive(0), [query])

  const choose = (index: number) => {
    if (index < filtered.length) {
      onChange(filtered[index].value)
      setOpen(false)
      setQuery('')
    } else if (footerAction) {
      footerAction.onSelect(query)
      setOpen(false)
      setQuery('')
    }
  }

  const optionId = (i: number) => `${listId}-opt-${i}`

  return (
    <div ref={root} className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted" />
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && count ? optionId(active) : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={open ? query : (selected?.label ?? '')}
          placeholder={selected ? selected.label : placeholder}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((a) => Math.min(a + 1, count - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter' && open) {
              e.preventDefault()
              if (count) choose(active)
            } else if (e.key === 'Escape' && open) {
              e.stopPropagation()
              setOpen(false)
              setQuery('')
            } else if (e.key === 'Tab') {
              setOpen(false)
            }
          }}
          className={cn(inputClass, 'h-12 pr-10 pl-10')}
          {...aria}
        />
        <CaretDownIcon
          className={cn(
            'pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-gold transition-transform',
            open && 'rotate-180',
          )}
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute inset-x-0 top-full z-30 mt-2 origin-top overflow-hidden rounded-xl border border-glass-line bg-bg-elevated shadow-card"
          >
            <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1.5">
              {filtered.map((o, i) => (
                <li
                  key={o.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={o.value === value}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    i === active ? 'bg-gold/12 text-fg' : 'text-fg/90',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{o.label}</span>
                    {o.description && <span className="block truncate text-xs text-muted">{o.description}</span>}
                  </span>
                  {o.value === value && <CheckIcon weight="bold" className="size-4 shrink-0 text-gold" />}
                </li>
              ))}
              {!filtered.length && <li className="px-3 py-3 text-sm text-muted">{emptyText}</li>}
            </ul>
            {footerAction && (
              <div className="border-t border-line p-1.5">
                <div
                  id={optionId(filtered.length)}
                  role="option"
                  aria-selected={false}
                  onMouseEnter={() => setActive(filtered.length)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(filtered.length)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-link transition-colors',
                    active === filtered.length && 'bg-gold/12',
                  )}
                >
                  {footerAction.label}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
