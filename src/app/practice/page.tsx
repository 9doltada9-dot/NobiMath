'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { getAvatar } from '@/lib/avatars'
import { LEVEL_META } from '@/lib/types'
import type { Profile, AssessmentResult } from '@/lib/types'

export default function PracticePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null)

  useEffect(() => {
    const rawProfile = localStorage.getItem('nobi_profile')
    const rawAssessment = localStorage.getItem('nobi_assessment')
    if (!rawProfile) { router.replace('/setup'); return }
    if (!rawAssessment) { router.replace('/assessment'); return }
    setProfile(JSON.parse(rawProfile))
    setAssessment(JSON.parse(rawAssessment))
  }, [router])

  if (!profile || !assessment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
        <div className="text-white text-xl font-black animate-pulse">กำลังโหลด...</div>
      </div>
    )
  }

  const avatar = getAvatar(profile.avatar)
  const levelMeta = LEVEL_META[assessment.determinedLevel - 1] ?? LEVEL_META[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-6">
      <motion.div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {/* Avatar */}
        <motion.div
          className={`w-24 h-24 rounded-full bg-gradient-to-br ${avatar.color} flex items-center justify-center text-5xl shadow-lg mx-auto mb-4`}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {avatar.emoji}
        </motion.div>

        <h1 className="text-2xl font-black text-gray-800 mb-1">
          สวัสดี {profile.nickname}! 👋
        </h1>
        <p className="text-gray-400 font-semibold text-sm mb-5">
          ระดับของเธอคือ: <span className="text-violet-600 font-black">{levelMeta.name}</span>
        </p>

        {/* Level badge */}
        <div className={`bg-gradient-to-r ${levelMeta.color} rounded-2xl p-4 mb-6 text-white`}>
          <div className="text-3xl mb-1">{levelMeta.emoji}</div>
          <p className="font-black text-lg">{levelMeta.name}</p>
          <p className="text-white/80 text-sm">{levelMeta.description}</p>
        </div>

        {/* Coming soon banner */}
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 mb-5">
          <p className="text-yellow-700 font-bold text-sm">
            🔨 หน้าแบบฝึกหัดรายวันกำลังถูกสร้าง!
          </p>
          <p className="text-yellow-500 text-xs mt-1">
            AI จะสร้างแบบฝึกส่วนตัวของ{profile.nickname} ให้เร็วๆ นี้
          </p>
        </div>

        {/* Reset button (dev) */}
        <button
          onClick={() => {
            localStorage.clear()
            router.push('/setup')
          }}
          className="text-gray-300 text-xs font-semibold hover:text-gray-500 transition-colors"
        >
          เริ่มใหม่ (ล้างข้อมูล)
        </button>
      </motion.div>
    </div>
  )
}
