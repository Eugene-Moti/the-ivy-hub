import type { Profile, Role } from '../data/types'

export type { Role }
export type SessionUser = Profile

export type SignInResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: 'invalid'; attemptsLeft: number }
  | { ok: false; reason: 'locked'; lockedUntil: number }
  | { ok: false; reason: 'inactive' }
  | { ok: false; reason: 'offline' }

export type SignOutReason = 'manual' | 'idle'
