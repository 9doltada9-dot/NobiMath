// ─── Attention State Machine ──────────────────────────────────────────────────
// Tracks the child's attention state during a practice session.
// States: focused | bored | confused | fatigued
//
// Transitions (checked after each answer):
//  → BORED:    last 5 correct, avg time < BORED_SPEED_FACTOR × expected → too easy
//  → CONFUSED: last 3 wrong OR avg time > CONFUSED_SLOW_SEC → too hard / lost
//  → FATIGUED: handled by existing calculateFatigue (practice page)
//  → FOCUSED:  anything else
// ─────────────────────────────────────────────────────────────────────────────

import type { AnswerRecord } from './types'

export type AttentionState = 'focused' | 'bored' | 'confused' | 'fatigued'

const BORED_WINDOW        = 5    // look at last N answers
const BORED_CORRECT_RATE  = 1.0  // all correct
const BORED_FAST_SEC      = 4    // avg < this = suspiciously fast = bored

const CONFUSED_WINDOW     = 3
const CONFUSED_WRONG_RATE = 1.0  // all wrong in window → confused
const CONFUSED_SLOW_SEC   = 25   // avg > this → confused (hesitating)

export interface AttentionResult {
  state: AttentionState
  reason: string  // Thai message for display
}

export function computeAttention(
  answers: AnswerRecord[],
  prevState: AttentionState,
): AttentionResult {
  if (answers.length < 3) return { state: 'focused', reason: '' }

  const last5 = answers.slice(-BORED_WINDOW)
  const last3 = answers.slice(-CONFUSED_WINDOW)

  const last5Correct = last5.filter(a => a.isCorrect).length
  const last5AvgTime = last5.reduce((s, a) => s + a.timeSeconds, 0) / last5.length

  const last3Correct = last3.filter(a => a.isCorrect).length
  const last3AvgTime = last3.reduce((s, a) => s + a.timeSeconds, 0) / last3.length

  // BORED: all correct in window + very fast
  if (
    last5.length >= BORED_WINDOW &&
    last5Correct === last5.length &&
    last5AvgTime < BORED_FAST_SEC
  ) {
    return { state: 'bored', reason: 'ทำได้ดีมาก! ลองโจทย์ยากขึ้นดีกว่า 🚀' }
  }

  // CONFUSED: all wrong in window OR very slow
  if (last3Correct === 0 && last3.length >= CONFUSED_WINDOW) {
    return { state: 'confused', reason: 'ดูเหมือนติดขัด ลองดูวิธีคิดก่อนนะ 💡' }
  }
  if (last3AvgTime > CONFUSED_SLOW_SEC) {
    return { state: 'confused', reason: 'ค่อยๆ คิด ไม่ต้องรีบ 😊' }
  }

  // Preserve fatigued if already set (let fatigue modal handle it)
  if (prevState === 'fatigued') return { state: 'fatigued', reason: '' }

  return { state: 'focused', reason: '' }
}

/**
 * Recommended difficulty adjustment based on attention state.
 * Returns +1, 0, or -1 relative to current level.
 */
export function attentionLevelDelta(state: AttentionState): number {
  if (state === 'bored')    return +1
  if (state === 'confused') return -1
  return 0
}
