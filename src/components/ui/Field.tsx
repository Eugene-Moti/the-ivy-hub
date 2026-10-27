import { useId, type ComponentProps, type ReactNode, type Ref } from 'react'
import { cn } from '../../lib/cn'

export const inputClass =
  'w-full rounded-xl border border-line bg-field px-3.5 text-base text-fg sm:text-[15px] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted/70 hover:border-gold/45 focus:border-focus focus:shadow-glow disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-rose/70'

interface FieldProps {
  label: ReactNode
  error?: string
  hint?: ReactNode
  required?: boolean
  className?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
  /** Extra content on the label row (e.g. a counter). */
  aside?: ReactNode
}

/** Label + control + error/hint, wired up for screen readers. */
export function Field({ label, error, hint, required, className, children, aside }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-semibold text-fg/85">
          {label}
          {required && (
            <span className="ml-0.5 text-gold" aria-hidden>
              *
            </span>
          )}
        </label>
        {aside}
      </div>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-rose dark:text-[#e08a80]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function TextInput({ className, ref, ...props }: ComponentProps<'input'> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(inputClass, 'h-12', className)} {...props} />
}

export function TextArea({
  className,
  ref,
  ...props
}: ComponentProps<'textarea'> & { ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <textarea ref={ref} className={cn(inputClass, 'min-h-24 resize-y py-3 leading-relaxed', className)} {...props} />
  )
}

export function Select({ className, ref, ...props }: ComponentProps<'select'> & { ref?: Ref<HTMLSelectElement> }) {
  return <select ref={ref} className={cn(inputClass, 'ivy-select h-12 cursor-pointer pr-10', className)} {...props} />
}

/** Compact select for filter bars. */
export function FilterSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(inputClass, 'ivy-select h-10 cursor-pointer rounded-lg pr-9 text-base sm:text-sm', className)}
      {...props}
    />
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-fg">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border focus-ring transition-colors duration-200 disabled:opacity-50',
          checked ? 'border-gold bg-gold' : 'border-line bg-bg-sunken',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-[18px] rounded-full bg-white shadow transition-transform duration-200',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  )
}
