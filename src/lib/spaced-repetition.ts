// ─── Spaced Repetition (SM-2 simplified) ─────────────────────────────────────
// Schedules skill reviews using the Ebbinghaus forgetting curve.
// Each SkillStat carries interval + easeFactor; we update them after every answer.
// ─────────────────────────────────────────────────────────────────────────────

export interface SRData {
  interval: number      // days until next review (1 = tomorrow)
  easeFactor: number   // SM-2 ease factor (range 1.3–2.5, default 2.5)
  nextReviewDate: string // ISO date string
  totalReviews: number
}

const DEFAULT_EASE = 2.5
const MIN_EASE     = 1.3
const FAST_SEC     = 6    // threshold for "answered fast"

function isoToday(): string {
  return new Date().toISOString().split('T')[0]
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + Math.round(days))
  return d.toISOString().split('T')[0]
}

export function defaultSR(): SRData {
  return { interval: 1, easeFactor: DEFAULT_EASE, nextReviewDate: isoToday(), totalReviews: 0 }
}

/**
 * Update spaced-rep data after answering a problem.
 * @param sr  existing SR data (or undefined for first time)
 * @param isCorrect  whether the answer was correct
 * @param timeSeconds  how long it took
 * @returns updated SRData
 */
export function updateSR(sr: SRData | undefined, isCorrect: boolean, timeSeconds: number): SRData {
  const prev = sr ?? defaultSR()
  let { interval, easeFactor } = prev
  const fast = timeSeconds <= FAST_SEC

  if (!isCorrect) {
    // Wrong → reset to 1 day, decrease ease
    interval   = 1
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2)
  } else if (fast) {
    // Correct + fast → multiply by ease (strong memory)
    interval   = Math.max(1, Math.round(interval * easeFactor))
    easeFactor = Math.min(DEFAULT_EASE, easeFactor + 0.08)
  } else {
    // Correct but slow → conservative increase (weaker memory)
    interval   = Math.max(1, Math.round(interval * 1.3))
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.05)
  }

  return {
    interval,
    easeFactor,
    nextReviewDate: addDays(interval),
    totalReviews: prev.totalReviews + 1,
  }
}

/** True if the skill is due for review today or overdue. */
export function isDue(sr: SRData | undefined): boolean {
  if (!sr) return true
  return sr.nextReviewDate <= isoToday()
}

/** Days overdue (negative = not yet due). */
export function daysOverdue(sr: SRData | undefined): number {
  if (!sr) return 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due   = new Date(sr.nextReviewDate); due.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - due.getTime()) / 86400000)
}
