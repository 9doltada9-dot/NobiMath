import type { Op, Problem, AnswerRecord } from './types'
import { generateProblem as genProblem } from './problems'

// ─── Age-based operation set ──────────────────────────────────────────────────
// Very young children: only addition (and subtraction at age 7+)
// Multiplication & division only from age 9+
export type AssessmentPhase = { op: Op; label: string; emoji: string }

export const ALL_PHASES: AssessmentPhase[] = [
  { op: 'add', label: 'บวก',  emoji: '➕' },
  { op: 'sub', label: 'ลบ',   emoji: '➖' },
  { op: 'mul', label: 'คูณ',  emoji: '✖️' },
  { op: 'div', label: 'หาร',  emoji: '➗' },
]

export function getAssessmentPhases(age: number): AssessmentPhase[] {
  if (age <= 6)  return ALL_PHASES.slice(0, 1)   // บวก เท่านั้น
  if (age <= 8)  return ALL_PHASES.slice(0, 2)   // บวก + ลบ
  return ALL_PHASES                               // ทุกหัวข้อ (9+)
}

// Legacy export for backwards compat
export const ASSESSMENT_PHASES = ALL_PHASES
export const QUESTIONS_PER_PHASE = 5

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
export function getNextLevel(answers: AnswerRecord[], currentLevel: number): number {
  if (answers.length < 2) return currentLevel

  const recent = answers.slice(-3)
  const recentCount = recent.length
  const correctCount = recent.filter(a => a.isCorrect).length
  const fastCount = recent.filter(a => a.timeSeconds < 8).length

  // Level UP: 3 correct + at least 2 fast
  if (recentCount === 3 && correctCount === 3 && fastCount >= 2) {
    return Math.min(10, currentLevel + 1)
  }

  const last2 = answers.slice(-2)
  const wrong2 = last2.filter(a => !a.isCorrect).length

  // Level DOWN: 2 consecutive wrong
  if (last2.length === 2 && wrong2 === 2) {
    return Math.max(1, currentLevel - 1)
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
