'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { getAvatar } from '@/lib/avatars'
import { loadLifetime } from '@/lib/trophies'
import { loadTrophies, TROPHIES } from '@/lib/trophies'
import { LEVEL_META } from '@/lib/types'
import type { Profile } from '@/lib/types'

function getGameLevel(totalExp: number) { return Math.floor(totalExp / 100) + 1 }

interface ProfileCardData {
  profile: Profile
  sessions: number
  accuracy: number   // 0-100, -1 = no data
  trophyCount: number
  streak: number
}

export default function HomePage() {
  const router = useRouter()
  const [cards, setCards] = useState<ProfileCardData[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // ─── Load all profiles ────────────────────────────────────────────────
    let profiles: Profile[] = []

    const raw = localStorage.getItem('nobi_profiles')
    if (raw) {
      try { profiles = JSON.parse(raw) } catch { profiles = [] }
    }

    // Backward-compat: single profile from older version
    if (profiles.length === 0) {
      const single = localStorage.getItem('nobi_profile')
      if (single) {
        try {
          const p = JSON.parse(single)
          profiles = [p]
          localStorage.setItem('nobi_profiles', JSON.stringify(profiles))
        } catch { /* ignore */ }
      }
    }

    if (profiles.length === 0) {
      // No profiles at all → go to setup
      router.replace('/setup')
      return
    }

    // ─── Load stats for each profile ─────────────────────────────────────
    const data: ProfileCardData[] = profiles.map(p => {
      const life = loadLifetime(p.id)
      const trophies = loadTrophies(p.id)
      const trophyCount = TROPHIES.filter(t => trophies[t.id]).length
      const accuracy = life.problems > 0
        ? Math.round((life.correct / life.problems) * 100)
        : -1
      const streak = parseInt(localStorage.getItem(`nobi_streak_${p.id}`) ?? '0', 10)
      return { profile: p, sessions: life.sessions, accuracy, trophyCount, streak }
    })

    setCards(data)
    setLoaded(true)
  }, [router])

  function selectProfile(profile: Profile) {
    localStorage.setItem('nobi_active_profile', profile.id)
    localStorage.setItem('nobi_profile', JSON.stringify(profile))
    router.push('/practice')
  }

  function addNew() {
    router.push('/setup')
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <motion.div className="text-6xl" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⭐</motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 p-4">
      <div className="max-w-lg mx-auto pt-6 pb-8">

        {/* Header */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-white font-black text-2xl mb-1">🎓 Nobi Skill</h1>
          <p className="text-white/70 text-sm font-semibold">เลือกผู้ฝึกเพื่อเริ่มได้เลย</p>
        </motion.div>

        {/* Profile cards */}
        <div className="space-y-3 mb-4">
          {cards.map((card, i) => {
            const { profile, sessions, accuracy, trophyCount, streak } = card
            const avatar = getAvatar(profile.avatar)
            const levelMeta = LEVEL_META[profile.level - 1] ?? LEVEL_META[0]
            const gameLevel = getGameLevel(profile.totalExp)
            const expPct = profile.totalExp % 100

            return (
              <motion.button
                key={profile.id}
                onClick={() => selectProfile(profile)}
                className="w-full bg-white rounded-3xl shadow-xl overflow-hidden text-left"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 20 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Top gradient bar */}
                <div className={`bg-gradient-to-r ${levelMeta.color} px-4 py-3 flex items-center gap-3`}>
                  <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center text-2xl shadow-md flex-shrink-0">
                    {avatar.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-base truncate">{profile.nickname}</p>
                    <p className="text-white/80 text-xs font-semibold">
                      {levelMeta.emoji} {levelMeta.name} · Game Lv.{gameLevel}
                    </p>
                  </div>
                  <div className="text-white/90 text-2xl flex-shrink-0">›</div>
                </div>

                {/* EXP bar */}
                <div className="px-4 pt-2.5 pb-1">
                  <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1">
                    <span>⚡ {profile.totalExp} EXP</span>
                    <span>{expPct}/100</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full bg-gradient-to-r ${levelMeta.color} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${expPct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.08 + 0.2, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-0 px-4 py-2.5">
                  {[
                    { emoji: '📚', label: 'เซสชั่น', value: `${sessions}` },
                    { emoji: '🎯', label: 'แม่นยำ',  value: accuracy >= 0 ? `${accuracy}%` : '—' },
                    { emoji: '🔥', label: 'Streak',  value: `${streak}วัน` },
                    { emoji: '🏆', label: 'Trophy',  value: `${trophyCount}/${TROPHIES.length}` },
                  ].map(stat => (
                    <div key={stat.label} className="text-center">
                      <p className="text-base">{stat.emoji}</p>
                      <p className="text-xs font-black text-violet-700 tabular-nums">{stat.value}</p>
                      <p className="text-[9px] text-gray-400 font-bold">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Add new profile */}
        <motion.button
          onClick={addNew}
          className="w-full bg-white/20 border-2 border-white/40 border-dashed text-white font-extrabold py-4 rounded-3xl flex items-center justify-center gap-2 hover:bg-white/30 transition-colors"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: cards.length * 0.08 + 0.1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <span className="text-2xl">＋</span>
          <span>เพิ่มผู้ใช้ใหม่</span>
        </motion.button>

      </div>
    </div>
  )
}
