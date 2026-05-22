// ─────────────────────────────────────────────────────────────────────────────
// Adaptive weak-spot engine
// ─────────────────────────────────────────────────────────────────────────────
// Tracks how a child performs on each "skill" (op + size + carry/borrow), finds
// the weak ones, and biases problem generation to repeat those weak patterns —
// the core Kumon-style "ฝึกจุดอ่อนซ้ำ" idea. 100% client-side (localStorage),
// so it works on a static GitHub Pages build with no backend.
// ─────────────────────────────────────────────────────────────────────────────

import type { Op, Problem, AnswerRecord, SkillTag, SkillStat, SkillStats } from './types'
import { generateProblem, tagProblem, generateForTag } from './problems'

export { skillLabel, skillEmoji } from './problems'

// ─── Tuning constants ──────────────────────────────────────────────────────────
const MIN_ATTEMPTS = 3      // need at least this many tries before a skill counts
const SLOW_SECONDS = 12     // avg time at/above this is "slow"
const WEAK_THRESHOLD = 0.25 // weaknessScore at/above this = weak
const FOCUS_PROB = 0.55     // chance a generated problem targets a weak skill
const FOCUS_POOL = 3        // pick among this many weakest skills

// ─── Stat math ──────────────────────────────────────────────────────────────────
export function accuracyOf(s: SkillStat): number {
  return s.attempts === 0 ? 1 : s.correct / s.attempts
}

export function avgTimeOf(s: SkillStat): number {
  return s.attempts === 0 ? 0 : s.totalTimeSeconds / s.attempts
}

/** 0 (strong) → 1 (very weak). Returns 0 until MIN_ATTEMPTS samples exist. */
export function weaknessScore(s: SkillStat): number {
  if (s.attempts < MIN_ATTEMPTS) return 0
  const errorRate = 1 - accuracyOf(s)                            // 0..1
  const slowness = Math.min(1, avgTimeOf(s) / (SLOW_SECONDS * 2)) // 0..1
  const recency = Math.min(1, s.recentWrong / 3)                 // 0..1
  return errorRate * 0.6 + slowness * 0.2 + recency * 0.2
}

function emptyStat(tag: SkillTag): SkillStat {
  return { tag, attempts: 0, correct: 0, totalTimeSeconds: 0, recentWrong: 0, lastSeen: '' }
}

/** Fold a batch of answers into the stats map (returns a new object). */
export function recordAnswers(stats: SkillStats, answers: AnswerRecord[]): SkillStats {
  const next: SkillStats = { ...stats }
  for (const ans of answers) {
    const p = ans.problem
    const tags = p.tags ?? tagProblem(p.op ?? 'add', p.a, p.b)
    for (const tag of tags) {
      const prev = next[tag] ?? emptyStat(tag)
      next[tag] = {
        tag,
        attempts: prev.attempts + 1,
        correct: prev.correct + (ans.isCorrect ? 1 : 0),
        totalTimeSeconds: prev.totalTimeSeconds + (ans.timeSeconds || 0),
        recentWrong: ans.isCorrect ? Math.max(0, prev.recentWrong - 1) : prev.recentWrong + 1,
        lastSeen: new Date().toISOString(),
      }
    }
  }
  return next
}

/** Weak skills, strongest-weakness first. Optionally restricted to one operation. */
export function getWeakSkills(stats: SkillStats, op?: Op, min: number = WEAK_THRESHOLD): SkillStat[] {
  return Object.values(stats)
    .filter(s => (op ? s.tag.startsWith(`${op}-`) : true))
    .filter(s => s.attempts >= MIN_ATTEMPTS && weaknessScore(s) >= min)
    .sort((a, b) => weaknessScore(b) - weaknessScore(a))
}

function weightedPick(items: SkillStat[], rng: () => number): SkillStat {
  const weights = items.map(s => Math.max(0.01, weaknessScore(s)))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

/**
 * The adaptive generator used by the practice screen.
 * With probability FOCUS_PROB (when weak skills exist for this op) it drills the
 * weakest skills; otherwise it falls back to a normal level-appropriate problem.
 * `rng` is injectable for deterministic testing.
 */
export function generateAdaptiveProblem(
  op: Op,
  level: number,
  stats: SkillStats,
  rng: () => number = Math.random,
): Problem {
  const weak = getWeakSkills(stats, op)
  if (weak.length > 0 && rng() < FOCUS_PROB) {
    const focus = weightedPick(weak.slice(0, FOCUS_POOL), rng).tag
    const problem = generateForTag(focus, level, rng)
    if (problem) return { ...problem, focusTag: focus }
  }
  return generateProblem(op, level, rng)
}

// ─── Persistence (localStorage, per child profile) ──────────────────────────────
const STORAGE_PREFIX = 'nobi_skills_'

export function loadSkillStats(profileId: string): SkillStats {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + profileId)
    return raw ? (JSON.parse(raw) as SkillStats) : {}
  } catch {
    return {}
  }
}

export function saveSkillStats(profileId: string, stats: SkillStats): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_PREFIX + profileId, JSON.stringify(stats))
  } catch {
    /* ignore quota / private-mode errors */
  }
}
