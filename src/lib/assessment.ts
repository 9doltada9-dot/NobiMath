import type { Problem, AnswerRecord } from './types'
import { generateProblem as genProblem } from './problems'

// ─── Problem Generator (assessment uses addition for leveling) ──────────────────
export function generateProblem(level: number): Problem {
  return genProblem('add', level)
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
