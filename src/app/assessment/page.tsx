'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { getAvatar } from '@/lib/avatars'
import {
  generateProblem,
  getStartingLevel,
  getNextLevel,
  calculateFinalLevel,
  calculatePerOpLevels,
  calcAccuracy,
  calcAvgTime,
  phaseOf,
  ASSESSMENT_PHASES,
  QUESTIONS_PER_PHASE,
} from '@/lib/assessment'
import { loadSkillStats, saveSkillStats, recordAnswers } from '@/lib/adaptive'
import { LEVEL_META, OP_META } from '@/lib/types'
import type { Profile, Problem, AnswerRecord, AssessmentResult, Op } from '@/lib/types'
import { saveProfile, saveAssessmentResult } from '@/lib/supabase'

const TOTAL_QUESTIONS = 20
const BASIC_OPS: Op[] = ['add', 'sub', 'mul', 'div']

// ─── Age helpers ──────────────────────────────────────────────────────────────
function getAgeExpectedLevel(age: number): number {
  if (age <= 6)  return 1
  if (age <= 7)  return 2
  if (age <= 8)  return 3
  if (age <= 9)  return 4
  if (age <= 10) return 5
  if (age <= 12) return 6
  if (age <= 14) return 7
  if (age <= 16) return 8
  return 9
}

function getAgeLabel(age: number) {
  if (age <= 6)  return { label: 'นักคณิตน้อย',  emoji: '🌱' }
  if (age <= 8)  return { label: 'กำลังเริ่มต้น', emoji: '⭐' }
  if (age <= 10) return { label: 'กำลังเก่งขึ้น', emoji: '🌟' }
  if (age <= 13) return { label: 'ระดับกลาง',     emoji: '💫' }
  if (age <= 16) return { label: 'ขั้นสูง',        emoji: '🔥' }
  return { label: 'มืออาชีพ', emoji: '👑' }
}

function getAgeAnalysis(level: number, age: number, name: string) {
  const expected = getAgeExpectedLevel(age)
  const diff = level - expected
  if (diff >= 2) return { text: `${name} เก่งเกินวัยมาก! ระดับนี้ยอดเยี่ยมสำหรับอายุ ${age} ปี`, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', emoji: '🚀' }
  if (diff === 1) return { text: `${name} เก่งกว่าเกณฑ์อายุ ${age} ปี นิดหน่อย ดีมาก!`, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100', emoji: '👍' }
  if (diff === 0) return { text: `ระดับเหมาะสมกับอายุ ${age} ปี พอดีเลย!`, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-100', emoji: '✅' }
  if (diff === -1) return { text: `${name} ยังมีที่พัฒนาได้อีก ฝึกบ่อยๆ แล้วจะเก่งขึ้น!`, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100', emoji: '📚' }
  return { text: `ไม่เป็นไร! ฝึกทุกวัน ${name} จะเก่งขึ้นแน่นอน!`, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100', emoji: '💪' }
}

// ─── Numpad ───────────────────────────────────────────────────────────────────
function Numpad({ value, onChange, onSubmit, disabled }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; disabled: boolean
}) {
  function press(key: string) {
    if (disabled) return
    if (key === '⌫') { onChange(value.slice(0, -1)); return }
    if (key === '✓') { onSubmit(); return }
    if (value.length >= 5) return
    onChange(value + key)
  }
  const rows = [['7','8','9'],['4','5','6'],['1','2','3'],['⌫','0','✓']]
  return (
    <div className="grid gap-2.5 w-full">
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-3 gap-2.5">
          {row.map(key => (
            <motion.button
              key={key}
              onClick={() => press(key)}
              disabled={disabled || (key === '✓' && !value)}
              className={`h-16 rounded-2xl text-2xl font-extrabold shadow-md active:shadow-sm transition-colors flex items-center justify-center
                ${key === '✓' ? 'bg-gradient-to-br from-violet-500 to-pink-500 text-white disabled:opacity-40'
                  : key === '⌫' ? 'bg-red-100 text-red-500 hover:bg-red-200'
                  : 'bg-white text-gray-700 hover:bg-purple-50 border border-gray-100'}`}
              whileTap={{ scale: 0.91 }}
            >
              {key}
            </motion.button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Intro Screen ─────────────────────────────────────────────────────────────
function IntroScreen({ profile, onStart }: { profile: Profile; onStart: () => void }) {
  const avatar = getAvatar(profile.avatar)
  const { label: ageLabel, emoji: ageEmoji } = getAgeLabel(profile.age)

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-500 to-pink-500 p-6 text-center">
          <motion.div
            className={`w-16 h-16 rounded-full bg-gradient-to-br ${avatar.color} flex items-center justify-center text-3xl shadow-lg mx-auto mb-3`}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {avatar.emoji}
          </motion.div>
          <h1 className="text-white font-black text-xl">สวัสดี {profile.nickname}! 👋</h1>
          <p className="text-white/80 text-sm font-semibold mt-1">
            อายุ {profile.age} ปี · {ageEmoji} {ageLabel}
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* What will happen */}
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
            <h2 className="text-violet-800 font-black text-sm mb-2">🎯 ทดสอบวัดระดับก่อนเริ่มฝึก</h2>
            <p className="text-gray-600 text-xs font-semibold leading-relaxed">
              ระบบจะทดสอบ <strong className="text-violet-700">20 ข้อ</strong> เพื่อวิเคราะห์ระดับความสามารถของ {profile.nickname}
              แล้วคัดเลือกโจทย์ที่เหมาะสมที่สุดให้อัตโนมัติ
            </p>
          </div>

          {/* Operations to be tested */}
          <div>
            <p className="text-[11px] font-black text-gray-500 mb-2">📋 หัวข้อที่ทดสอบ (ทีละ 5 ข้อ)</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { emoji: '➕', label: 'บวก', color: 'bg-blue-50' },
                { emoji: '➖', label: 'ลบ',  color: 'bg-red-50' },
                { emoji: '✖️', label: 'คูณ', color: 'bg-green-50' },
                { emoji: '➗', label: 'หาร', color: 'bg-amber-50' },
              ].map((op, i) => (
                <motion.div
                  key={op.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07 }}
                  className={`${op.color} rounded-xl p-2.5 text-center`}
                >
                  <div className="text-xl mb-1">{op.emoji}</div>
                  <div className="text-[10px] font-black text-gray-600">{op.label}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Tip */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
            <p className="text-amber-700 text-xs font-bold leading-relaxed">
              💡 <strong>เคล็ดลับ:</strong> ตอบให้เร็วที่สุดเท่าที่ทำได้
              ระบบวัดทั้ง <strong>ความแม่นยำ</strong> และ <strong>ความเร็ว</strong>
            </p>
          </div>

          <motion.button
            onClick={onStart}
            className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-extrabold text-lg py-4 rounded-2xl shadow-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            🚀 เริ่มทดสอบ!
          </motion.button>
          <p className="text-center text-gray-400 text-[10px] font-semibold -mt-1">
            ใช้เวลาประมาณ 5–10 นาที
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Result Screen ────────────────────────────────────────────────────────────
function ResultScreen({ profile, result, onContinue }: {
  profile: Profile; result: AssessmentResult; onContinue: () => void
}) {
  const avatar = getAvatar(profile.avatar)
  const levelMeta = LEVEL_META[result.determinedLevel - 1] ?? LEVEL_META[0]
  const confetti = ['🎉','🌟','⭐','✨','🎊','🏆','💫','🎈']
  const ageAnalysis = getAgeAnalysis(result.determinedLevel, profile.age, profile.nickname)

  // Per-op levels
  const perOp = result.perOpLevels ?? {}
  const weakOps = BASIC_OPS.filter(op => (perOp[op] ?? 1) <= 3)
  const strongOps = BASIC_OPS.filter(op => (perOp[op] ?? 1) >= 7)

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center p-4 relative overflow-hidden">

      {confetti.map((e, i) => (
        <motion.span
          key={i}
          className="absolute text-3xl pointer-events-none"
          initial={{ y: '50vh', x: `${10 + i * 10}vw`, opacity: 1, scale: 1 }}
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
        {/* Header */}
        <div className={`bg-gradient-to-r ${levelMeta.color} p-5 text-center`}>
          <motion.div
            className="text-5xl mb-2"
            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
          >
            {levelMeta.emoji}
          </motion.div>
          <h2 className="text-white font-black text-lg">{levelMeta.name}</h2>
          <p className="text-white/80 text-xs font-semibold mt-0.5">{levelMeta.description}</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Profile row */}
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatar.color} flex items-center justify-center text-xl shadow-md flex-shrink-0`}>
              {avatar.emoji}
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold">ผลการทดสอบของ</p>
              <p className="text-base font-black text-gray-800">{profile.nickname} · อายุ {profile.age} ปี</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'ระดับ',       value: `${result.determinedLevel}/10`, emoji: '📊' },
              { label: 'ความแม่นยำ', value: `${result.accuracy}%`,           emoji: '🎯' },
              { label: 'เวลาเฉลี่ย',  value: `${result.avgTimeSeconds}s`,    emoji: '⏱' },
            ].map(stat => (
              <div key={stat.label} className="bg-purple-50 rounded-2xl p-3 text-center">
                <div className="text-lg mb-0.5">{stat.emoji}</div>
                <div className="text-base font-black text-violet-700">{stat.value}</div>
                <div className="text-[9px] text-gray-400 font-bold">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Age analysis */}
          <motion.div
            className={`border rounded-2xl p-3.5 ${ageAnalysis.bg}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <p className={`text-xs font-bold leading-relaxed ${ageAnalysis.color}`}>
              {ageAnalysis.emoji} {ageAnalysis.text}
            </p>
          </motion.div>

          {/* Per-op levels */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <p className="text-[11px] font-black text-gray-500 mb-2">📊 ระดับแต่ละด้าน</p>
            <div className="space-y-2">
              {BASIC_OPS.map(op => {
                const meta = OP_META[op]
                const lvl = perOp[op] ?? 1
                return (
                  <div key={op} className="flex items-center gap-2">
                    <span className="text-sm w-5 text-center">{meta.emoji}</span>
                    <span className="text-[10px] font-bold text-gray-500 w-8">{meta.name}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full bg-gradient-to-r ${meta.color} rounded-full`}
                        initial={{ width: 0 }}
                        animate={{ width: `${(lvl / 10) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.8 + BASIC_OPS.indexOf(op) * 0.1, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-violet-600 w-8 text-right">Lv.{lvl}</span>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Recommendations */}
          {(weakOps.length > 0 || strongOps.length > 0) && (
            <motion.div
              className="bg-gray-50 rounded-2xl p-3.5 space-y-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
            >
              {strongOps.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-emerald-600 mb-1">✅ จุดแข็ง</p>
                  <div className="flex flex-wrap gap-1">
                    {strongOps.map(op => (
                      <span key={op} className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {OP_META[op].emoji} {OP_META[op].name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {weakOps.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-amber-600 mb-1">🎯 ควรฝึกเพิ่ม</p>
                  <div className="flex flex-wrap gap-1">
                    {weakOps.map(op => (
                      <span key={op} className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {OP_META[op].emoji} {OP_META[op].name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Encouragement */}
          <motion.div
            className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-3.5 text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <p className="text-yellow-700 font-bold text-xs">
              {result.accuracy >= 90
                ? `🌟 ยอดเยี่ยมมาก ${profile.nickname}! เก่งมากเลย!`
                : result.accuracy >= 70
                ? `👍 ดีมาก ${profile.nickname}! ฝึกต่อไปเดี๋ยวเก่งขึ้นอีก!`
                : `💪 ${profile.nickname} พยายามต่อไปนะ! เดี๋ยวจะเก่งแน่นอน!`}
            </p>
          </motion.div>

          <motion.button
            onClick={onContinue}
            className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-extrabold text-lg py-4 rounded-2xl shadow-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
          >
            🚀 เริ่มฝึกเลย!
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AssessmentPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showIntro, setShowIntro] = useState(false)
  const [currentLevel, setCurrentLevel] = useState(1)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [inputValue, setInputValue] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [isFinished, setIsFinished] = useState(false)
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const startTimeRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('nobi_profile')
    if (!raw) { router.replace('/setup'); return }
    const p: Profile = JSON.parse(raw)
    setProfile(p)
    const startLevel = getStartingLevel(p.age)
    setCurrentLevel(startLevel)
    setProblem(generateProblem(startLevel, 0))
    // Show intro only for new profiles (?new=1)
    const isNew = new URLSearchParams(window.location.search).has('new')
    setShowIntro(isNew)
    if (!isNew) startTimeRef.current = Date.now()
  }, [router])

  // Timer — only runs when not in intro
  useEffect(() => {
    if (!problem || isFinished || showIntro) return
    timerRef.current = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 200)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [problem, isFinished, questionIndex, showIntro])

  function handleStartAssessment() {
    startTimeRef.current = Date.now()
    setShowIntro(false)
  }

  const submitAnswer = useCallback(() => {
    if (!problem || feedback || !inputValue) return
    if (timerRef.current) clearInterval(timerRef.current)

    const elapsed = (Date.now() - startTimeRef.current) / 1000
    const userNum = parseInt(inputValue, 10)
    const isCorrect = userNum === problem.answer

    const record: AnswerRecord = {
      problem,
      userAnswer: isNaN(userNum) ? null : userNum,
      isCorrect,
      timeSeconds: elapsed,
    }

    setFeedback(isCorrect ? 'correct' : 'wrong')

    setTimeout(() => {
      const newAnswers = [...answers, record]
      setAnswers(newAnswers)
      setInputValue('')
      setFeedback(null)

      if (questionIndex + 1 >= TOTAL_QUESTIONS) {
        const determinedLevel = calculateFinalLevel(newAnswers)
        const perOpLevels = calculatePerOpLevels(newAnswers)
        const assessmentResult: AssessmentResult = {
          profileId: profile?.id ?? '',
          determinedLevel,
          accuracy: calcAccuracy(newAnswers),
          avgTimeSeconds: calcAvgTime(newAnswers),
          totalQuestions: TOTAL_QUESTIONS,
          answers: newAnswers,
          completedAt: new Date().toISOString(),
          perOpLevels,
        }
        localStorage.setItem('nobi_assessment', JSON.stringify(assessmentResult))

        if (profile) {
          const updatedProfile = { ...profile, level: determinedLevel, opLevels: perOpLevels }
          localStorage.setItem('nobi_profile', JSON.stringify(updatedProfile))
          try {
            const profiles: Profile[] = JSON.parse(localStorage.getItem('nobi_profiles') ?? '[]')
            const idx = profiles.findIndex(p => p.id === updatedProfile.id)
            if (idx >= 0) { profiles[idx] = updatedProfile; localStorage.setItem('nobi_profiles', JSON.stringify(profiles)) }
          } catch { /* ignore */ }
          saveSkillStats(profile.id, recordAnswers(loadSkillStats(profile.id), newAnswers))
          saveAssessmentResult(assessmentResult).catch(() => {})
          saveProfile(updatedProfile).catch(() => {})
        }

        setResult(assessmentResult)
        setIsFinished(true)
      } else {
        const nextQI = questionIndex + 1
        const curPhase = Math.floor(questionIndex / QUESTIONS_PER_PHASE)
        const nextPhase = Math.floor(nextQI / QUESTIONS_PER_PHASE)
        const nextLevel = nextPhase > curPhase
          ? getStartingLevel(profile?.age ?? 8)
          : getNextLevel(newAnswers.slice(curPhase * QUESTIONS_PER_PHASE), currentLevel)
        setCurrentLevel(nextLevel)
        setProblem(generateProblem(nextLevel, nextQI))
        setQuestionIndex(qi => qi + 1)
        setTimeElapsed(0)
        startTimeRef.current = Date.now()
      }
    }, 700)
  }, [problem, feedback, inputValue, answers, questionIndex, currentLevel, profile])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (showIntro) return
      if (e.key === 'Enter') { submitAnswer(); return }
      if (e.key === 'Backspace') { setInputValue(v => v.slice(0, -1)); return }
      if (/^\d$/.test(e.key)) { setInputValue(v => v.length < 5 ? v + e.key : v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [submitAnswer, showIntro])

  // Loading
  if (!profile || !problem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
        <div className="text-center">
          <motion.div className="text-6xl mb-4" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⭐</motion.div>
          <p className="text-white text-xl font-black animate-pulse">กำลังเตรียมข้อสอบ...</p>
        </div>
      </div>
    )
  }

  // Intro screen
  if (showIntro) {
    return <IntroScreen profile={profile} onStart={handleStartAssessment} />
  }

  // Result screen
  if (isFinished && result) {
    return <ResultScreen profile={profile} result={result} onContinue={() => router.push('/practice')} />
  }

  // Question screen
  const avatar = getAvatar(profile.avatar)
  const progress = questionIndex / TOTAL_QUESTIONS
  const accuracy = calcAccuracy(answers)
  const timerColor = timeElapsed < 10 ? 'text-white' : timeElapsed < 20 ? 'text-yellow-300' : 'text-red-300'
  const bgColor = feedback === 'correct' ? 'from-green-400 via-emerald-400 to-teal-500'
    : feedback === 'wrong' ? 'from-red-400 via-rose-400 to-pink-500'
    : 'from-violet-500 via-purple-500 to-pink-500'
  const encouragements = ['เริ่มต้นได้เลย! 💪','เยี่ยมมาก! สู้ต่อ! 🌟','เก่งมากเลย! 🔥','ใกล้ถึงแล้ว! เกือบจบแล้ว! 🚀','หน่อยเดียวเอง! ทำได้แน่! 👑']
  const encouragement = encouragements[Math.floor((questionIndex / TOTAL_QUESTIONS) * encouragements.length)]

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${bgColor} flex flex-col items-center justify-between p-4 pb-6 transition-all duration-300`}
    >
      {/* Top bar */}
      <div className="w-full max-w-sm pt-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatar.color} flex items-center justify-center text-lg shadow-md`}>{avatar.emoji}</div>
            <span className="text-white font-extrabold text-sm">{profile.nickname}</span>
          </div>
          <motion.div className={`font-black text-xl tabular-nums ${timerColor}`}
            animate={timeElapsed >= 20 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: timeElapsed >= 20 ? Infinity : 0 }}
          >
            ⏱ {timeElapsed}s
          </motion.div>
          <div className="bg-white/20 rounded-xl px-3 py-1">
            <span className="text-white font-black text-sm">{questionIndex + 1}<span className="opacity-60">/{TOTAL_QUESTIONS}</span></span>
          </div>
        </div>
        <div className="h-3 bg-white/30 rounded-full overflow-hidden mb-1.5">
          <motion.div className="h-full bg-white rounded-full" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.4 }} />
        </div>
        <div className="flex justify-between text-white/70 text-xs font-bold">
          <span>ความแม่นยำ: {answers.length > 0 ? accuracy : '—'}%</span>
          <span>ระดับ {currentLevel}/10</span>
        </div>
      </div>

      {/* Problem card */}
      <div className="w-full max-w-sm flex-1 flex items-center justify-center py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={questionIndex}
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`w-full bg-white rounded-3xl shadow-2xl p-6 text-center relative overflow-hidden`}
          >
            <AnimatePresence>
              {feedback && (
                <motion.div
                  className={`absolute inset-0 flex items-center justify-center rounded-3xl z-10 ${feedback === 'correct' ? 'bg-green-100/90' : 'bg-red-100/90'}`}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <motion.span className="text-7xl" initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.4 }}>
                    {feedback === 'correct' ? '🌟' : '💪'}
                  </motion.span>
                  <motion.p className={`absolute bottom-6 text-lg font-black ${feedback === 'correct' ? 'text-green-600' : 'text-red-500'}`}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  >
                    {feedback === 'correct' ? 'ถูกต้อง! เยี่ยมมาก!' : `คำตอบคือ ${problem.answer}`}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {(() => {
              const ph = phaseOf(questionIndex)
              const phIdx = Math.floor(questionIndex / QUESTIONS_PER_PHASE)
              return (
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-xl">{ph.emoji}</span>
                  <span className="text-gray-500 text-xs font-black tracking-widest uppercase">
                    {ph.label} — ช่วงที่ {phIdx + 1}/{ASSESSMENT_PHASES.length}
                  </span>
                </div>
              )
            })()}

            <div className="flex flex-col items-end pr-8 mb-2 gap-1">
              <span className="text-6xl font-black text-gray-800 font-mono tabular-nums">{problem.a.toLocaleString()}</span>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-black text-violet-500">
                  {phaseOf(questionIndex).op === 'add' ? '+' : phaseOf(questionIndex).op === 'sub' ? '−' : phaseOf(questionIndex).op === 'mul' ? '×' : '÷'}
                </span>
                <span className="text-6xl font-black text-gray-800 font-mono tabular-nums">{problem.b.toLocaleString()}</span>
              </div>
            </div>
            <div className="border-b-4 border-gray-200 mx-4 mb-4" />
            <div className="h-16 flex items-center justify-end pr-8">
              <AnimatePresence mode="wait">
                {inputValue ? (
                  <motion.span key={inputValue} initial={{ opacity: 0.6, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="text-5xl font-black text-violet-600 font-mono tabular-nums">{inputValue}</motion.span>
                ) : (
                  <motion.span key="ph" className="text-5xl font-black text-gray-200"
                    animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>?</motion.span>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom */}
      <div className="w-full max-w-sm space-y-3">
        <motion.p className="text-center text-white font-extrabold text-sm opacity-90"
          key={Math.floor(questionIndex / 4)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
          {encouragement}
        </motion.p>
        <Numpad value={inputValue} onChange={setInputValue} onSubmit={submitAnswer} disabled={!!feedback} />
      </div>
    </motion.div>
  )
}
