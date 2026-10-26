// Kenyan numbers: 07XX / 01XX local, 2547XX / +2547XX international. Other countries: +<8–15 digits>.

const clean = (raw: string) => raw.replace(/[\s\-().]/g, '')

/** Returns the number in E.164 form (+2547…), or null when invalid. */
export function normalisePhone(raw: string): string | null {
  const s = clean(raw)
  if (/^0[17]\d{8}$/.test(s)) return `+254${s.slice(1)}`
  if (/^[17]\d{8}$/.test(s)) return `+254${s}`
  if (/^254[17]\d{8}$/.test(s)) return `+${s}`
  if (/^\+254[17]\d{8}$/.test(s)) return s
  // The field is pre-filled with "+254 ", so "+254 0712…" is a common, harmless entry.
  if (/^\+?2540[17]\d{8}$/.test(s)) return `+254${s.slice(s.indexOf('0', 3) + 1)}`
  if (s.startsWith('+254')) return null
  if (/^\+[1-9]\d{7,14}$/.test(s)) return s
  return null
}

export function phoneError(raw: string, label = 'Phone number'): string | undefined {
  const s = clean(raw)
  if (!s || s === '+254') return `${label} is required`
  if (normalisePhone(s)) return undefined
  if (s.startsWith('+') && !s.startsWith('+254')) return 'Enter a valid international number, e.g. +44 7700 900123'
  return 'Enter a valid Kenyan number, e.g. 0712 345 678 or +254 712 345 678'
}

/** +254712345678 → +254 712 345 678 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return ''
  const m = /^\+254(\d{3})(\d{3})(\d{3})$/.exec(e164)
  if (m) return `+254 ${m[1]} ${m[2]} ${m[3]}`
  return e164
}
