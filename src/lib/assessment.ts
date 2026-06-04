import type { Op, Problem, AnswerRecord } from './types'
import { generateProblem as genProblem } from './problems'

// ─── Age-based operation set ──────────────────────────────────────────────────
// Very young children: only addition (and subtraction at age 7+)
// Multiplication & division only from age 9+
export type AssessmentPhase = { op: Op; label: string; emoji: string }

export const ALL_PHASES: AssessmentPhase[] = [
  { op: 'add',         label: 'บวก',     emoji: '➕' },
  { op: 'sub',         label: 'ลบ',      emoji: '➖' },
  { op: 'mul',         label: 'คูณ',     emoji: '✖️' },
  { op: 'div',         label: 'หาร',     emoji: '➗' },
]

export const ALL_PHASES_ADVANCED: AssessmentPhase[] = [
  ...ALL_PHASES,
  { op: 'times_table', label: 'สูตรคูณ', emoji: '📊' },
  { op: 'fraction',    label: 'เศษส่วน', emoji: '½' },
  { op: 'decimal',     label: 'ทศนิยม',  emoji: '0.' },
]

export function getAssessmentPhases(age: number): AssessmentPhase[] {
  if (age <= 6)  return ALL_PHASES.slice(0, 1)   // บวก เท่านั้น
  if (age <= 8)  return ALL_PHASES.slice(0, 2)   // บวก + ลบ
  if (age <= 12) return ALL_PHASES               // บวก ลบ คูณ หาร
  return ALL_PHASES_ADVANCED                     // ทุกวิชา (13+)
}

// Legacy export for backwards compat
export const ASSESSMENT_PHASES = ALL_PHASES
export const QUESTIONS_PER_PHASE = 8

export function phaseOf(questionIndex: number, phases = ALL_PHASES) {
  const idx = Math.min(Math.floor(questionIndex / QUESTIONS_PER_PHASE), phases.length - 1)
  return phases[idx]
}

export function totalQuestionsForAge(age: number): number {
  return getAssessmentPhases(age).length * QUESTIONS_PER_PHASE
}

// ─── Problem Generator ─────────────────────────────────────────────────────────
export function generateProblem(level: number, questionIndex = 0, phases = ALL_PHASES): Problem {
  return genProblem(phaseOf(questionIndex, phases).op, level)
}

// ─── Per-operation final levels ────────────────────────────────────────────────
export function calculatePerOpLevels(
  answers: AnswerRecord[],
  phases: AssessmentPhase[] = ALL_PHASES
): Partial<Record<Op, number>> {
  const result: Partial<Record<Op, number>> = { add: 1, sub: 1, mul: 1, div: 1 }
  phases.forEach(({ op }, pi) => {
    const slice = answers.slice(pi * QUESTIONS_PER_PHASE, (pi + 1) * QUESTIONS_PER_PHASE)
    if (slice.length === 0) return
    result[op] = calculateFinalLevel(slice)
  })
  return result
}

// ─── Starting Level by Age ────────────────────────────────────────────────────
export function getStartingLevel(age: number): number {
  if (age <= 6)  return 1
  if (age <= 8)  return 2
  if (age <= 10) return 3
  if (age <= 12) return 4
  if (age <= 14) return 5
  if (age <= 16) return 6
  return 7
}

// ─── Adaptive Next Level ──────────────────────────────────────────────────────
// Returns the next level to use after each answer.
// More aggressive: wrong/skip → DOWN immediately; 2 correct+fast → UP.
export function getNextLevel(answers: AnswerRecord[], currentLevel: number): number {
  if (answers.length < 1) return currentLevel

  const last = answers[answers.length - 1]

  // Any wrong or skip → level DOWN immediately
  if (!last.isCorrect) {
    return Math.max(1, currentLevel - 1)
  }

  // 2 consecutive correct + at least 1 fast → level UP
  if (answers.length >= 2) {
    const last2 = answers.slice(-2)
    const bothCorrect = last2.every(a => a.isCorrect)
    const fastCount = last2.filter(a => a.timeSeconds < 8).length
    if (bothCorrect && fastCount >= 1) {
      return Math.min(10, currentLevel + 1)
    }
  }

  return currentLevel
}

// ─── Determine Final Level ────────────────────────────────────────────────────
export function calculateFinalLevel(answers: AnswerRecord[]): number {
  const byLevel = new Map<number, AnswerRecord[]>()

  for (const ans of answers) {
    const bucket = byLevel.get(ans.problem.level) ?? []
    bucket.push(ans)
    byLevel.set(ans.problem.level, bucket)
  }

  let highestPassedLevel = 1

  byLevel.forEach((levelAnswers, level) => {
    const accuracy = levelAnswers.filter(a => a.isCorrect).length / levelAnswers.length
    if (accuracy >= 0.7) {
      highestPassedLevel = Math.max(highestPassedLevel, level)
    }
  })

  return highestPassedLevel
}

// ─── Stats Helpers ────────────────────────────────────────────────────────────
export function calcAccuracy(answers: AnswerRecord[]): number {
  if (answers.length === 0) return 0
  return Math.round((answers.filter(a => a.isCorrect).length / answers.length) * 100)
}

export function calcAvgTime(answers: AnswerRecord[]): number {
  if (answers.length === 0) return 0
  const total = answers.reduce((sum, a) => sum + a.timeSeconds, 0)
  return Math.round((total / answers.length) * 10) / 10
}
