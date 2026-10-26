import { useEffect, useState } from 'react'
import { TIMEZONE } from './config'

const timeFmt = new Intl.DateTimeFormat('en-KE', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})
const dateFmt = new Intl.DateTimeFormat('en-KE', {
  timeZone: TIMEZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Live wall-clock in East Africa Time, ticking once a second. */
export function useNairobiClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    // Align ticks to the second boundary so the display never lags.
    let interval: number | undefined
    const timeout = window.setTimeout(
      () => {
        setNow(new Date())
        interval = window.setInterval(() => setNow(new Date()), 1000)
      },
      1000 - (Date.now() % 1000),
    )
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [])
  return { now, time: timeFmt.format(now), date: dateFmt.format(now) }
}
