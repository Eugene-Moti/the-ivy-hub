import type { ComponentProps, Ref } from 'react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-gold-300 to-gold text-ink-900 shadow-[0_10px_28px_-12px_rgb(201_154_48/0.85)] hover:brightness-[1.06] active:brightness-95',
  secondary: 'border border-line bg-bg-elevated/70 text-fg hover:border-gold/50 hover:bg-bg-elevated',
  ghost: 'text-muted hover:bg-fg/5 hover:text-fg',
  danger: 'border border-rose/35 bg-rose/10 text-rose hover:bg-rose/15 dark:text-[#e08a80]',
}

export const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-11 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-[15px]',
}

export const buttonBase =
  'focus-ring relative inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-all duration-200 select-none disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-[1.1em] [&_svg]:shrink-0'

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  ref?: Ref<HTMLButtonElement>
}

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ref, ...props }: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  )
}

export function IconButton({ className, label, ...props }: Omit<ButtonProps, 'size'> & { label: string }) {
  return (
    <Button
      aria-label={label}
      title={label}
      variant="ghost"
      className={cn('size-9 rounded-lg p-0 [&_svg]:size-[18px]', className)}
      {...props}
    />
  )
}
