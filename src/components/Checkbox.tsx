import { type ComponentProps, type ReactNode, type Ref } from 'react'
import { Check } from 'lucide-react'
import clsx from 'clsx'

interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  children: ReactNode
  ref?: Ref<HTMLInputElement>
}

export function Checkbox({ children, className, ref, ...props }: CheckboxProps) {
  return (
    <label className={clsx('group inline-flex cursor-pointer items-center gap-2.5 select-none', className)}>
      <span className="relative grid size-[18px] place-items-center">
        <input
          ref={ref}
          type="checkbox"
          className="peer absolute inset-0 cursor-pointer appearance-none rounded-[5px] border border-line bg-field transition-all duration-200 group-hover:border-focus/60 checked:border-accent checked:bg-accent focus-visible:shadow-[0_0_0_4px_rgb(202_153_48/0.25)]"
          {...props}
        />
        <Check
          strokeWidth={3.2}
          className="pointer-events-none relative size-3 scale-50 text-accent-fg opacity-0 transition-all duration-200 peer-checked:scale-100 peer-checked:opacity-100"
        />
      </span>
      <span className="text-sm text-muted transition-colors group-hover:text-fg">{children}</span>
    </label>
  )
}
