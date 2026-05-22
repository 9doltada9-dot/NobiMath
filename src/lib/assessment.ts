import type { Problem, AnswerRecord } from './types'

// ─── Problem Generator ────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function generateProblem(level: number): Problem {
  let a: number, b: number

  switch (level) {
    case 1:
      // 1-digit + 1-digit, no carry (sum ≤ 9)
      a = rand(1, 5)
      b = rand(1, 9 - a)
      break

    case 2:
      // 1-digit + 1-digit, with carry (sum 10-18)
      a = rand(4, 9)
      b = rand(Math.max(1, 10 - a), 9)
      break

    case 3:
      // 2-digit + 1-digit, no carry
      do {
        a = rand(10, 90)
        b = rand(1, 9)
      } while ((a % 10) + b >= 10)
      break

    case 4:
      // 2-digit + 1-digit, with carry
      do {
        a = rand(10, 90)
        b = rand(1, 9)
      } while ((a % 10) + b < 10)
      break

    case 5:
      // 2-digit + 2-digit, no carry
      do {
        a = rand(10, 80)
        b = rand(10, 80)
      } while (
        (a % 10) + (b % 10) >= 10 ||
        Math.floor(a / 10) + Math.floor(b / 10) >= 10
      )
      break

    case 6:
      // 2-digit + 2-digit, with carry
      do {
        a = rand(15, 95)
        b = rand(15, 95)
      } while ((a % 10) + (b % 10) < 10)
      break

    case 7:
      // 3-digit + 2-digit
      a = rand(100, 900)
      b = rand(10, 90)
      break

    case 8:
      // 3-digit + 3-digit, no carry in each column
      do {
        a = rand(100, 500)
        b = rand(100, 500)
      } while (
        (a % 10) + (b % 10) >= 10 ||
        (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) >= 10
      )
      break

    case 9:
      // 3-digit + 3-digit
      a = rand(100, 900)
      b = rand(100, 900)
      break

    case 10:
      // 4-digit + 3-digit (high level)
      a = rand(1000, 5000)
      b = rand(100, 900)
      break

    default:
      a = rand(1, 5)
      b = rand(1, 4)
  }

  return { a, b, answer: a + b, level }
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

  // Last 3 answers
  const recent = answers.slice(-3)
  const recentCount = recent.length
  const correctCount = recent.filter(a => a.isCorrect).length
  const fastCount = recent.filter(a => a.timeSeconds < 8).length

  // Level UP: 3 correct + at least 2 fast
  if (recentCount === 3 && correctCount === 3 && fastCount >= 2) {
    return Math.min(10, currentLevel + 1)
  }

  // Last 2 answers
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
  // Group answers by level
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
