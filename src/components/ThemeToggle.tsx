import { AnimatePresence, motion } from 'motion/react'
import { Moon, Sun } from 'lucide-react'
import clsx from 'clsx'
import { useTheme } from '../lib/theme'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={clsx(
        'relative grid size-10 place-items-center overflow-hidden rounded-full border border-glass-line bg-glass text-fg backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:shadow-[0_0_0_4px_rgb(202_153_48/0.3)] focus-visible:outline-none',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 14, opacity: 0, rotate: -45 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 45 }}
          transition={{ duration: 0.25 }}
        >
          {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
