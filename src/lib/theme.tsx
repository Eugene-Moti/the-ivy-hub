import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { readJSON, writeJSON } from './storage'

export type ThemePref = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  pref: ThemePref
  theme: Theme
  setPref: (pref: ThemePref) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => {
    const saved = readJSON<ThemePref>('ivy.theme')
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  })
  const [systemDark, setSystemDark] = useState(() => media().matches)

  useEffect(() => {
    const mq = media()
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const theme: Theme = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next)
    writeJSON('ivy.theme', next)
  }, [])

  const toggle = useCallback(() => setPref(theme === 'dark' ? 'light' : 'dark'), [theme, setPref])

  return <ThemeContext.Provider value={{ pref, theme, setPref, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
