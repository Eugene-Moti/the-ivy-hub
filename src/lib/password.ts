import { z } from 'zod'

/** One rule everywhere: 8+ characters with at least one letter and one number. */
export const passwordRule = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a number')

export function passwordProblem(password: string): string | undefined {
  const r = passwordRule.safeParse(password)
  return r.success ? undefined : r.error.issues[0].message
}
