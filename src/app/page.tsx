'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { getAvatar } from '@/lib/avatars'
import { loadLifetime } from '@/lib/trophies'
import { loadTrophies, TROPHIES } from '@/lib/trophies'
import { LEVEL_META } from '@/lib/types'
import type { Profile } from '@/lib/types'
import { getAuthUser, authSignOut } from '@/lib/auth'
import { fullSync } from '@/lib/sync'
import type { AuthUser } from '@/lib/auth'
import { APP_VERSION, APP_VERSION_NAME } from '@/lib/version'

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
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [reminderNames, setReminderNames] = useState<string[]>([])

  const buildCards = useCallback(() => {
    let profiles: Profile[] = []
    const raw = localStorage.getItem('nobi_profiles')
    if (raw) { try { profiles = JSON.parse(raw) } catch { profiles = [] } }

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
    return { profiles, data }
  }, [])

  useEffect(() => {
    async function init() {
      // Check auth
      const user = await getAuthUser()
      setAuthUser(user)

      const { profiles, data } = buildCards()

      if (profiles.length === 0) {
        router.replace('/setup')
        return
      }

      setCards(data)
      setLoaded(true)

      // Check daily reminder: find profiles that haven't practiced today
      const today = new Date().toDateString()
      const missing = profiles
        .filter(p => localStorage.getItem(`nobi_last_practice_date_${p.id}`) !== today)
        .map(p => p.nickname)
      setReminderNames(missing)

      // Auto-sync if logged in
      if (user) {
        setSyncing(true)
        const result = await fullSync(user.id)
        // Rebuild cards after pull (may have new profiles from other devices)
        const { data: freshData } = buildCards()
        setCards(freshData)
        setSyncing(false)
        if (result.profilesPulled > 0) {
          setSyncMsg(`☁️ ซิงค์แล้ว (${result.profilesPulled} โปรไฟล์)`)
          setTimeout(() => setSyncMsg(null), 3000)
        }
      }
    }
    init()
  }, [router, buildCards])

  async function handleSync() {
    if (!authUser || syncing) return
    setSyncing(true)
    setSyncMsg(null)
    const result = await fullSync(authUser.id)
    const { data } = buildCards()
    setCards(data)
    setSyncing(false)
    setSyncMsg(`✅ ซิงค์สำเร็จ (${result.profilesPulled} โปรไฟล์จาก Cloud)`)
    setTimeout(() => setSyncMsg(null), 3000)
  }

  async function handleLogout() {
    await authSignOut()
    localStorage.removeItem('nobi_auth_email')
    setAuthUser(null)
    setSyncMsg('ออกจากระบบแล้ว')
    setTimeout(() => setSyncMsg(null), 2000)
  }

  function selectProfile(profile: Profile) {
    localStorage.setItem('nobi_active_profile', profile.id)
    localStorage.setItem('nobi_profile', JSON.stringify(profile))
    router.push('/practice')
  }

  function addNew() { router.push('/setup') }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <motion.div className="text-6xl" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⭐</motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 p-4">
      <div className="max-w-lg mx-auto pt-4 pb-8">

        {/* Auth bar */}
        <motion.div
          className="flex items-center justify-between mb-5"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-white font-black text-xl">🎓 Nobi Skill</h1>
          <div className="flex items-center gap-2">
            {authUser ? (
              <>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="bg-white/20 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl hover:bg-white/30 transition-colors disabled:opacity-50"
                >
                  {syncing ? '⏳' : '☁️'} ซิงค์
                </button>
                <div className="bg-white/20 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
                  <span className="text-base">👤</span>
                  <div>
                    <p className="text-white text-[10px] font-black leading-none truncate max-w-[80px]">
                      {authUser.email.split('@')[0]}
                    </p>
                    <button
                      onClick={handleLogout}
                      className="text-white/60 text-[9px] font-bold hover:text-white/90 transition-colors"
                    >
                      ออกจากระบบ
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-white/30 transition-colors flex items-center gap-1"
              >
                ☁️ เข้าสู่ระบบ
              </button>
            )}
          </div>
        </motion.div>

        {/* Daily reminder banner */}
        <AnimatePresence>
          {reminderNames.length > 0 && (
            <motion.div
              className="bg-amber-400/90 text-amber-900 text-xs font-black px-4 py-2.5 rounded-2xl text-center mb-3 flex items-center justify-center gap-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              🔔 {reminderNames.join(', ')} ยังไม่ได้ฝึกวันนี้เลย! มาฝึกกันเถอะ 💪
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sync message toast */}
        <AnimatePresence>
          {syncMsg && (
            <motion.div
              className="bg-white/20 text-white text-xs font-bold px-4 py-2 rounded-2xl text-center mb-3"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            >
              {syncMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub-header */}
        <motion.p
          className="text-white/70 text-sm font-semibold text-center mb-5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        >
          เลือกผู้ฝึกเพื่อเริ่มได้เลย
        </motion.p>

        {/* Profile cards */}
        <div className="space-y-3 mb-4">
          {cards.map((card, i) => {
            const { profile, sessions, accuracy, trophyCount, streak } = card
            const avatar = getAvatar(profile.avatar)
            const levelMeta = LEVEL_META[profile.level - 1] ?? LEVEL_META[0]
            const gameLevel = getGameLevel(profile.totalExp)
            const expPct = profile.totalExp % 100

            return (
              <motion.div
                key={profile.id}
                className="w-full bg-white rounded-3xl shadow-xl overflow-hidden text-left"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 20 }}
              >
                {/* Top gradient bar — click → practice */}
                <button
                  onClick={() => selectProfile(profile)}
                  className={`w-full bg-gradient-to-r ${levelMeta.color} px-4 py-3 flex items-center gap-3 hover:brightness-105 active:brightness-95 transition-all`}
                >
                  <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center text-2xl shadow-md flex-shrink-0">
                    {avatar.emoji}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white font-black text-base truncate">{profile.nickname}</p>
                    <p className="text-white/80 text-xs font-semibold">
                      {levelMeta.emoji} {levelMeta.name} · Game Lv.{gameLevel}
                    </p>
                  </div>
                  <div className="text-white/90 text-2xl flex-shrink-0">›</div>
                </button>

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
                <div className="grid grid-cols-4 gap-0 px-4 py-2">
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

                {/* Profile link */}
                <div className="px-4 pb-3">
                  <button
                    onClick={() => router.push(`/profile?id=${profile.id}`)}
                    className="w-full text-center text-xs font-bold text-violet-400 hover:text-violet-600 py-1.5 border border-violet-100 rounded-xl hover:bg-violet-50 transition-colors"
                  >
                    📊 ดูโปรไฟล์และสถิติ
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Quick nav row: Parent & Leaderboard */}
        <motion.div
          className="grid grid-cols-2 gap-3 mb-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: cards.length * 0.08 + 0.05 }}
        >
          <button
            onClick={() => router.push('/parent')}
            className="bg-white/20 border border-white/30 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/30 transition-colors text-sm"
          >
            👨‍👩‍👧 รายงานผู้ปกครอง
          </button>
          <button
            onClick={() => router.push('/leaderboard')}
            className="bg-white/20 border border-white/30 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/30 transition-colors text-sm"
          >
            🏆 Leaderboard
          </button>
        </motion.div>

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

        {/* Version badge */}
        <motion.p
          className="text-center text-white/30 text-[10px] font-bold mt-5 leading-relaxed"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        >
          v{APP_VERSION} · {APP_VERSION_NAME}
        </motion.p>

      </div>
    </div>
  )
}

}
