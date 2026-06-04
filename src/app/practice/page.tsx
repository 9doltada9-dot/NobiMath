'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { getAvatar } from '@/lib/avatars'
import { calcAccuracy, calcAvgTime } from '@/lib/assessment'
import {
  generateAdaptiveProblem,
  recordAnswers,
  loadSkillStats,
  saveSkillStats,
  getWeakSkills,
  accuracyOf,
  skillLabel,
  skillEmoji,
} from '@/lib/adaptive'
import { LEVEL_META, OP_META, BASIC_OPS, ADVANCED_OPS, opLevel } from '@/lib/types'
import type { Profile, Problem, AnswerRecord, PracticeSession, SkillStats, Op, SessionRecord } from '@/lib/types'
import {
  applySession,
  loadLifetime,
  saveLifetime,
  loadTrophies,
  saveTrophies,
  newlyUnlocked,
  getTrophy,
  TROPHIES,
  type UnlockedMap,
} from '@/lib/trophies'
import { saveProfile, savePracticeSession, callAnalyzeSession } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { pushSession } from '@/lib/sync'
import type { AIFeedback } from '@/lib/types'
import { computeMissionPlan, generateMissionProblems } from '@/lib/mission'
import type { MissionPlan } from '@/lib/mission'
import { getCurrentTier, getNextTier, getTierProgress, getAgeStyle } from '@/lib/tiers'
import type { ExpTier, AgeStyle } from '@/lib/tiers'

const TOTAL_QUESTIONS = 10
const EXP_PER_CORRECT = 10

type Screen = 'dashboard' | 'practice' | 'result' | 'trophies'

function getGameLevel(totalExp: number): number {
  return Math.floor(totalExp / 100) + 1
}
function getExpInCurrentLevel(totalExp: number): number {
  return totalExp % 100
}
function getExpToNextLevel(totalExp: number): number {
  return 100 - (totalExp % 100)
}

function Numpad({
  value,
  onChange,
  onSubmit,
  disabled,
  hasDecimal = false,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled: boolean
  hasDecimal?: boolean
}) {
  function press(key: string) {
    if (disabled) return
    if (key === '⌫') { onChange(value.slice(0, -1)); return }
    if (key === '✓') { onSubmit(); return }
    if (key === '.') {
      if (!value.includes('.') && value.length < 6) onChange(value + key)
      return
    }
    if (value.length < 6) onChange(value + key)
  }

  // Row 3 adds decimal point when in decimal mode (4-col row)
  const row3 = hasDecimal ? ['1', '2', '3', '.'] : ['1', '2', '3']

  return (
    <div className="grid gap-2.5 w-full">
      {[['7', '8', '9'], ['4', '5', '6'], row3, ['⌫', '0', '✓']].map((row, ri) => (
        <div key={ri} className={`grid gap-2.5 ${row.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {row.map(key => {
            const isSubmit = key === '✓'
            const isDelete = key === '⌫'
            const isDot = key === '.'
            return (
              <motion.button
                key={key}
                onClick={() => press(key)}
                disabled={disabled || (isSubmit && !value)}
                className={`
                  h-16 rounded-2xl text-2xl font-extrabold shadow-md
                  active:shadow-sm transition-colors duration-100
                  flex items-center justify-center
                  ${isSubmit
                    ? 'bg-gradient-to-br from-violet-500 to-pink-500 text-white disabled:opacity-40'
                    : isDelete
                      ? 'bg-red-100 text-red-500 hover:bg-red-200'
                      : isDot
                        ? 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border border-cyan-200'
                        : 'bg-white text-gray-700 hover:bg-purple-50 border border-gray-100'
                  }
                `}
                whileTap={{ scale: 0.91 }}
                whileHover={{ scale: 1.04 }}
              >
                {key}
              </motion.button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Fatigue Detection ────────────────────────────────────────────────────────
type FatigueLevel = 'none' | 'mild' | 'moderate' | 'severe'

function getMaxSessionSeconds(age: number): number {
  if (age <= 6)  return 15 * 60
  if (age <= 8)  return 20 * 60
  if (age <= 10) return 25 * 60
  if (age <= 12) return 30 * 60
  if (age <= 15) return 40 * 60
  return 50 * 60
}

function calculateFatigue(
  answers: AnswerRecord[],
  sessionDurationSeconds: number,
  age: number,
): FatigueLevel {
  if (answers.length < 4) return 'none'

  let score = 0

  // 1. Accuracy decline: last 3 vs previous window
  const last3 = answers.slice(-3)
  const prev3 = answers.slice(-6, -3)
  if (prev3.length >= 2) {
    const lastAcc = last3.filter(a => a.isCorrect).length / last3.length
    const prevAcc = prev3.filter(a => a.isCorrect).length / prev3.length
    if (lastAcc < prevAcc - 0.33) score += 25
  }

  // 2. Speed decline: last 3 avg vs earlier avg
  const last3Times = last3.map(a => a.timeSeconds)
  const earlyTimes = answers.slice(0, -3).map(a => a.timeSeconds)
  if (earlyTimes.length >= 3) {
    const lastAvg = last3Times.reduce((s, t) => s + t, 0) / last3Times.length
    const earlyAvg = earlyTimes.reduce((s, t) => s + t, 0) / earlyTimes.length
    if (earlyAvg > 0 && lastAvg > earlyAvg * 2.0) score += 20
    else if (earlyAvg > 0 && lastAvg > earlyAvg * 1.5) score += 10
  }

  // 3. Fast wrong = guessing (answered < 2.5s but still wrong)
  const fastWrong = last3.filter(a => !a.isCorrect && a.timeSeconds < 2.5 && !a.skipped)
  score += fastWrong.length * 12

  // 4. Session duration vs age-appropriate limit
  const maxSec = getMaxSessionSeconds(age)
  const ratio = sessionDurationSeconds / maxSec
  if (ratio >= 1.0) score += 35
  else if (ratio >= 0.8) score += 20
  else if (ratio >= 0.65) score += 10

  // 5. All wrong in last 5 after earlier success (real performance crash)
  if (answers.length >= 8) {
    const last5 = answers.slice(-5)
    const early = answers.slice(0, 3)
    if (last5.every(a => !a.isCorrect) && early.some(a => a.isCorrect)) score += 20
  }

  if (score >= 55) return 'severe'
  if (score >= 30) return 'moderate'
  if (score >= 15) return 'mild'
  return 'none'
}

// ─── Calculation Hint ─────────────────────────────────────────────────────────
/** Column-math visual for addition (with carry) and subtraction (with borrow). */
function ColumnMath({ a, b, op }: { a: number; b: number; op: 'add' | 'sub' }) {
  const ans = op === 'add' ? a + b : a - b
  const n = Math.max(String(a).length, String(b).length, String(Math.abs(ans)).length)
  const pad = (x: number) => String(Math.abs(x)).padStart(n, ' ')
  const aS = pad(a).split('')
  const bS = pad(b).split('')
  const rS = pad(ans).split('')

  // Carries (add) or borrows (sub)
  const carries: (string | null)[] = Array(n).fill(null)
  const borrowedFrom: boolean[] = Array(n).fill(false) // tens+ col that was decremented
  const needBorrow: boolean[] = Array(n).fill(false)    // units col that needed borrow

  if (op === 'add') {
    let carry = 0
    for (let i = n - 1; i >= 0; i--) {
      const ad = parseInt(aS[i]) || 0
      const bd = parseInt(bS[i]) || 0
      const sum = ad + bd + carry
      carry = sum >= 10 ? 1 : 0
      if (carry && i - 1 >= 0) carries[i - 1] = '1'
    }
  } else {
    let borrow = 0
    for (let i = n - 1; i >= 0; i--) {
      const ad = (parseInt(aS[i]) || 0) - borrow
      const bd = parseInt(bS[i]) || 0
      if (ad < bd) { needBorrow[i] = true; borrow = 1; if (i - 1 >= 0) borrowedFrom[i - 1] = true }
      else borrow = 0
    }
  }

  const cell = 'w-7 text-center inline-block text-xl font-black'
  return (
    <div className="font-mono select-none">
      {/* carry row */}
      {op === 'add' && carries.some(c => c) && (
        <div className="flex justify-end mb-0.5">
          {carries.map((c, i) => (
            <span key={i} className={`${cell} text-xs text-rose-500`}>{c ?? ''}</span>
          ))}
        </div>
      )}
      {/* a row */}
      <div className="flex justify-end">
        {aS.map((d, i) => (
          <span key={i} className={`${cell} ${borrowedFrom[i] ? 'text-orange-400' : 'text-gray-800'}`}>
            {borrowedFrom[i] ? (parseInt(d) - 1).toString() : d}
          </span>
        ))}
      </div>
      {/* operator + b row */}
      <div className="flex items-center">
        <span className="w-5 text-right text-lg font-black text-violet-500 mr-0.5">
          {op === 'add' ? '+' : '−'}
        </span>
        <div className="flex">
          {bS.map((d, i) => (
            <span key={i} className={`${cell} ${needBorrow[i] ? 'text-red-500 font-black' : 'text-gray-800'}`}>{d}</span>
          ))}
        </div>
      </div>
      {/* divider */}
      <div className="border-t-2 border-gray-400 my-1 mx-5" />
      {/* result */}
      <div className="flex justify-end">
        {rS.map((d, i) => <span key={i} className={`${cell} text-violet-600`}>{d}</span>)}
      </div>
    </div>
  )
}

function calcHintExplanation(a: number, b: number, op: 'add' | 'sub'): string[] {
  const steps: string[] = []
  const n = Math.max(String(a).length, String(b).length)
  const colNames = ['หลักหน่วย', 'หลักสิบ', 'หลักร้อย', 'หลักพัน']

  if (op === 'add') {
    let carry = 0
    for (let i = n - 1; i >= 0; i--) {
      const ad = Math.floor(a / Math.pow(10, n - 1 - i)) % 10
      const bd = Math.floor(b / Math.pow(10, n - 1 - i)) % 10
      const sum = ad + bd + carry
      const col = colNames[n - 1 - i] ?? `หลักที่ ${n - i}`
      if (sum >= 10) {
        steps.push(`${col}: ${ad}+${bd}${carry > 0 ? `+${carry}(ทด)` : ''}=${sum} → เขียน ${sum % 10} ทด 1`)
        carry = 1
      } else {
        steps.push(`${col}: ${ad}+${bd}${carry > 0 ? `+${carry}(ทด)` : ''}=${sum}`)
        carry = 0
      }
    }
  } else {
    let borrow = 0
    for (let i = n - 1; i >= 0; i--) {
      const col = colNames[n - 1 - i] ?? `หลักที่ ${n - i}`
      let ad = Math.floor(a / Math.pow(10, n - 1 - i)) % 10
      const bd = Math.floor(b / Math.pow(10, n - 1 - i)) % 10
      ad -= borrow
      if (ad < bd) {
        steps.push(`${col}: ${ad}<${bd} → ยืม 1 จาก${colNames[n - i] ?? 'หลักถัดไป'}: ${ad + 10}−${bd}=${ad + 10 - bd}`)
        borrow = 1
      } else {
        steps.push(`${col}: ${ad}−${bd}=${ad - bd}${borrow > 0 ? ' (หลังยืม)' : ''}`)
        borrow = 0
      }
    }
  }
  return steps.reverse()
}

interface CalcHintState { problem: Problem; next: Problem; newAnswers: AnswerRecord[]; newIndex: number }

function CalcHintModal({ state, onContinue }: { state: CalcHintState; onContinue: () => void }) {
  const { problem } = state
  const op = (problem.op ?? 'add') as Op
  const showColumn = (op === 'add' || op === 'sub') &&
    (problem.tags?.includes('add-carry') || problem.tags?.includes('sub-borrow'))
  const steps = showColumn
    ? calcHintExplanation(problem.a, problem.b, op as 'add' | 'sub')
    : []

  return (
    <motion.div
      className="fixed inset-0 bg-indigo-900/75 flex items-center justify-center z-50 p-5"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      >
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-3 text-center">
          <span className="text-3xl">💡</span>
          <p className="text-white font-black text-base mt-1">วิธีคิด</p>
        </div>
        <div className="p-5">
          {showColumn ? (
            <>
              <div className="flex justify-center mb-4">
                <ColumnMath a={problem.a} b={problem.b} op={op as 'add' | 'sub'} />
              </div>
              {steps.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  {steps.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="bg-violet-100 text-violet-600 text-[9px] font-black px-1.5 py-0.5 rounded-full mt-0.5 whitespace-nowrap">
                        ขั้น {i + 1}
                      </span>
                      <p className="text-xs font-semibold text-gray-600">{s}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-gray-400 font-bold text-center mb-3">
                {op === 'add' ? '📌 จำไว้: ถ้าผลบวกหลักหน่วย ≥ 10 ให้ทดเลขไปหลักสิบ'
                              : '📌 จำไว้: ถ้าตัวตั้งน้อยกว่าตัวลบ ให้ยืม 1 จากหลักถัดไป'}
              </p>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-3xl mb-2">{problem.a} {op === 'add' ? '+' : op === 'sub' ? '−' : op === 'mul' ? '×' : '÷'} {problem.b}</p>
              <p className="text-2xl font-black text-violet-600">= {problem.answer}</p>
            </div>
          )}
          <motion.button
            onClick={onContinue}
            className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-extrabold py-4 rounded-2xl shadow-md text-base"
            whileTap={{ scale: 0.97 }}
          >
            เข้าใจแล้ว ต่อไป →
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Character Emoji (age-sensitive animation) ────────────────────────────────
function CharacterEmoji({ tier, ageStyle }: { tier: ExpTier; ageStyle: AgeStyle }) {
  const sizeClass =
    ageStyle === 'cartoon' ? 'text-7xl' :
    ageStyle === 'vibrant' ? 'text-6xl' :
    ageStyle === 'cool'    ? 'text-5xl' : 'text-4xl'

  const animY =
    ageStyle === 'cartoon' ? [0, -14, 0] :
    ageStyle === 'vibrant' ? [0, -8, 0]  :
    ageStyle === 'cool'    ? [0, -4, 0]  : [0, -1, 0]

  const animDur =
    ageStyle === 'cartoon' ? 1.3 :
    ageStyle === 'vibrant' ? 2   :
    ageStyle === 'cool'    ? 2.8 : 4

  const rotateAnim =
    ageStyle === 'cartoon' ? [-6, 6, -6] :
    ageStyle === 'vibrant' ? [-3, 3, -3] : [0, 0, 0]

  const showParticles = ageStyle !== 'sleek' && tier.rank >= 3
  const particleCount = ageStyle === 'cartoon' ? Math.min(tier.particles.length, 3) : Math.min(tier.particles.length, 2)

  return (
    <div className="relative w-[76px] h-[76px] flex items-center justify-center flex-shrink-0">
      {/* Aura glow */}
      <motion.div
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${tier.color}`}
        style={{ opacity: ageStyle === 'cartoon' ? 0.3 : ageStyle === 'vibrant' ? 0.2 : 0.12 }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Character */}
      <motion.span
        className={`${sizeClass} select-none z-10`}
        animate={{ y: animY, rotate: rotateAnim }}
        transition={{ duration: animDur, repeat: Infinity, ease: 'easeInOut' }}
      >
        {tier.emoji}
      </motion.span>
      {/* Floating particles */}
      {showParticles && tier.particles.slice(0, particleCount).map((p, i) => {
        const angle = (i / particleCount) * 360
        const r = ageStyle === 'cartoon' ? 34 : 28
        const cx = Math.cos((angle * Math.PI) / 180) * r
        const cy = Math.sin((angle * Math.PI) / 180) * r
        return (
          <motion.span
            key={i}
            className="absolute text-xs select-none pointer-events-none"
            style={{ top: '50%', left: '50%', marginTop: -8, marginLeft: -8 }}
            animate={{
              x: [cx, cx + Math.cos((angle + 90) * Math.PI / 180) * 6, cx],
              y: [cy, cy + Math.sin((angle + 90) * Math.PI / 180) * 6, cy],
              opacity: [0.4, 0.9, 0.4],
              scale: [0.8, 1.1, 0.8],
            }}
            transition={{ duration: 2 + i * 0.6, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
          >
            {p}
          </motion.span>
        )
      })}
    </div>
  )
}

// ─── Character Progression Card ───────────────────────────────────────────────
function CharacterProgression({
  totalExp, age, streak,
}: {
  totalExp: number
  age: number
  streak: number
}) {
  const tier     = getCurrentTier(totalExp)
  const nextTier = getNextTier(totalExp)
  const progress = getTierProgress(totalExp)
  const ageStyle = getAgeStyle(age)
  const expToNext = nextTier ? nextTier.minExp - totalExp : 0

  return (
    <div className="mb-4">
      {/* ── Top row: character + info ── */}
      <div className="flex items-center gap-3 mb-3">
        <CharacterEmoji tier={tier} ageStyle={ageStyle} />
        <div className="flex-1 min-w-0">
          {/* Tier name */}
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span
              className={`text-xl font-black bg-gradient-to-r ${tier.color} bg-clip-text text-transparent leading-tight`}
            >
              {tier.name}
            </span>
            <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded-full">
              Tier {tier.rank}/10
            </span>
          </div>
          <p className="text-[10px] text-gray-400 font-semibold mb-1 leading-snug">{tier.description}</p>
          {/* EXP — large and prominent */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-violet-600 tabular-nums">
              {totalExp.toLocaleString()}
            </span>
            <span className="text-xs font-black text-violet-400">EXP</span>
            {streak >= 3 && (
              <span className="ml-1 text-[10px] bg-orange-100 text-orange-600 font-black px-2 py-0.5 rounded-full">
                🔥 {streak} วัน
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Progress road to next tier ── */}
      {nextTier ? (
        <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black text-gray-500">🗺 เส้นทางสู่ {nextTier.name}</span>
            <span className="text-[10px] font-bold text-violet-500 tabular-nums">
              อีก {expToNext.toLocaleString()} EXP
            </span>
          </div>
          {/* Road bar */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl flex-shrink-0">{tier.emoji}</span>
            <div className="flex-1 relative h-5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <motion.div
                className={`h-full bg-gradient-to-r ${tier.color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
              />
              {/* YOU marker */}
              <motion.div
                className="absolute top-0 bottom-0 flex items-center justify-center"
                style={{ left: `clamp(4px, ${progress * 100}% - 10px, calc(100% - 24px))` }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2, type: 'spring' }}
              >
                <div className="bg-white rounded-full px-1 py-0.5 shadow text-[9px] font-black text-violet-600 whitespace-nowrap">
                  คุณ
                </div>
              </motion.div>
            </div>
            <span className="text-2xl flex-shrink-0">{nextTier.emoji}</span>
          </div>
          {/* Labels */}
          <div className="flex justify-between">
            <span className="text-[9px] text-gray-400 font-bold">{tier.minExp.toLocaleString()} EXP</span>
            <span className="text-[9px] text-gray-400 font-bold">{nextTier.minExp.toLocaleString()} EXP</span>
          </div>
        </div>
      ) : (
        <motion.div
          className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-2xl p-3 text-center"
          animate={{ boxShadow: ['0 0 0 0 rgba(251,191,36,0)', '0 0 12px 4px rgba(251,191,36,0.4)', '0 0 0 0 rgba(251,191,36,0)'] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <p className="text-sm font-black text-amber-700">🌟 ถึงขั้นสูงสุดแล้ว — พระราชาแห่งคณิตศาสตร์! 👑</p>
        </motion.div>
      )}
    </div>
  )
}

function DashboardScreen({
  profile,
  skillStats,
  selectedOp,
  onSelectOp,
  trophyCount,
  onStart,
  onOpenTrophies,
  onSwitchUser,
  missionPlan,
  onStartMission,
}: {
  profile: Profile
  skillStats: SkillStats
  selectedOp: Op
  onSelectOp: (op: Op) => void
  trophyCount: number
  onStart: () => void
  onOpenTrophies: () => void
  onSwitchUser: () => void
  missionPlan: MissionPlan | null
  onStartMission: () => void
}) {
  const router = useRouter()
  const avatar = getAvatar(profile.avatar)
  const weakSkills = getWeakSkills(skillStats, selectedOp).slice(0, 3)
  const mathLevelMeta = LEVEL_META[profile.level - 1] ?? LEVEL_META[0]
  const gameLevel = getGameLevel(profile.totalExp)
  const expInLevel = getExpInCurrentLevel(profile.totalExp)
  const expToNext = getExpToNextLevel(profile.totalExp)

  const recommendedOp: Op = (() => {
    let rec: Op = 'add'
    let minLvl = Infinity
    for (const op of BASIC_OPS) {
      const ageOk = profile.age <= 6 ? op === 'add' : profile.age <= 8 ? (op === 'add' || op === 'sub') : true
      if (!ageOk) continue
      const lvl = opLevel(profile, op)
      if (lvl < minLvl) { minLvl = lvl; rec = op }
    }
    return rec
  })()

  const [showManual, setShowManual] = useState(false)
  const [lastSession, setLastSession] = useState<{ accuracy: number; expGained: number } | null>(null)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const raw = localStorage.getItem('nobi_last_session')
    if (raw) setLastSession(JSON.parse(raw))
    setStreak(parseInt(localStorage.getItem(`nobi_streak_${profile.id}`) ?? '0', 10))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-4">
      <motion.div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        initial={{ scale: 0.8, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className={`bg-gradient-to-r ${mathLevelMeta.color} p-6 text-center`}>
          <motion.div
            className="w-20 h-20 rounded-full bg-white/30 flex items-center justify-center text-4xl shadow-lg mx-auto mb-3"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {avatar.emoji}
          </motion.div>
          <h1 className="text-white font-black text-xl">{profile.nickname}</h1>
          <p className="text-white/80 text-sm font-semibold mt-0.5">
            {mathLevelMeta.emoji} {mathLevelMeta.name}
          </p>
        </div>

        <div className="p-5">
          <div className="mb-4">
            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1.5">
              <span>&#9889; Game Lv.{gameLevel}</span>
              <span>{expInLevel} / 100 EXP</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${expInLevel}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
            <p className="text-xs text-gray-400 font-semibold mt-1 text-right">
              {'อีก'} {expToNext} EXP {'ถึงเลเวลถัดไป'}
            </p>
          </div>

          <CharacterProgression totalExp={profile.totalExp} age={profile.age} streak={streak} />

          {lastSession && (
            <motion.div
              className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-4 flex items-center justify-between"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div>
                <p className="text-xs text-emerald-600 font-bold">{'เซสชั่นล่าสุด'}</p>
                <p className="text-sm font-black text-emerald-700">
                  {'ความแม่นยำ'} {lastSession.accuracy}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-emerald-500 font-bold">EXP {'ที่ได้'}</p>
                <p className="text-xl font-black text-emerald-600">+{lastSession.expGained}</p>
              </div>
            </motion.div>
          )}

          {weakSkills.length > 0 && (
            <motion.div
              className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-xs text-amber-600 font-black mb-2 flex items-center gap-1">
                {'🎯'} {'จุดอ่อนที่กำลังฝึก'}
              </p>
              <div className="space-y-2">
                {weakSkills.map(s => {
                  const acc = Math.round(accuracyOf(s) * 100)
                  return (
                    <div key={s.tag} className="flex items-center gap-2">
                      <span className="text-base">{skillEmoji(s.tag)}</span>
                      <span className="text-xs font-bold text-gray-600 flex-1 truncate">
                        {skillLabel(s.tag)}
                      </span>
                      <div className="w-16 h-2 bg-amber-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
                          style={{ width: `${acc}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-amber-600 tabular-nums w-9 text-right">
                        {acc}%
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-amber-500 font-semibold mt-2">
                {'Nobi จะเอาจุดอ่อนพวกนี้มาให้ฝึกซ้ำบ่อยขึ้น'} 💪
              </p>
            </motion.div>
          )}

          {/* ─── ภารกิจวันนี้ (AI-curated mix) ─────────────────────────── */}
          {!showManual && missionPlan && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-gray-700">⚡ ภารกิจวันนี้</p>
                <span className="text-[9px] font-bold text-violet-500 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
                  🤖 AI แนะนำ
                </span>
              </div>

              {/* Distribution pills */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {missionPlan.distribution.map(({ op, count }) => {
                  const meta = OP_META[op]
                  const lvl = opLevel(profile, op)
                  return (
                    <div key={op} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                      <span className="text-sm">{meta.emoji}</span>
                      <div>
                        <span className="text-[11px] font-black text-gray-600">{meta.name}</span>
                        <span className="text-[9px] text-gray-400 ml-1">Lv.{lvl}</span>
                      </div>
                      <span className="text-[11px] font-bold text-violet-500 ml-0.5">×{count}</span>
                    </div>
                  )
                })}
              </div>

              {/* Reasoning */}
              <p className="text-[10px] text-gray-400 font-semibold leading-relaxed mb-3">
                {missionPlan.reasoning}
              </p>

              <motion.button
                onClick={onStartMission}
                className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-extrabold text-xl py-5 rounded-2xl shadow-lg mb-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                🚀 เริ่มภารกิจ!
              </motion.button>

              <button
                onClick={() => setShowManual(true)}
                className="w-full text-gray-400 text-[11px] font-semibold hover:text-gray-600 transition-colors py-1"
              >
                เลือกวิชาเองก็ได้ ↓
              </button>
            </motion.div>
          )}

          {/* ─── เลือกเอง (manual) ──────────────────────────────────────── */}
          {showManual && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              {missionPlan && (
                <button
                  onClick={() => setShowManual(false)}
                  className="text-violet-400 text-[11px] font-bold hover:text-violet-600 transition-colors mb-3 flex items-center gap-1"
                >
                  ← ดูภารกิจวันนี้
                </button>
              )}
              <p className="text-xs font-black text-gray-400 mb-2">วันนี้ฝึกอะไรดี?</p>
              <div className="mb-1">
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">พื้นฐาน</p>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {BASIC_OPS.map(op => {
                    const meta = OP_META[op]
                    const active = op === selectedOp
                    const isRec = op === recommendedOp
                    const lvl = opLevel(profile, op)
                    return (
                      <motion.button
                        key={op}
                        onClick={() => onSelectOp(op)}
                        whileTap={{ scale: 0.92 }}
                        className={`relative rounded-2xl py-2.5 flex flex-col items-center transition-colors ${
                          active ? `bg-gradient-to-br ${meta.color} text-white shadow-md` : 'bg-gray-50 text-gray-500 border border-gray-100'
                        }`}
                      >
                        {isRec && !active && (
                          <span className="absolute -top-1.5 -right-1 bg-amber-400 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full leading-none">
                            แนะนำ
                          </span>
                        )}
                        <span className="text-xl font-black leading-none">{meta.symbol}</span>
                        <span className="text-[10px] font-bold mt-1">{meta.name}</span>
                        <span className={`text-[9px] font-semibold mt-0.5 ${active ? 'text-white/70' : 'text-gray-400'}`}>
                          Lv.{lvl}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">ขั้นสูง</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {ADVANCED_OPS.map(op => {
                    const meta = OP_META[op]
                    const active = op === selectedOp
                    const lvl = opLevel(profile, op)
                    return (
                      <motion.button
                        key={op}
                        onClick={() => onSelectOp(op)}
                        whileTap={{ scale: 0.92 }}
                        className={`rounded-2xl py-2.5 flex flex-col items-center transition-colors ${
                          active ? `bg-gradient-to-br ${meta.color} text-white shadow-md` : 'bg-gray-50 text-gray-500 border border-gray-100'
                        }`}
                      >
                        <span className="text-xl font-black leading-none">{meta.symbol}</span>
                        <span className="text-[10px] font-bold mt-1">{meta.name}</span>
                        <span className={`text-[9px] font-semibold mt-0.5 ${active ? 'text-white/70' : 'text-gray-400'}`}>
                          Lv.{lvl}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
              <motion.button
                onClick={onStart}
                className={`w-full bg-gradient-to-r ${OP_META[selectedOp].color} text-white font-extrabold text-xl py-5 rounded-2xl shadow-lg mb-3`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                {'🚀'} {'เริ่มฝึก'}{OP_META[selectedOp].name}!
              </motion.button>
            </motion.div>
          )}

          <button
            onClick={onOpenTrophies}
            className="w-full bg-yellow-50 border border-yellow-200 text-yellow-700 font-black py-3 rounded-2xl mb-3 flex items-center justify-center gap-2 hover:bg-yellow-100 transition-colors"
          >
            {'🏆'} {'ถ้วยรางวัล'} <span className="text-yellow-500">({trophyCount}/{TROPHIES.length})</span>
          </button>

          <button
            onClick={onSwitchUser}
            className="w-full text-violet-400 text-xs font-semibold hover:text-violet-600 transition-colors py-1"
          >
            {'← เปลี่ยนผู้ใช้'}
          </button>

          <button
            onClick={() => router.push('/history')}
            className="w-full text-blue-300 text-xs font-semibold hover:text-blue-500 transition-colors py-1"
          >
            {'📅 ประวัติการฝึก'}
          </button>

          <button
            onClick={() => router.push('/assessment')}
            className="w-full text-amber-400 text-xs font-semibold hover:text-amber-600 transition-colors py-1"
          >
            {'🎓 ทำแบบทดสอบวัดระดับ'}
          </button>

        </div>
      </motion.div>
    </div>
  )
}

function PracticeScreen({
  profile,
  op,
  initialStats,
  onFinish,
  onExit,
  problems: problemQueue,
}: {
  profile: Profile
  op: Op
  initialStats: SkillStats
  onFinish: (answers: AnswerRecord[]) => void
  onExit: () => void
  problems?: Problem[]
}) {
  // Live skill stats updated within the session so later questions adapt too.
  const liveStatsRef = useRef<SkillStats>(initialStats)
  const isMission = !!problemQueue?.length
  const [problem, setProblem] = useState<Problem>(() =>
    problemQueue?.length ? problemQueue[0] : generateAdaptiveProblem(op, opLevel(profile, op), initialStats),
  )
  const currentOpLevel = opLevel(profile, problem.op ?? op)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [inputValue, setInputValue] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const startTimeRef = useRef(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [exitConfirm, setExitConfirm] = useState(false)
  const localQueueRef = useRef<Problem[]>(problemQueue?.length ? [...problemQueue] : [])
  const aiAdjustedRef = useRef(false)
  const [aiAdjusted, setAiAdjusted] = useState(false)
  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const sessionStartRef = useRef(Date.now())
  const lastFatigueModalRef = useRef<FatigueLevel>('none')
  const [fatigueLevel, setFatigueLevel] = useState<FatigueLevel>('none')
  const [showBreakModal, setShowBreakModal] = useState(false)
  const [calcHint, setCalcHint] = useState<CalcHintState | null>(null)

  useEffect(() => {
    if (feedback) return
    timerRef.current = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 200)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [problem, feedback, questionIndex])

  const submitAnswer = useCallback(() => {
    if (feedback || !inputValue) return
    if (timerRef.current) clearInterval(timerRef.current)

    const elapsed = (Date.now() - startTimeRef.current) / 1000

    // Decimal mode: compare as float; fraction/integer: compare as integer
    let isCorrect: boolean
    let userAnswerNum: number | null
    if (problem.displayScale) {
      const userFloat = parseFloat(inputValue)
      userAnswerNum = isNaN(userFloat) ? null : userFloat
      isCorrect = Math.abs(userFloat - problem.answer / problem.displayScale) < 0.0001
    } else {
      const userNum = parseInt(inputValue, 10)
      userAnswerNum = isNaN(userNum) ? null : userNum
      isCorrect = userNum === problem.answer
    }

    const record: AnswerRecord = {
      problem,
      userAnswer: userAnswerNum,
      isCorrect,
      timeSeconds: Math.round(elapsed * 10) / 10,
    }

    setFeedback(isCorrect ? 'correct' : 'wrong')

    // Update in-session skill stats so the next problem can adapt immediately.
    liveStatsRef.current = recordAnswers(liveStatsRef.current, [record])

    setTimeout(() => {
      const newAnswers = [...answers, record]
      setAnswers(newAnswers)
      setInputValue('')
      setFeedback(null)

      // ── Fatigue detection ──
      const sessionSec = (Date.now() - sessionStartRef.current) / 1000
      const newFatigue = calculateFatigue(newAnswers, sessionSec, profile.age)
      setFatigueLevel(newFatigue)
      if (
        (newFatigue === 'moderate' || newFatigue === 'severe') &&
        newFatigue !== lastFatigueModalRef.current
      ) {
        lastFatigueModalRef.current = newFatigue
        setShowBreakModal(true)
      }

      const totalQ = localQueueRef.current.length > 0 ? localQueueRef.current.length : TOTAL_QUESTIONS
      if (questionIndex + 1 >= totalQ) {
        onFinish(newAnswers)
      } else {
        // AI mid-session adaptation: 3 consecutive wrong → detect pattern + rebuild easier
        if (!aiAdjustedRef.current) {
          const recent3 = newAnswers.slice(-3)
          if (recent3.length === 3 && recent3.every(a => !a.isCorrect)) {
            aiAdjustedRef.current = true
            setAiAdjusted(true)
            const failOp = (recent3[recent3.length - 1].problem.op ?? op) as Op
            const easierLvl = Math.max(1, opLevel(profile, failOp) - 1)
            // Identify common tag for specific feedback
            const tagCount: Record<string, number> = {}
            recent3.flatMap(a => a.problem.tags ?? []).forEach(t => { tagCount[t] = (tagCount[t] ?? 0) + 1 })
            const weakTag = Object.entries(tagCount).find(([, c]) => c >= 2)?.[0]
            const tagMsg = weakTag ? ` เรื่อง "${skillLabel(weakTag)}"` : ''
            setAiNotice(`🤖 Nobi ตรวจพบจุดที่ต้องฝึก${tagMsg} — ปรับโจทย์ให้ง่ายขึ้น ฝึกพื้นฐานก่อนแล้วค่อยยาก 💪`)
            setTimeout(() => setAiNotice(null), 6000)
            // Rebuild remaining queue at easier level
            if (localQueueRef.current.length > questionIndex + 1) {
              const remaining = localQueueRef.current.length - questionIndex - 1
              const adapted = Array.from({ length: remaining }, () =>
                generateAdaptiveProblem(failOp, easierLvl, liveStatsRef.current)
              )
              localQueueRef.current = [
                ...localQueueRef.current.slice(0, questionIndex + 1),
                ...adapted,
              ]
            }
          }
        }

        const next = localQueueRef.current.length > questionIndex + 1
          ? localQueueRef.current[questionIndex + 1]
          : generateAdaptiveProblem(op, opLevel(profile, problem.op ?? op), liveStatsRef.current)

        // Show calc hint if answered wrong on a carry/borrow problem
        const shouldHint = !isCorrect && (
          record.problem.tags?.includes('add-carry') || record.problem.tags?.includes('sub-borrow')
        )
        if (shouldHint) {
          setCalcHint({ problem: record.problem, next, newAnswers, newIndex: questionIndex + 1 })
        } else {
          setProblem(next)
          setQuestionIndex(qi => qi + 1)
          setTimeElapsed(0)
          startTimeRef.current = Date.now()
        }
      }
    }, 700)
  }, [problem, feedback, inputValue, answers, questionIndex, profile.level, op, onFinish])

  function dismissCalcHint() {
    if (!calcHint) return
    setProblem(calcHint.next)
    setQuestionIndex(calcHint.newIndex)
    setTimeElapsed(0)
    startTimeRef.current = Date.now()
    setCalcHint(null)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') { submitAnswer(); return }
      if (e.key === 'Backspace') { setInputValue(v => v.slice(0, -1)); return }
      if (e.key === '.' && problem.op === 'decimal') {
        setInputValue(v => !v.includes('.') && v.length < 6 ? v + '.' : v)
        return
      }
      if (/^\d$/.test(e.key)) { setInputValue(v => v.length < 6 ? v + e.key : v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [submitAnswer])

  const avatar = getAvatar(profile.avatar)
  const totalQ = localQueueRef.current.length > 0 ? localQueueRef.current.length : TOTAL_QUESTIONS
  const progress = questionIndex / totalQ
  const correctSoFar = answers.filter(a => a.isCorrect).length
  const timerColor =
    timeElapsed < 10 ? 'text-white' :
    timeElapsed < 20 ? 'text-yellow-300' :
    'text-red-300'
  const bgColor =
    feedback === 'correct' ? 'from-green-400 via-emerald-400 to-teal-500' :
    feedback === 'wrong'   ? 'from-red-400 via-rose-400 to-pink-500' :
    'from-violet-500 via-purple-500 to-pink-500'

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${bgColor} flex flex-col items-center justify-between p-4 pb-6 transition-all duration-300`}
    >
      <div className="w-full max-w-sm pt-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExitConfirm(true)}
              className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-black hover:bg-white/30 active:scale-95 transition-all"
            >
              ✕
            </button>
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatar.color} flex items-center justify-center text-lg shadow-md`}>
              {avatar.emoji}
            </div>
            <span className="text-white font-extrabold text-sm">{profile.nickname}</span>
          </div>
          <motion.div
            className={`font-black text-xl tabular-nums ${timerColor} flex items-center gap-1`}
            animate={timeElapsed >= 20 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: timeElapsed >= 20 ? Infinity : 0 }}
          >
            {'⏱'} {timeElapsed}s
            {fatigueLevel === 'mild' && (
              <motion.span
                className="text-base"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                title="ดูเหมือนเหนื่อยนิดหน่อย"
              >
                🥱
              </motion.span>
            )}
          </motion.div>
          <div className="bg-white/20 rounded-xl px-3 py-1">
            <span className="text-white font-black text-sm">
              {questionIndex + 1}<span className="opacity-60">/{totalQ}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 justify-center mb-1.5">
          {Array.from({ length: totalQ }, (_, i) => {
            const ans = answers[i]
            const isCurrent = i === questionIndex
            return (
              <motion.div
                key={i}
                animate={isCurrent ? { scale: [1, 1.25, 1] } : {}}
                transition={{ duration: 0.8, repeat: isCurrent ? Infinity : 0 }}
                className={`rounded-full transition-colors duration-300 ${
                  ans
                    ? (ans.isCorrect ? 'w-3 h-3 bg-green-400' : 'w-3 h-3 bg-red-400')
                    : isCurrent ? 'w-3.5 h-3.5 bg-white'
                    : 'w-2.5 h-2.5 bg-white/30'
                }`}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-white/70 text-xs font-bold">
          <span>{'ระดับ'} {currentOpLevel}/10</span>
          <span>{'⚡'} +{correctSoFar * EXP_PER_CORRECT} EXP</span>
        </div>

        {/* AI adaptation notice */}
        <AnimatePresence>
          {aiNotice && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-2"
            >
              <div className="bg-white/20 border border-white/30 rounded-2xl px-3 py-2.5 text-white text-[11px] font-bold text-center leading-snug">
                {aiNotice}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full max-w-sm flex-1 flex items-center justify-center py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={questionIndex}
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full bg-white rounded-3xl shadow-2xl p-6 text-center relative overflow-hidden"
          >
            <AnimatePresence>
              {feedback && (
                <motion.div
                  className={`absolute inset-0 flex flex-col items-center justify-center rounded-3xl z-10 ${
                    feedback === 'correct' ? 'bg-green-100/90' : 'bg-red-100/90'
                  }`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.span
                    className="text-7xl"
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    transition={{ duration: 0.4 }}
                  >
                    {feedback === 'correct' ? '🌟' : '💪'}
                  </motion.span>
                  <p className={`text-lg font-black mt-3 ${
                    feedback === 'correct' ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {feedback === 'correct'
                      ? `ถูกต้อง! +${EXP_PER_CORRECT} EXP`
                      : `คำตอบคือ ${
                          problem.displayScale
                            ? (problem.answer / problem.displayScale).toFixed(problem.displayScale === 10 ? 1 : 2)
                            : problem.denominator
                              ? `${problem.answer}/${problem.denominator}`
                              : problem.answer
                        }`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {problem.focusTag ? (
              <div className="mb-3 flex justify-center">
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-black px-3 py-1 rounded-full">
                  {'🎯'} {'ทบทวนจุดอ่อน'}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 mb-3">
                {isMission && (
                  <span className="text-lg">{OP_META[problem.op ?? op].emoji}</span>
                )}
                <p className="text-gray-400 text-xs font-bold tracking-widest uppercase">
                  {OP_META[problem.op ?? op].name}{'ให้ได้เลย'}!
                </p>
              </div>
            )}

            {/* ── Fraction display ── */}
            {problem.op === 'fraction' ? (
              <div className="flex flex-col items-end pr-8 mb-2 gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-5xl font-black text-gray-800 font-mono">{problem.a}</span>
                  <div className="flex flex-col items-center mx-1">
                    <div className="w-1 h-0" />
                    <div className="w-px h-8 bg-gray-300" style={{ writingMode: 'horizontal-tb', borderLeft: '2px solid #9ca3af', transform: 'rotate(20deg)', marginBottom: 2 }} />
                  </div>
                  <span className="text-3xl font-black text-violet-400">{problem.denominator}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-violet-500">+</span>
                  <div className="flex items-center gap-1">
                    <span className="text-5xl font-black text-gray-800 font-mono">{problem.b}</span>
                    <div className="flex flex-col items-center mx-1">
                      <div className="w-px h-8 bg-gray-300" style={{ borderLeft: '2px solid #9ca3af', transform: 'rotate(20deg)', marginBottom: 2 }} />
                    </div>
                    <span className="text-3xl font-black text-violet-400">{problem.denominator}</span>
                  </div>
                </div>
              </div>
            ) : problem.op === 'decimal' ? (
              /* ── Decimal display ── */
              <div className="flex flex-col items-end pr-8 mb-2 gap-1">
                <span className="text-6xl font-black text-gray-800 font-mono tabular-nums">
                  {(problem.a / (problem.displayScale ?? 10)).toFixed(problem.displayScale === 100 ? 2 : 1)}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-cyan-500">+</span>
                  <span className="text-6xl font-black text-gray-800 font-mono tabular-nums">
                    {(problem.b / (problem.displayScale ?? 10)).toFixed(problem.displayScale === 100 ? 2 : 1)}
                  </span>
                </div>
              </div>
            ) : (
              /* ── Standard (add/sub/mul/div/times_table) display ── */
              <div className="flex flex-col items-end pr-8 mb-2 gap-1">
                <span className="text-6xl font-black text-gray-800 font-mono tabular-nums">
                  {problem.a.toLocaleString()}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-violet-500">{OP_META[problem.op ?? op].symbol}</span>
                  <span className="text-6xl font-black text-gray-800 font-mono tabular-nums">
                    {problem.b.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div className="border-b-4 border-gray-200 mx-4 mb-4" />

            <div className="h-16 flex items-center justify-end pr-8 gap-1">
              <AnimatePresence mode="wait">
                {inputValue ? (
                  <motion.span
                    key={inputValue}
                    initial={{ opacity: 0.6, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-5xl font-black text-violet-600 font-mono tabular-nums"
                  >
                    {inputValue}
                  </motion.span>
                ) : (
                  <motion.span
                    key="placeholder"
                    className="text-5xl font-black text-gray-200"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    ?
                  </motion.span>
                )}
              </AnimatePresence>
              {problem.op === 'fraction' && problem.denominator && (
                <span className="text-3xl font-black text-violet-300">/{problem.denominator}</span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="w-full max-w-sm">
        <Numpad
          value={inputValue}
          onChange={setInputValue}
          onSubmit={submitAnswer}
          disabled={!!feedback || exitConfirm}
          hasDecimal={problem.op === 'decimal'}
        />
      </div>

      <AnimatePresence>
        {exitConfirm && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <p className="text-4xl mb-2">🤔</p>
              <p className="font-black text-gray-700 text-xl mb-1">ออกจากการฝึกไหม?</p>
              <p className="text-gray-400 text-sm mb-5">ข้อมูลเซสชั่นนี้จะไม่ถูกบันทึก</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setExitConfirm(false)}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold py-3.5 rounded-2xl hover:bg-gray-200 transition-colors"
                >
                  ฝึกต่อ 💪
                </button>
                <button
                  onClick={onExit}
                  className="flex-1 bg-gradient-to-r from-red-400 to-rose-500 text-white font-bold py-3.5 rounded-2xl shadow-md"
                >
                  ออกเลย ✕
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Break / fatigue recommendation modal ── */}
      <AnimatePresence>
        {showBreakModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            >
              <motion.div
                className="text-5xl mb-3"
                animate={{ rotate: fatigueLevel === 'severe' ? [-5, 5, -5] : 0 }}
                transition={{ duration: 0.5, repeat: fatigueLevel === 'severe' ? Infinity : 0 }}
              >
                {fatigueLevel === 'severe' ? '😵' : '😴'}
              </motion.div>

              <h3 className="font-black text-gray-700 text-xl mb-1">
                {fatigueLevel === 'severe' ? 'เหนื่อยมากแล้วนะ!' : 'เหนื่อยหน่อยแล้วนะ'}
              </h3>
              <p className="text-gray-400 text-sm font-semibold mb-2 leading-snug">
                {fatigueLevel === 'severe'
                  ? 'ระบบตรวจพบว่าสมองต้องการพักผ่อน\nการฝึกต่อตอนนี้อาจไม่ได้ผลดีเท่า'
                  : 'ทำมาได้ดีมากแล้ว!\nลองพักสักครู่ก่อนดีไหม?'}
              </p>

              {/* Stats bar */}
              <div className="bg-gray-50 rounded-2xl p-3 mb-5 flex justify-center gap-4 text-center">
                <div>
                  <div className="text-lg font-black text-violet-600">{answers.filter(a => a.isCorrect).length}</div>
                  <div className="text-[9px] text-gray-400 font-bold">ถูก</div>
                </div>
                <div className="w-px bg-gray-200" />
                <div>
                  <div className="text-lg font-black text-gray-500">{answers.length}</div>
                  <div className="text-[9px] text-gray-400 font-bold">ข้อทำแล้ว</div>
                </div>
                <div className="w-px bg-gray-200" />
                <div>
                  <div className="text-lg font-black text-emerald-600">
                    {answers.length > 0 ? Math.round((answers.filter(a => a.isCorrect).length / answers.length) * 100) : 0}%
                  </div>
                  <div className="text-[9px] text-gray-400 font-bold">แม่นยำ</div>
                </div>
              </div>

              {fatigueLevel === 'severe' ? (
                <div className="space-y-2">
                  <motion.button
                    onClick={() => { setShowBreakModal(false); onFinish(answers) }}
                    className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-extrabold py-4 rounded-2xl shadow-md text-base"
                    whileTap={{ scale: 0.97 }}
                  >
                    จบวันนี้และบันทึกผล 👍
                  </motion.button>
                  <button
                    onClick={() => setShowBreakModal(false)}
                    className="w-full text-gray-400 text-xs font-bold py-2 hover:text-gray-600 transition-colors"
                  >
                    ทำต่อ (ไม่แนะนำ)
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowBreakModal(false)}
                    className="flex-1 bg-gray-100 text-gray-600 font-bold py-3.5 rounded-2xl hover:bg-gray-200 transition-colors"
                  >
                    ทำต่อ 💪
                  </button>
                  <motion.button
                    onClick={() => { setShowBreakModal(false); onExit() }}
                    className="flex-1 bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold py-3.5 rounded-2xl shadow-md"
                    whileTap={{ scale: 0.97 }}
                  >
                    พักก่อน 💤
                  </motion.button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Calculation hint modal ── */}
      <AnimatePresence>
        {calcHint && (
          <CalcHintModal state={calcHint} onContinue={dismissCalcHint} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ResultScreen({
  profile,
  answers,
  op,
  expGained,
  leveledUp,
  opLeveledUp,
  opLeveledDown,
  unlockedTrophyIds,
  aiFeedback,
  aiFeedbackLoading,
  onPlayAgain,
  onHome,
}: {
  profile: Profile
  answers: AnswerRecord[]
  op: Op
  expGained: number
  leveledUp: boolean
  opLeveledUp: boolean
  opLeveledDown: boolean
  unlockedTrophyIds: string[]
  aiFeedback: AIFeedback | null
  aiFeedbackLoading: boolean
  onPlayAgain: () => void
  onHome: () => void
}) {
  const avatar = getAvatar(profile.avatar)
  const accuracy = calcAccuracy(answers)
  const avgTime = calcAvgTime(answers)
  const correctCount = answers.filter(a => a.isCorrect).length
  const confetti = ['🎉', '🌟', '⭐', '✨', '🎊', '💫', '🎈', '🏆']

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center p-4 relative overflow-hidden">
      {confetti.map((e, i) => (
        <motion.span
          key={i}
          className="absolute text-3xl pointer-events-none"
          initial={{ y: '50vh', x: `${8 + i * 11}vw`, opacity: 1, scale: 1 }}
          animate={{ y: '-20vh', opacity: 0, scale: 0.3, rotate: 360 }}
          transition={{ duration: 1.5 + i * 0.2, delay: i * 0.1, ease: 'easeOut' }}
        >
          {e}
        </motion.span>
      ))}

      <motion.div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.3 }}
      >
        <div className="bg-gradient-to-r from-violet-500 to-pink-500 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center text-3xl shadow-lg mx-auto mb-2">
            {avatar.emoji}
          </div>
          <h2 className="text-white font-black text-xl">{'ผลการฝึก'}!</h2>
          <p className="text-white/80 text-sm font-semibold">{profile.nickname}</p>
        </div>

        <div className="p-5">
          {leveledUp && (
            <motion.div
              className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4 mb-4 text-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
            >
              <motion.div
                className="text-4xl mb-1"
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                {'🎊'}
              </motion.div>
              <p className="text-yellow-700 font-black text-base">Game Level Up!</p>
              <p className="text-yellow-500 text-sm font-semibold">{'เก่งมากเลย ขึ้นเลเวลแล้ว'}!</p>
            </motion.div>
          )}

          {opLeveledUp && (
            <motion.div
              className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-3 mb-4 text-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.55, type: 'spring' }}
            >
              <p className="text-emerald-700 font-black text-sm">
                {OP_META[op].emoji} ระดับ{OP_META[op].name}เพิ่มขึ้น → Lv.{opLevel(profile, op)} 🚀
              </p>
            </motion.div>
          )}

          {opLeveledDown && (
            <motion.div
              className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-3 mb-4 text-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.55, type: 'spring' }}
            >
              <p className="text-orange-600 font-black text-sm">
                {OP_META[op].emoji} ปรับระดับ{OP_META[op].name}ลง → Lv.{opLevel(profile, op)} 💪 ฝึกต่อไปนะ!
              </p>
            </motion.div>
          )}

          {unlockedTrophyIds.length > 0 && (
            <motion.div
              className="bg-gradient-to-r from-amber-100 to-yellow-100 border-2 border-amber-300 rounded-2xl p-4 mb-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, type: 'spring' }}
            >
              <p className="text-amber-700 font-black text-sm text-center mb-2">
                {'🏆'} {'ปลดล็อกถ้วยใหม่'}!
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {unlockedTrophyIds.map(id => {
                  const t = getTrophy(id)
                  if (!t) return null
                  return (
                    <motion.div
                      key={id}
                      className="bg-white rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow-sm"
                      initial={{ scale: 0, rotate: -15 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300, delay: 0.8 }}
                    >
                      <span className="text-xl">{t.emoji}</span>
                      <span className="text-xs font-black text-amber-700">{t.name}</span>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}

          <div className="text-center mb-4">
            <motion.div
              className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-pink-500"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.4 }}
            >
              {correctCount}/{TOTAL_QUESTIONS}
            </motion.div>
            <p className="text-gray-400 font-bold text-sm">{'ข้อถูก'}</p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {[
              { label: 'ความแม่นยำ', value: `${accuracy}%`,  emoji: '🎯' },
              { label: 'เวลาเฉลี่ย',  value: `${avgTime}s`,  emoji: '⏱' },
              { label: 'EXP ที่ได้',  value: `+${expGained}`, emoji: '⚡' },
            ].map(stat => (
              <div key={stat.label} className="bg-purple-50 rounded-2xl p-3 text-center">
                <div className="text-xl mb-1">{stat.emoji}</div>
                <div className="text-base font-black text-violet-700">{stat.value}</div>
                <div className="text-xs text-gray-400 font-bold">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Per-question results */}
          <div className="mb-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">ผลรายข้อ</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {answers.map((a, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * i + 0.4, type: 'spring' }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm border ${
                    a.isCorrect
                      ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                      : 'bg-red-100 text-red-500 border-red-200'
                  }`}
                >
                  {a.isCorrect ? '✓' : '✗'}
                </motion.div>
              ))}
            </div>
          </div>

          {/* AI Feedback */}
          {(aiFeedbackLoading || aiFeedback) && (
            <motion.div
              className="bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 rounded-2xl p-4 mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🤖</span>
                <span className="text-xs font-black text-violet-700">Nobi AI วิเคราะห์</span>
                {aiFeedbackLoading && (
                  <motion.span
                    className="text-xs text-violet-400 font-semibold"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    กำลังคิด...
                  </motion.span>
                )}
              </div>

              {aiFeedbackLoading && !aiFeedback && (
                <div className="flex gap-1 justify-center py-2">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-violet-400"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                    />
                  ))}
                </div>
              )}

              {aiFeedback && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-700">{aiFeedback.summary}</p>

                  {aiFeedback.strengths.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-emerald-600 mb-1">✅ จุดแข็ง</p>
                      {aiFeedback.strengths.map((s, i) => (
                        <p key={i} className="text-xs text-gray-600 leading-relaxed">• {s}</p>
                      ))}
                    </div>
                  )}

                  {aiFeedback.weaknesses.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-amber-600 mb-1">🎯 ควรฝึกเพิ่ม</p>
                      {aiFeedback.weaknesses.map((w, i) => (
                        <p key={i} className="text-xs text-gray-600 leading-relaxed">• {w}</p>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 bg-white rounded-xl px-3 py-2 text-center">
                    <p className="text-sm font-black text-violet-600">{aiFeedback.encouragement}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Static fallback encouragement (only when no AI) */}
          {!aiFeedbackLoading && !aiFeedback && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-3 mb-4 text-center">
              <p className="text-yellow-700 font-bold text-sm">
                {accuracy >= 90
                  ? `🌟 ยอดเยี่ยมมาก ${profile.nickname}! เก่งมากเลย!`
                  : accuracy >= 70
                  ? `👍 ดีมาก ${profile.nickname}! ฝึกต่อไปนะ!`
                  : `💪 ${profile.nickname} สู้ต่อไป! ฝึกบ่อยๆ เดี๋ยวเก่งแน่!`}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <motion.button
              onClick={onHome}
              className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-4 rounded-2xl hover:bg-gray-50"
              whileTap={{ scale: 0.97 }}
            >
              {'🏠'} {'หน้าหลัก'}
            </motion.button>
            <motion.button
              onClick={onPlayAgain}
              className="flex-[2] bg-gradient-to-r from-violet-500 to-pink-500 text-white font-extrabold text-lg py-4 rounded-2xl shadow-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {'🔁'} {'ฝึกอีกครั้ง'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function TrophiesScreen({
  unlocked,
  onBack,
}: {
  unlocked: UnlockedMap
  onBack: () => void
}) {
  const unlockedCount = TROPHIES.filter(t => unlocked[t.id]).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex flex-col items-center p-4">
      <div className="w-full max-w-sm pt-2 pb-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="bg-white/20 text-white font-bold rounded-xl px-3 py-1.5 text-sm hover:bg-white/30 transition-colors"
        >
          {'←'} {'กลับ'}
        </button>
        <h1 className="text-white font-black text-lg">{'🏆'} {'ถ้วยรางวัล'}</h1>
        <span className="text-white/90 font-black text-sm tabular-nums">
          {unlockedCount}/{TROPHIES.length}
        </span>
      </div>

      <motion.div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-4"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      >
        <div className="grid grid-cols-2 gap-3">
          {TROPHIES.map((t, i) => {
            const isUnlocked = !!unlocked[t.id]
            return (
              <motion.div
                key={t.id}
                className={`rounded-2xl p-3 text-center border ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
                    : 'bg-gray-50 border-gray-100'
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className={`text-3xl mb-1 ${isUnlocked ? '' : 'grayscale opacity-30'}`}>
                  {isUnlocked ? t.emoji : '🔒'}
                </div>
                <p className={`text-xs font-black ${isUnlocked ? 'text-amber-700' : 'text-gray-400'}`}>
                  {t.name}
                </p>
                <p className="text-[10px] font-semibold text-gray-400 mt-0.5 leading-tight">
                  {t.desc}
                </p>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}

export default function PracticePage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessionAnswers, setSessionAnswers] = useState<AnswerRecord[]>([])
  const [expGained, setExpGained] = useState(0)
  const [leveledUp, setLeveledUp] = useState(false)
  const [skillStats, setSkillStats] = useState<SkillStats>({})
  const [selectedOp, setSelectedOp] = useState<Op>('add')
  const [trophies, setTrophiesState] = useState<UnlockedMap>({})
  const [justUnlocked, setJustUnlocked] = useState<string[]>([])
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null)
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false)
  const [opLeveledUp, setOpLeveledUp] = useState(false)
  const [opLeveledDown, setOpLeveledDown] = useState(false)
  const [missionPlan, setMissionPlan] = useState<MissionPlan | null>(null)
  const [missionProblems, setMissionProblems] = useState<Problem[]>([])
  const [isMission, setIsMission] = useState(false)

  useEffect(() => {
    const rawProfile = localStorage.getItem('nobi_profile')
    if (!rawProfile) { router.replace('/setup'); return }
    const p: Profile = JSON.parse(rawProfile)
    // If no assessment yet, set a default level-1 entry so practice can start
    if (!localStorage.getItem('nobi_assessment')) {
      localStorage.setItem('nobi_assessment', JSON.stringify({ determinedLevel: p.level ?? 1 }))
    }
    setProfile(p)
    const stats = loadSkillStats(p.id)
    setSkillStats(stats)
    setTrophiesState(loadTrophies(p.id))

    // Compute today's mission plan
    const plan = computeMissionPlan(p, stats)
    setMissionPlan(plan)
    setMissionProblems(generateMissionProblems(plan, p, stats))

    // Auto-select the op with the lowest level for this age group
    let rec: Op = 'add'
    let minLvl = Infinity
    for (const op of BASIC_OPS) {
      const ageOk = p.age <= 6 ? op === 'add' : p.age <= 8 ? (op === 'add' || op === 'sub') : true
      if (!ageOk) continue
      const lvl = opLevel(p, op)
      if (lvl < minLvl) { minLvl = lvl; rec = op }
    }
    setSelectedOp(rec)
  }, [router])

  async function handlePracticeFinish(answers: AnswerRecord[]) {
    if (!profile) return

    const correctCount = answers.filter(a => a.isCorrect).length
    const earned = correctCount * EXP_PER_CORRECT
    const accuracy = calcAccuracy(answers)
    const oldGameLevel = getGameLevel(profile.totalExp)
    const newTotalExp = profile.totalExp + earned
    const newGameLevel = getGameLevel(newTotalExp)
    const didLevelUp = newGameLevel > oldGameLevel

    // Auto-adjust level per op — handles both single-op and mission (mixed) sessions
    const newOpLevels = { ...(profile.opLevels ?? {}) }
    const opGroups: Partial<Record<Op, AnswerRecord[]>> = {}
    for (const a of answers) {
      const o = (a.problem.op ?? selectedOp) as Op
      opGroups[o] = [...(opGroups[o] ?? []), a]
    }
    let curOpLevel = opLevel(profile, selectedOp)
    let nextOpLevel = curOpLevel
    ;(Object.entries(opGroups) as [Op, AnswerRecord[]][]).forEach(([o, opAnswers]) => {
      const oAcc = calcAccuracy(opAnswers)
      const oAvg = calcAvgTime(opAnswers)
      const curLvl = opLevel(profile, o)
      let nextLvl = curLvl
      if (oAcc >= 90 && oAvg < 10) nextLvl = Math.min(10, curLvl + 1)
      else if (oAcc < 50) nextLvl = Math.max(1, curLvl - 1)
      newOpLevels[o] = nextLvl
      if (o === selectedOp) { curOpLevel = curLvl; nextOpLevel = nextLvl }
    })

    const updatedProfile: Profile = { ...profile, totalExp: newTotalExp, opLevels: newOpLevels }
    localStorage.setItem('nobi_profile', JSON.stringify(updatedProfile))
    // Sync to profiles array
    try {
      const profiles: Profile[] = JSON.parse(localStorage.getItem('nobi_profiles') ?? '[]')
      const idx = profiles.findIndex(p => p.id === updatedProfile.id)
      if (idx >= 0) { profiles[idx] = updatedProfile; localStorage.setItem('nobi_profiles', JSON.stringify(profiles)) }
    } catch { /* ignore */ }

    localStorage.setItem('nobi_last_session', JSON.stringify({ accuracy, expGained: earned }))

    // Update adaptive skill stats from this session's answers.
    const updatedStats = recordAnswers(skillStats, answers)
    setSkillStats(updatedStats)
    saveSkillStats(profile.id, updatedStats)

    const today = new Date().toDateString()
    const streakKey = `nobi_streak_${profile.id}`
    const lastPracticeKey = `nobi_last_practice_date_${profile.id}`
    const lastPractice = localStorage.getItem(lastPracticeKey)
    let streak = parseInt(localStorage.getItem(streakKey) ?? '0', 10)
    if (lastPractice !== today) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      streak = lastPractice === yesterday.toDateString() ? streak + 1 : 1
      localStorage.setItem(streakKey, String(streak))
      localStorage.setItem(lastPracticeKey, today)
    }

    const sessionId = `session_${Date.now()}`
    const session: PracticeSession = {
      id: sessionId,
      profileId: profile.id,
      scheduledDate: new Date().toISOString().split('T')[0],
      level: curOpLevel,
      problems: answers.map(a => a.problem),
      submittedAnswers: answers,
      score: correctCount,
      accuracy,
      avgTimeSeconds: calcAvgTime(answers),
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }
    savePracticeSession(session).catch(() => {})
    saveProfile(updatedProfile).catch(() => {})

    // Save to local session history
    const histKey = `nobi_history_${profile.id}`
    const hist: SessionRecord[] = JSON.parse(localStorage.getItem(histKey) ?? '[]')
    const newRecord: SessionRecord = {
      id: `s_${Date.now()}`,
      date: new Date().toISOString(),
      op: selectedOp,
      score: correctCount,
      total: answers.length,
      accuracy,
      avgTimeSeconds: calcAvgTime(answers),
      expGained: earned,
      level: profile.level,
    }
    hist.push(newRecord)
    localStorage.setItem(histKey, JSON.stringify(hist.slice(-100)))

    // Push session to cloud if logged in (non-blocking)
    getAuthUser().then(user => {
      if (user) pushSession(newRecord, profile.id, user.id).catch(() => {})
    })

    // Lifetime stats + trophy unlocks.
    const life = applySession(loadLifetime(profile.id), answers, selectedOp, streak)
    saveLifetime(profile.id, life)
    const unlocked = newlyUnlocked(
      { life, level: updatedProfile.level, totalExp: newTotalExp, streak },
      trophies,
    )
    if (unlocked.length > 0) {
      const now = new Date().toISOString()
      const nextMap: UnlockedMap = { ...trophies }
      for (const id of unlocked) nextMap[id] = now
      setTrophiesState(nextMap)
      saveTrophies(profile.id, nextMap)
    }
    setJustUnlocked(unlocked)

    setProfile(updatedProfile)
    setSessionAnswers(answers)
    setExpGained(earned)
    setLeveledUp(didLevelUp)
    setOpLeveledUp(nextOpLevel > curOpLevel)
    setOpLeveledDown(nextOpLevel < curOpLevel)
    setAiFeedback(null)
    setScreen('result')

    // Call AI analysis asynchronously (non-blocking)
    setAiFeedbackLoading(true)
    callAnalyzeSession({
      profileId: profile.id,
      nickname: profile.nickname,
      op: selectedOp,
      level: curOpLevel,
      score: correctCount,
      total: answers.length,
      accuracy,
      avgTimeSeconds: calcAvgTime(answers),
      answers,
    })
      .then(fb => setAiFeedback(fb))
      .catch(() => setAiFeedback(null))
      .finally(() => setAiFeedbackLoading(false))
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            className="text-6xl mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            {'⭐'}
          </motion.div>
          <p className="text-white text-xl font-black animate-pulse">{'กำลังโหลด'}...</p>
        </div>
      </div>
    )
  }

  if (screen === 'practice') {
    return <PracticeScreen profile={profile} op={selectedOp} initialStats={skillStats} onFinish={handlePracticeFinish} onExit={() => { setIsMission(false); setScreen('dashboard') }} problems={isMission ? missionProblems : undefined} />
  }

  if (screen === 'result') {
    return (
      <ResultScreen
        profile={profile}
        answers={sessionAnswers}
        op={selectedOp}
        expGained={expGained}
        leveledUp={leveledUp}
        opLeveledUp={opLeveledUp}
        opLeveledDown={opLeveledDown}
        unlockedTrophyIds={justUnlocked}
        aiFeedback={aiFeedback}
        aiFeedbackLoading={aiFeedbackLoading}
        onPlayAgain={() => { setAiFeedback(null); setOpLeveledUp(false); setOpLeveledDown(false); setScreen('practice') }}
        onHome={() => { setAiFeedback(null); setOpLeveledUp(false); setOpLeveledDown(false); setScreen('dashboard') }}
      />
    )
  }

  if (screen === 'trophies') {
    return <TrophiesScreen unlocked={trophies} onBack={() => setScreen('dashboard')} />
  }

  return (
    <DashboardScreen
      profile={profile}
      skillStats={skillStats}
      selectedOp={selectedOp}
      onSelectOp={setSelectedOp}
      trophyCount={Object.keys(trophies).length}
      onStart={() => { setIsMission(false); setScreen('practice') }}
      onOpenTrophies={() => setScreen('trophies')}
      onSwitchUser={() => router.push('/')}
      missionPlan={missionPlan}
      onStartMission={() => { setIsMission(true); setScreen('practice') }}
    />
  )
}
