'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AVATARS } from '@/lib/avatars'
import type { Profile } from '@/lib/types'
import { saveProfile } from '@/lib/supabase'

// ─── Floating decoration emojis ───────────────────────────────────────────────
const FLOATERS = ['⭐', '✨', '🌟', '💫', '🎈', '🎉', '⭐', '✨']

// ─── Step slide variants ───────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 320 : -320, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -320 : 320, opacity: 0 }),
}

function getAgeLabel(age: number): string {
  if (age <= 6)  return '🌱 นักคณิตน้อย'
  if (age <= 8)  return '⭐ กำลังเริ่มต้น'
  if (age <= 10) return '🌟 กำลังเก่งขึ้น'
  if (age <= 13) return '💫 ระดับกลาง'
  if (age <= 16) return '🔥 ขั้นสูง'
  return '👑 มืออาชีพ'
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [nickname, setNickname] = useState('')
  const [age, setAge] = useState(8)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Redirect if already set up
  useEffect(() => {
    const existing = localStorage.getItem('nobi_profile')
    if (existing) router.replace('/')
  }, [router])

  function goNext() {
    setDirection(1)
    setStep(s => s + 1)
  }

  function goBack() {
    setDirection(-1)
    setStep(s => s - 1)
  }

  function adjustAge(delta: number) {
    setAge(a => Math.min(20, Math.max(5, a + delta)))
  }

  async function handleFinish() {
    if (!selectedAvatar || isSaving) return
    setIsSaving(true)

    const profile: Profile = {
      id: `local_${Date.now()}`,
      nickname: nickname.trim(),
      age,
      avatar: selectedAvatar,
      level: 1,
      totalExp: 0,
      createdAt: new Date().toISOString(),
    }

    localStorage.setItem('nobi_profile', JSON.stringify(profile))

    // Save to Supabase (non-blocking — offline-safe)
    saveProfile(profile).catch(() => {})

    // Small delay for celebration feel
    await new Promise(r => setTimeout(r, 500))
    router.push('/practice')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center p-4 overflow-hidden relative">

      {/* Floating stars */}
      {FLOATERS.map((emoji, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl pointer-events-none select-none"
          style={{ left: `${8 + i * 12}%`, top: `${8 + (i % 4) * 20}%` }}
          animate={{ y: [0, -18, 0], rotate: [0, 360, 720] }}
          transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
        >
          {emoji}
        </motion.span>
      ))}

      {/* Card */}
      <motion.div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        initial={{ scale: 0.8, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {/* Progress bar */}
        <div className="h-2 bg-gray-100">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-r-full"
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-4 pt-5 pb-0">
          {[1, 2, 3].map(s => (
            <motion.div
              key={s}
              animate={{
                scale: s === step ? 1.4 : 1,
                backgroundColor: s <= step ? '#7c3aed' : '#e5e7eb',
              }}
              className="w-2.5 h-2.5 rounded-full"
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        {/* Steps */}
        <div className="overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">

            {/* ── Step 1: Nickname ─────────────────────────────────────── */}
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="px-8 pt-6 pb-8"
              >
                {/* Icon */}
                <motion.div
                  className="text-center text-7xl mb-3 leading-none"
                  animate={{ rotate: [0, -12, 12, -6, 6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                >
                  👋
                </motion.div>

                <h1 className="text-2xl font-extrabold text-gray-800 text-center mb-1">
                  สวัสดี! ยินดีต้อนรับ
                </h1>
                <p className="text-gray-400 text-center mb-6 text-sm font-semibold">
                  ชื่อเล่นของเธอคืออะไร?
                </p>

                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && nickname.trim() && goNext()}
                  placeholder="พิมพ์ชื่อเล่นที่นี่..."
                  autoFocus
                  maxLength={16}
                  className="w-full border-3 border-purple-200 focus:border-purple-500 rounded-2xl px-4 py-4 text-xl font-extrabold text-center text-gray-700 outline-none transition-colors placeholder:text-gray-300 placeholder:font-normal bg-purple-50"
                />

                <motion.button
                  onClick={goNext}
                  disabled={!nickname.trim()}
                  className="mt-5 w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-extrabold text-lg py-4 rounded-2xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed btn-press"
                  whileHover={{ scale: nickname.trim() ? 1.02 : 1 }}
                  whileTap={{ scale: nickname.trim() ? 0.97 : 1 }}
                >
                  ถัดไป →
                </motion.button>
              </motion.div>
            )}

            {/* ── Step 2: Age ──────────────────────────────────────────── */}
            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="px-8 pt-6 pb-8"
              >
                <motion.div
                  className="text-center text-7xl mb-3 leading-none"
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  🎂
                </motion.div>

                <h1 className="text-2xl font-extrabold text-gray-800 text-center mb-1">
                  อายุเท่าไหร่?
                </h1>
                <p className="text-purple-400 text-center mb-6 text-sm font-bold">
                  {getAgeLabel(age)}
                </p>

                {/* Age selector */}
                <div className="flex items-center justify-center gap-6 mb-6">
                  <motion.button
                    onClick={() => adjustAge(-1)}
                    className="w-16 h-16 rounded-full bg-purple-100 text-purple-600 text-3xl font-bold flex items-center justify-center shadow-md active:shadow-sm"
                    whileTap={{ scale: 0.88 }}
                    whileHover={{ scale: 1.08, backgroundColor: '#ede9fe' }}
                  >
                    −
                  </motion.button>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={age}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-[80px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-violet-600 to-pink-500 w-28 text-center"
                    >
                      {age}
                    </motion.div>
                  </AnimatePresence>

                  <motion.button
                    onClick={() => adjustAge(1)}
                    className="w-16 h-16 rounded-full bg-purple-100 text-purple-600 text-3xl font-bold flex items-center justify-center shadow-md active:shadow-sm"
                    whileTap={{ scale: 0.88 }}
                    whileHover={{ scale: 1.08, backgroundColor: '#ede9fe' }}
                  >
                    +
                  </motion.button>
                </div>

                {/* Age slider */}
                <input
                  type="range"
                  min={5}
                  max={20}
                  value={age}
                  onChange={e => setAge(Number(e.target.value))}
                  className="w-full accent-violet-500 mb-6"
                />
                <div className="flex justify-between text-xs text-gray-400 font-bold -mt-4 mb-5">
                  <span>5 ปี</span><span>20 ปี</span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={goBack}
                    className="flex-1 border-2 border-gray-200 text-gray-400 font-bold py-4 rounded-2xl btn-press hover:bg-gray-50"
                  >
                    ← กลับ
                  </button>
                  <motion.button
                    onClick={goNext}
                    className="flex-[2] bg-gradient-to-r from-violet-500 to-pink-500 text-white font-extrabold text-lg py-4 rounded-2xl shadow-lg btn-press"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    ถัดไป →
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Avatar ───────────────────────────────────────── */}
            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="px-6 pt-6 pb-8"
              >
                <h1 className="text-2xl font-extrabold text-gray-800 text-center mb-1">
                  เลือกตัวละคร!
                </h1>
                <p className="text-gray-400 text-center mb-4 text-sm font-semibold">
                  เลือกตัวที่ชอบที่สุดได้เลย ✨
                </p>

                {/* Avatar Grid */}
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {AVATARS.map((avatar, i) => {
                    const isSelected = selectedAvatar === avatar.id
                    return (
                      <motion.button
                        key={avatar.id}
                        onClick={() => setSelectedAvatar(avatar.id)}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.04, type: 'spring', stiffness: 300 }}
                        whileTap={{ scale: 0.88 }}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl border-3 transition-all duration-200 ${
                          isSelected
                            ? 'border-violet-500 bg-violet-50 shadow-lg shadow-violet-200'
                            : 'border-transparent bg-gray-50 hover:bg-purple-50 hover:border-purple-200'
                        }`}
                      >
                        {/* Avatar circle */}
                        <motion.div
                          className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatar.color} flex items-center justify-center text-2xl shadow-md`}
                          animate={isSelected ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                          transition={{ duration: 0.4 }}
                        >
                          {avatar.emoji}
                        </motion.div>
                        <span className="text-[10px] font-bold text-gray-600 leading-tight text-center w-full truncate">
                          {avatar.name}
                        </span>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center"
                          >
                            <span className="text-white text-[8px] font-black">✓</span>
                          </motion.div>
                        )}
                      </motion.button>
                    )
                  })}
                </div>

                {/* Selected preview */}
                <AnimatePresence>
                  {selectedAvatar && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 bg-violet-50 rounded-2xl px-4 py-3 flex items-center gap-3"
                    >
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${AVATARS.find(a => a.id === selectedAvatar)?.color} flex items-center justify-center text-xl shadow-sm`}>
                        {AVATARS.find(a => a.id === selectedAvatar)?.emoji}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-semibold">เธอเลือก</p>
                        <p className="text-sm font-extrabold text-violet-700">
                          {AVATARS.find(a => a.id === selectedAvatar)?.name}
                        </p>
                      </div>
                      <div className="ml-auto text-violet-400 text-xl">🎉</div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-3">
                  <button
                    onClick={goBack}
                    className="flex-1 border-2 border-gray-200 text-gray-400 font-bold py-4 rounded-2xl btn-press hover:bg-gray-50"
                  >
                    ← กลับ
                  </button>
                  <motion.button
                    onClick={handleFinish}
                    disabled={!selectedAvatar || isSaving}
                    className="flex-[2] bg-gradient-to-r from-violet-500 to-pink-500 text-white font-extrabold text-lg py-4 rounded-2xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed btn-press"
                    whileHover={{ scale: selectedAvatar ? 1.02 : 1 }}
                    whileTap={{ scale: selectedAvatar ? 0.97 : 1 }}
                  >
                    {isSaving ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          className="inline-block"
                        >
                          ⭐
                        </motion.span>
                        กำลังบันทึก...
                      </span>
                    ) : (
                      '🚀 เริ่มเลย!'
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Bottom brand */}
        <div className="text-center pb-4 text-xs text-gray-300 font-bold tracking-wider">
          NOBI SKILL ✨
        </div>
      </motion.div>
    </div>
  )
}
