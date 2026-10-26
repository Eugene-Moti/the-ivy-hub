import { useTheme } from '../../lib/theme'

// Validated with the dataviz palette checker (light surface #fffdf8, dark surface #151e1a):
// adjacent CVD ΔE ≥ 9.6 light / ≥ 10 dark, normal-vision ΔE ≥ 18.5, including the donut's wrap-around pair.
// Light gold/aqua/magenta sit under 3:1 contrast, so charts always ship visible labels + a table view.
const CATEGORICAL = {
  light: ['#c99a30', '#2a78d6', '#1baf7a', '#6250d6', '#e87ba4'],
  dark: ['#b8892a', '#3987e5', '#199e70', '#9085e9', '#d55181'],
}

// One-hue sequential ramp (gold), lightest = near the surface.
const SEQUENTIAL = {
  light: ['#f5eacf', '#edd8a3', '#e3c06a', '#d6ab4a', '#c99a30', '#9e7620', '#7a5b17'],
  dark: ['#2b2716', '#4a3d18', '#6b551c', '#8f6f22', '#b8892a', '#d6ab4a', '#e3c06a'],
}

export function useChartTheme() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return {
    categorical: CATEGORICAL[theme],
    sequential: SEQUENTIAL[theme],
    series: CATEGORICAL[theme][0],
    other: dark ? '#4d5d55' : '#bdb6a6',
    surface: dark ? '#151e1a' : '#fffdf8',
    grid: dark ? 'rgb(227 192 106 / 0.1)' : 'rgb(14 21 18 / 0.08)',
    axis: dark ? '#9aa79f' : '#5e6a63',
    text: dark ? '#f3eee2' : '#19201c',
    empty: dark ? 'rgb(255 255 255 / 0.04)' : 'rgb(14 21 18 / 0.05)',
  }
}

/** Picks a step from the sequential ramp for value / max (0 → no fill). */
export function rampColor(ramp: string[], value: number, max: number): string | null {
  if (value <= 0 || max <= 0) return null
  const i = Math.min(ramp.length - 1, Math.floor((value / max) * (ramp.length - 1) + 0.0001))
  return ramp[Math.max(0, i)]
}
