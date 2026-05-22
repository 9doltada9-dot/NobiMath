// ─────────────────────────────────────────────────────────────────────────────
// Trophy / achievement system (client-side, localStorage)
// ─────────────────────────────────────────────────────────────────────────────

import type { Op, AnswerRecord } from './types'

// ─── Lifetime aggregate stats (per child) ───────────────────────────────────────
export interface LifetimeStats {
  sessions: number
  problems: number
  correct: number
  perfect: number               // perfect (all-correct) sessions
  fast: number                  // correct answers under FAST_SECONDS
  bestStreak: number
  ops: Partial<Record<Op, number>>  // sessions practiced per operation
}

const FAST_SECONDS = 3

export function emptyLifetime(): LifetimeStats {
  return { sessions: 0, problems: 0, correct: 0, perfect: 0, fast: 0, bestStreak: 0, ops: {} }
}

export function applySession(
  prev: LifetimeStats,
  answers: AnswerRecord[],
  op: Op,
  streak: number,
): LifetimeStats {
  const correct = answers.filter(a => a.isCorrect).length
  const fast = answers.filter(a => a.isCorrect && a.timeSeconds < FAST_SECONDS).length
  const isPerfect = answers.length > 0 && correct === answers.length
  return {
    sessions: prev.sessions + 1,
    problems: prev.problems + answers.length,
    correct: prev.correct + correct,
    perfect: prev.perfect + (isPerfect ? 1 : 0),
    fast: prev.fast + fast,
    bestStreak: Math.max(prev.bestStreak, streak),
    ops: { ...prev.ops, [op]: (prev.ops[op] ?? 0) + 1 },
  }
}

// ─── Trophy definitions ──────────────────────────────────────────────────────
export interface TrophyCtx {
  life: LifetimeStats
  level: number       // math level (1-10)
  totalExp: number
  streak: number
}

export interface Trophy {
  id: string
  name: string
  emoji: string
  desc: string
  condition: (c: TrophyCtx) => boolean
}

export const TROPHIES: Trophy[] = [
  { id: 'first_step',    name: 'ก้าวแรก',         emoji: '🌱', desc: 'ฝึกครบ 1 ครั้ง',           condition: c => c.life.sessions >= 1 },
  { id: 'ten_correct',   name: 'สิบข้อแรก',        emoji: '✅', desc: 'ตอบถูกสะสม 10 ข้อ',        condition: c => c.life.correct >= 10 },
  { id: 'perfect',       name: 'คะแนนเต็ม',        emoji: '🌟', desc: 'ทำคะแนนเต็มได้ 1 ครั้ง',    condition: c => c.life.perfect >= 1 },
  { id: 'speedster',     name: 'มือไว',           emoji: '⚡', desc: 'ตอบถูกเร็ว (< 3 วิ) 20 ข้อ', condition: c => c.life.fast >= 20 },
  { id: 'streak3',       name: 'ไฟแรง 3 วัน',      emoji: '🔥', desc: 'ฝึกต่อเนื่อง 3 วัน',        condition: c => c.life.bestStreak >= 3 },
  { id: 'all_ops',       name: 'ครบเครื่อง',       emoji: '🎯', desc: 'ลองครบทั้ง บวก ลบ คูณ หาร',  condition: c => Object.keys(c.life.ops).length >= 4 },
  { id: 'hundred',       name: 'ร้อยข้อ!',         emoji: '💯', desc: 'ตอบถูกสะสม 100 ข้อ',       condition: c => c.life.correct >= 100 },
  { id: 'perfect5',      name: 'เพอร์เฟกต์ x5',    emoji: '🏅', desc: 'ทำคะแนนเต็ม 5 ครั้ง',       condition: c => c.life.perfect >= 5 },
  { id: 'streak7',       name: 'ไฟลุก 7 วัน',      emoji: '🚀', desc: 'ฝึกต่อเนื่อง 7 วัน',        condition: c => c.life.bestStreak >= 7 },
  { id: 'level5',        name: 'ครึ่งทาง',         emoji: '💫', desc: 'ไปถึงระดับคณิต 5',          condition: c => c.level >= 5 },
  { id: 'level10',       name: 'อัจฉริยะคณิต',     emoji: '👑', desc: 'ไปถึงระดับสูงสุด (10)',      condition: c => c.level >= 10 },
  { id: 'dedicated',     name: 'นักสู้ตัวจริง',     emoji: '💪', desc: 'ฝึกครบ 20 ครั้ง',           condition: c => c.life.sessions >= 20 },
]

// ─── Evaluation ────────────────────────────────────────────────────────────────
export type UnlockedMap = Record<string, string>  // trophyId -> ISO unlock date

/** Returns the ids of trophies whose condition is met that are not yet unlocked. */
export function newlyUnlocked(ctx: TrophyCtx, unlocked: UnlockedMap): string[] {
  return TROPHIES.filter(t => !unlocked[t.id] && t.condition(ctx)).map(t => t.id)
}

export function getTrophy(id: string): Trophy | undefined {
  return TROPHIES.find(t => t.id === id)
}

// ─── Persistence ────────────────────────────────────────────────────────────────
const LIFE_PREFIX = 'nobi_life_'
const TROPHY_PREFIX = 'nobi_trophies_'

export function loadLifetime(profileId: string): LifetimeStats {
  if (typeof window === 'undefined') return emptyLifetime()
  try {
    const raw = window.localStorage.getItem(LIFE_PREFIX + profileId)
    return raw ? { ...emptyLifetime(), ...JSON.parse(raw) } : emptyLifetime()
  } catch {
    return emptyLifetime()
  }
}

export function saveLifetime(profileId: string, life: LifetimeStats): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(LIFE_PREFIX + profileId, JSON.stringify(life)) } catch { /* ignore */ }
}

export function loadTrophies(profileId: string): UnlockedMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(TROPHY_PREFIX + profileId)
    return raw ? (JSON.parse(raw) as UnlockedMap) : {}
  } catch {
    return {}
  }
}

export function saveTrophies(profileId: string, map: UnlockedMap): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(TROPHY_PREFIX + profileId, JSON.stringify(map)) } catch { /* ignore */ }
}
