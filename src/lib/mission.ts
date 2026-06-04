import type { Op, Profile, Problem, SkillStats } from './types'
import { BASIC_OPS, ADVANCED_OPS, opLevel, OP_META } from './types'
import { generateAdaptiveProblem, getWeakSkills } from './adaptive'

export interface MissionPlan {
  distribution: { op: Op; count: number }[]
  totalQuestions: number
  reasoning: string
}

export function getAgeOps(age: number): Op[] {
  if (age <= 6)  return ['add'] as Op[]
  if (age <= 8)  return ['add', 'sub'] as Op[]
  if (age <= 12) return BASIC_OPS.slice() as Op[]
  return [...BASIC_OPS, ...ADVANCED_OPS] as Op[]
}

// Compute a mission plan from profile data alone — no AI latency, works offline.
// Lower level + more weak tags → more questions assigned to that op.
// Scale question count by age — short enough for young children, long enough for older.
export function getAgeQuestionCount(age: number): number {
  if (age <= 6)  return 10
  if (age <= 8)  return 20
  if (age <= 10) return 30
  if (age <= 12) return 50
  if (age <= 14) return 70
  return 100
}

export function computeMissionPlan(profile: Profile, skillStats: SkillStats): MissionPlan {
  const ops = getAgeOps(profile.age)
  const TOTAL = getAgeQuestionCount(profile.age)

  // Score each op
  const scores: Record<string, number> = {}
  for (const op of ops) {
    const lvl = opLevel(profile, op)
    const levelScore = (11 - lvl) / 10                          // Lv1 → 1.0, Lv10 → 0.1
    const weakTags = getWeakSkills(skillStats, op)
    const weakBoost = Math.min(weakTags.length * 0.1, 0.4)
    scores[op] = levelScore * 0.65 + weakBoost * 0.35
  }

  const totalScore = ops.reduce((s, op) => s + scores[op], 0) || 1
  const sorted = [...ops].sort((a, b) => scores[b] - scores[a])

  // Each op gets at least 1 question; distribute the rest proportionally
  const counts: Record<string, number> = {}
  for (const op of ops) counts[op] = 1
  let remaining = TOTAL - ops.length

  for (const op of sorted) {
    if (remaining <= 0) break
    const extra = Math.min(remaining, Math.round((scores[op] / totalScore) * (TOTAL - ops.length)))
    counts[op] += extra
    remaining -= extra
  }
  if (remaining > 0) counts[sorted[0]] = (counts[sorted[0]] ?? 1) + remaining

  // Reasoning text
  const topOps = sorted.slice(0, 2)
  const reasoning = ops.length === 1
    ? `ฝึก${OP_META[ops[0]].name} ${TOTAL} ข้อ เหมาะกับอายุ ${profile.age} ปี`
    : `เน้น ${topOps.map(op => `${OP_META[op].name} Lv.${opLevel(profile, op)}`).join(' และ ')} เพราะระดับยังต่ำที่สุด พร้อมฝึกวิชาอื่นควบคู่`

  return {
    distribution: ops.map(op => ({ op, count: counts[op] ?? 1 })),
    totalQuestions: TOTAL,
    reasoning,
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateMissionProblems(
  plan: MissionPlan,
  profile: Profile,
  skillStats: SkillStats,
): Problem[] {
  const problems: Problem[] = []
  for (const { op, count } of plan.distribution) {
    const lvl = opLevel(profile, op)
    for (let i = 0; i < count; i++) {
      problems.push(generateAdaptiveProblem(op, lvl, skillStats))
    }
  }
  return shuffle(problems)
}
