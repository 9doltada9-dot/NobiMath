// ─── Mastery Tracking ─────────────────────────────────────────────────────────
// A skill is "mastered" after MASTERY_STREAK consecutive correct answers
// all within MASTERY_TIME seconds. Mastery is stored in localStorage.
// ─────────────────────────────────────────────────────────────────────────────

import type { SkillTag } from './types'

export const MASTERY_STREAK = 5   // consecutive correct+fast answers needed
export const MASTERY_TIME   = 8   // seconds threshold for "fast"

export interface MasteryRecord {
  tag: SkillTag
  streak: number        // current consecutive correct+fast count
  mastered: boolean
  masteredAt?: string   // ISO timestamp
}

export type MasteryMap = Record<string, MasteryRecord>

function emptyRecord(tag: SkillTag): MasteryRecord {
  return { tag, streak: 0, mastered: false }
}

/**
 * Update mastery after answering a problem with a given tag.
 * Returns a new MasteryMap (immutable update).
 */
export function updateMastery(
  map: MasteryMap,
  tag: SkillTag,
  isCorrect: boolean,
  timeSeconds: number,
): MasteryMap {
  const prev = map[tag] ?? emptyRecord(tag)
  if (prev.mastered) return map  // already mastered — nothing to do

  const countedAsMastery = isCorrect && timeSeconds <= MASTERY_TIME
  const newStreak = countedAsMastery ? prev.streak + 1 : 0
  const mastered  = newStreak >= MASTERY_STREAK

  return {
    ...map,
    [tag]: {
      tag,
      streak: mastered ? MASTERY_STREAK : newStreak,
      mastered,
      masteredAt: mastered ? new Date().toISOString() : undefined,
    },
  }
}

export function getMasteredSkills(map: MasteryMap): string[] {
  return Object.values(map).filter(r => r.mastered).map(r => r.tag)
}

export function getMasteryProgress(map: MasteryMap, tag: SkillTag): number {
  return (map[tag]?.streak ?? 0) / MASTERY_STREAK
}

// ── Persistence ──────────────────────────────────────────────────────────────
const KEY = (id: string) => `nobi_mastery_${id}`

export function loadMastery(profileId: string): MasteryMap {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(KEY(profileId)) ?? '{}') as MasteryMap
  } catch { return {} }
}

export function saveMastery(profileId: string, map: MasteryMap): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(KEY(profileId), JSON.stringify(map)) } catch { /* ignore */ }
}
