// ─────────────────────────────────────────────────────────────────────────────
// Problem generation + skill tagging for all four operations (+, −, ×, ÷)
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth used by both the assessment and the practice screens,
// and by the adaptive weak-spot engine. All problems are tagged with
// op-namespaced skill tags (e.g. 'add-d2', 'sub-borrow', 'mul-d3', 'div-d2').
// Answers are kept <= 99999 so they fit the 5-digit numpad.
// ─────────────────────────────────────────────────────────────────────────────

import type { Op, Problem, SkillTag } from './types'
import { OP_META } from './types'

const MAX_ANSWER = 99999

type RNG = () => number

function rand(min: number, max: number, rng: RNG): number {
  if (max < min) max = min
  return Math.floor(rng() * (max - min + 1)) + min
}

function digits(n: number): number {
  return Math.abs(n).toString().length
}

function digitRange(d: number): [number, number] {
  if (d <= 1) return [1, 9]
  const lo = Math.pow(10, d - 1)
  return [lo, lo * 10 - 1]
}

function randDigits(d: number, rng: RNG): number {
  const [lo, hi] = digitRange(d)
  return rand(lo, hi, rng)
}

// ─── Carry / Borrow detection ───────────────────────────────────────────────
export function hasCarry(a: number, b: number): boolean {
  a = Math.abs(a); b = Math.abs(b)
  let carry = 0
  while (a > 0 || b > 0) {
    const sum = (a % 10) + (b % 10) + carry
    if (sum >= 10) return true
    carry = 0
    a = Math.floor(a / 10); b = Math.floor(b / 10)
  }
  return false
}

/** Assumes a >= b. True if any column needs to borrow. */
export function hasBorrow(a: number, b: number): boolean {
  a = Math.abs(a); b = Math.abs(b)
  while (a > 0 || b > 0) {
    if ((a % 10) < (b % 10)) return true
    a = Math.floor(a / 10); b = Math.floor(b / 10)
  }
  return false
}

// ─── Tagging ────────────────────────────────────────────────────────────────
export function tagProblem(op: Op, a: number, b: number): SkillTag[] {
  switch (op) {
    case 'add': return [`add-d${digits(Math.max(a, b))}`, hasCarry(a, b) ? 'add-carry' : 'add-nocarry']
    case 'sub': return [`sub-d${digits(a)}`, hasBorrow(a, b) ? 'sub-borrow' : 'sub-noborrow']
    case 'mul': return [`mul-d${digits(Math.max(a, b))}`]
    case 'div': return [`div-d${digits(a)}`]
  }
}

export function answerOf(op: Op, a: number, b: number): number {
  switch (op) {
    case 'add': return a + b
    case 'sub': return a - b
    case 'mul': return a * b
    case 'div': return Math.floor(a / b)
  }
}

function makeProblem(op: Op, a: number, b: number, level: number): Problem {
  return { a, b, answer: answerOf(op, a, b), level, op, tags: tagProblem(op, a, b) }
}

// ─── Per-operation level generators ──────────────────────────────────────────

function genAdd(level: number, rng: RNG): [number, number] {
  let a: number, b: number
  switch (level) {
    case 1: a = rand(1, 5, rng); b = rand(1, 9 - a, rng); break
    case 2: a = rand(4, 9, rng); b = rand(Math.max(1, 10 - a), 9, rng); break
    case 3: do { a = rand(10, 90, rng); b = rand(1, 9, rng) } while ((a % 10) + b >= 10); break
    case 4: do { a = rand(10, 90, rng); b = rand(1, 9, rng) } while ((a % 10) + b < 10); break
    case 5: do { a = rand(10, 80, rng); b = rand(10, 80, rng) } while ((a % 10) + (b % 10) >= 10 || Math.floor(a / 10) + Math.floor(b / 10) >= 10); break
    case 6: do { a = rand(15, 95, rng); b = rand(15, 95, rng) } while ((a % 10) + (b % 10) < 10); break
    case 7: a = rand(100, 900, rng); b = rand(10, 90, rng); break
    case 8: do { a = rand(100, 500, rng); b = rand(100, 500, rng) } while ((a % 10) + (b % 10) >= 10 || (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) >= 10); break
    case 9: a = rand(100, 900, rng); b = rand(100, 900, rng); break
    case 10: a = rand(1000, 5000, rng); b = rand(100, 900, rng); break
    default: a = rand(1, 5, rng); b = rand(1, 4, rng)
  }
  return [a, b]
}

function genSub(level: number, rng: RNG): [number, number] {
  let a: number, b: number
  switch (level) {
    case 1: a = rand(2, 9, rng); b = rand(1, a, rng); break
    case 2: a = rand(11, 18, rng); b = rand((a % 10) + 1, 9, rng); break          // borrow
    case 3: do { a = rand(20, 99, rng); b = rand(1, 9, rng) } while ((a % 10) < b); break  // no borrow
    case 4: do { a = rand(21, 99, rng); b = rand(1, 9, rng) } while ((a % 10) >= b); break // borrow
    case 5: do { a = rand(30, 99, rng); b = rand(10, 99, rng) } while (a < b || hasBorrow(a, b)); break
    case 6: do { a = rand(30, 99, rng); b = rand(10, 99, rng) } while (a <= b || !hasBorrow(a, b)); break
    case 7: a = rand(100, 999, rng); b = rand(10, 99, rng); break
    case 8: do { a = rand(200, 999, rng); b = rand(100, 999, rng) } while (a < b || hasBorrow(a, b)); break
    case 9: do { a = rand(200, 999, rng); b = rand(100, 999, rng) } while (a <= b || !hasBorrow(a, b)); break
    case 10: a = rand(1000, 9999, rng); b = rand(100, 999, rng); break
    default: a = rand(2, 9, rng); b = rand(1, a, rng)
  }
  if (a < b) { const t = a; a = b; b = t }
  return [a, b]
}

function genMul(level: number, rng: RNG): [number, number] {
  let a: number, b: number
  switch (level) {
    case 1: a = rand(2, 5, rng); b = rand(2, 5, rng); break
    case 2: a = rand(2, 9, rng); b = rand(2, 9, rng); break
    case 3: a = rand(11, 19, rng); b = rand(2, 5, rng); break
    case 4: a = rand(10, 99, rng); b = rand(2, 9, rng); break
    case 5: a = rand(11, 25, rng); b = rand(11, 25, rng); break
    case 6: a = rand(11, 99, rng); b = rand(11, 99, rng); break
    case 7: a = rand(100, 999, rng); b = rand(2, 9, rng); break
    case 8: a = rand(100, 999, rng); b = rand(2, 9, rng); break
    case 9: a = rand(100, 999, rng); b = rand(10, 30, rng); break
    case 10: a = rand(100, 999, rng); b = rand(10, 99, rng); break
    default: a = rand(2, 5, rng); b = rand(2, 5, rng)
  }
  while (a * b > MAX_ANSWER) b = Math.max(2, Math.floor(b / 2))
  return [a, b]
}

/** Returns [dividend, divisor] with exact integer division. */
function genDiv(level: number, rng: RNG): [number, number] {
  let b: number, q: number
  switch (level) {
    case 1: b = rand(2, 5, rng); q = rand(1, 5, rng); break
    case 2: b = rand(2, 9, rng); q = rand(2, 9, rng); break
    case 3: b = rand(2, 9, rng); q = rand(2, 9, rng); break
    case 4: b = rand(3, 9, rng); q = rand(3, 9, rng); break
    case 5: b = rand(2, 9, rng); q = rand(11, 99, rng); break
    case 6: b = rand(11, 30, rng); q = rand(2, 5, rng); break
    case 7: b = rand(2, 9, rng); q = rand(20, 110, rng); break
    case 8: b = rand(11, 40, rng); q = rand(5, 24, rng); break
    case 9: b = rand(11, 99, rng); q = rand(11, 99, rng); break
    case 10: b = rand(100, 300, rng); q = rand(10, 30, rng); break
    default: b = rand(2, 5, rng); q = rand(1, 5, rng)
  }
  let a = q * b
  while (a > MAX_ANSWER) { q = Math.max(1, Math.floor(q / 2)); a = q * b }
  return [a, b]
}

/** Generate a level-appropriate problem for the given operation. */
export function generateProblem(op: Op, level: number, rng: RNG = Math.random): Problem {
  const [a, b] = op === 'add' ? genAdd(level, rng)
    : op === 'sub' ? genSub(level, rng)
    : op === 'mul' ? genMul(level, rng)
    : genDiv(level, rng)
  return makeProblem(op, a, b, level)
}

// ─── Targeted generation for a specific weak skill tag ──────────────────────────

function opOfTag(tag: SkillTag): Op {
  return tag.slice(0, tag.indexOf('-')) as Op
}

function sizedAdd(n: number, rng: RNG, level: number): Problem {
  const a = randDigits(n, rng)
  const b = randDigits(rand(1, n, rng), rng)
  return makeProblem('add', Math.max(a, b), Math.min(a, b), level)
}

function sizedSub(n: number, rng: RNG, level: number): Problem {
  let a = randDigits(n, rng)
  let b = randDigits(rand(1, n, rng), rng)
  if (a < b) { const t = a; a = b; b = t }
  return makeProblem('sub', a, b, level)
}

function sizedMul(n: number, rng: RNG, level: number): Problem {
  const a = randDigits(n, rng)
  let b = n === 1 ? rand(2, 9, rng) : randDigits(rand(1, Math.min(2, n), rng), rng)
  while (a * b > MAX_ANSWER) b = Math.max(2, Math.floor(b / 2))
  return makeProblem('mul', a, b, level)
}

function sizedDiv(n: number, rng: RNG, level: number): Problem {
  const [lo, hi] = digitRange(n)
  const b = rand(2, 12, rng)
  const q = rand(Math.max(1, Math.ceil(lo / b)), Math.max(1, Math.floor(hi / b)), rng)
  return makeProblem('div', q * b, b, level)
}

// Operand digit counts natural at a level — used so carry/borrow drilling works
// even when the level's own generator is fixed to a single variant (e.g. level 5
// addition is always no-carry, so we can't reject-sample a carry out of it).
function addDigitsForLevel(level: number): { a: number; b: number } {
  if (level <= 2) return { a: 1, b: 1 }
  if (level <= 4) return { a: 2, b: 1 }
  if (level <= 6) return { a: 2, b: 2 }
  if (level === 7) return { a: 3, b: 2 }
  if (level <= 9) return { a: 3, b: 3 }
  return { a: 4, b: 3 }
}

function subDigitsForLevel(level: number): { a: number; b: number } {
  if (level <= 4) return { a: 2, b: 1 }   // 2-digit minuend so a borrow is possible
  if (level <= 6) return { a: 2, b: 2 }
  if (level === 7) return { a: 3, b: 2 }
  if (level <= 9) return { a: 3, b: 3 }
  return { a: 4, b: 3 }
}

/**
 * Generate a problem exhibiting `tag`, kept near `level`. Returns null if a
 * carry/borrow constraint can't be satisfied within the sampling budget.
 */
export function generateForTag(tag: SkillTag, level: number, rng: RNG = Math.random): Problem | null {
  const op = opOfTag(tag)
  const rest = tag.slice(tag.indexOf('-') + 1)

  if (rest === 'carry' || rest === 'nocarry') {
    const want = rest === 'carry'
    const d = addDigitsForLevel(level)
    for (let i = 0; i < 200; i++) {
      const a = randDigits(d.a, rng)
      const b = randDigits(d.b, rng)
      if (hasCarry(a, b) === want) return makeProblem('add', a, b, level)
    }
    return null
  }
  if (rest === 'borrow' || rest === 'noborrow') {
    const want = rest === 'borrow'
    const d = subDigitsForLevel(level)
    for (let i = 0; i < 200; i++) {
      let a = randDigits(d.a, rng)
      let b = randDigits(d.b, rng)
      if (a < b) { const t = a; a = b; b = t }
      if (a === b) continue
      if (hasBorrow(a, b) === want) return makeProblem('sub', a, b, level)
    }
    return null
  }
  if (rest[0] === 'd') {
    const n = parseInt(rest.slice(1), 10) || 1
    switch (op) {
      case 'add': return sizedAdd(n, rng, level)
      case 'sub': return sizedSub(n, rng, level)
      case 'mul': return sizedMul(n, rng, level)
      case 'div': return sizedDiv(n, rng, level)
    }
  }
  return null
}

// ─── Friendly Thai labels for a tag (used in the UI) ────────────────────────────
export function skillEmoji(tag: SkillTag): string {
  return OP_META[opOfTag(tag)]?.emoji ?? '🔢'
}

export function skillLabel(tag: SkillTag): string {
  const op = opOfTag(tag)
  const name = OP_META[op]?.name ?? ''
  const rest = tag.slice(tag.indexOf('-') + 1)
  if (rest === 'carry') return `${name}แบบมีทด`
  if (rest === 'nocarry') return `${name}แบบไม่มีทด`
  if (rest === 'borrow') return `${name}แบบมียืม`
  if (rest === 'noborrow') return `${name}แบบไม่มียืม`
  if (rest[0] === 'd') {
    const n = parseInt(rest.slice(1), 10) || 1
    return n >= 4 ? `${name}เลขหลายหลัก` : `${name}เลข ${n} หลัก`
  }
  return name
}
