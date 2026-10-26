import { useId, type ComponentProps, type ReactNode, type Ref } from 'react'
import clsx from 'clsx'

interface FloatingInputProps extends Omit<ComponentProps<'input'>, 'placeholder'> {
  label: string
  icon?: ReactNode
  /** Rendered inside the field on the right, e.g. a show/hide toggle. */
  trailing?: ReactNode
  error?: string
  ref?: Ref<HTMLInputElement>
}

export function FloatingInput({ label, icon, trailing, error, className, id, ref, ...props }: FloatingInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`

  return (
    <div className={className}>
      <div className="group relative">
        {icon && (
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within:text-focus [&>svg]:size-[18px]">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={clsx(
            'peer h-14 w-full rounded-xl border bg-field pt-5 pb-1.5 text-[15px] text-fg outline-none',
            'transition-[border-color,box-shadow,background-color] duration-200',
            'focus:border-focus focus:shadow-[0_0_0_4px_rgb(202_153_48/0.18),0_8px_24px_-8px_rgb(202_153_48/0.45)]',
            icon ? 'pl-11' : 'pl-4',
            trailing ? 'pr-12' : 'pr-4',
            error ? 'border-red-500/70' : 'border-line hover:border-focus/50',
          )}
          {...props}
        />
        <label
          htmlFor={inputId}
          className={clsx(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 text-[15px] text-muted transition-all duration-200 ease-out',
            'peer-focus:top-4 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:text-focus',
            'peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-semibold peer-[:not(:placeholder-shown)]:tracking-wide',
            icon ? 'left-11' : 'left-4',
          )}
        >
          {label}
        </label>
        {trailing && <div className="absolute top-1/2 right-2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 pl-1 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
