'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type React from 'react'
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
import { APP_VERSION, APP_VERSION_NAME, CHANGELOG } from '@/lib/version'
import GuideModal from '@/components/GuideModal'

function getGameLevel(totalExp: number) { return Math.floor(totalExp / 100) + 1 }

// ─── Swipeable wrapper — swipe left to reveal delete ──────────────────────────
function SwipeCard({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const [swipeX, setSwipeX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const startX = useRef(0)
  const DELETE_THRESHOLD = 80

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    setDragging(true)
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!dragging) return
    const dx = e.touches[0].clientX - startX.current
    if (dx < 0) setSwipeX(Math.max(dx, -DELETE_THRESHOLD - 20))
  }
  function onTouchEnd() {
    setDragging(false)
    if (swipeX < -DELETE_THRESHOLD) {
      setSwipeX(-DELETE_THRESHOLD)
      setConfirming(true)
    } else {
      setSwipeX(0)
      setConfirming(false)
    }
  }
  function cancel() { setSwipeX(0); setConfirming(false) }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete button behind */}
      <div className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-red-500 rounded-r-2xl">
        <button
          onClick={() => { setConfirming(false); onDelete() }}
          className="flex flex-col items-center gap-0.5 text-white"
        >
          <span className="text-xl">🗑️</span>
          <span className="text-[10px] font-black">ลบ</span>
        </button>
      </div>
      {/* Card — slides left on swipe */}
      <motion.div
        style={{ x: swipeX }}
        animate={{ x: swipeX }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={confirming ? cancel : undefined}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  )
}

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
  const [showChangelog, setShowChangelog] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const authUserRef = useRef<AuthUser | null>(null)
  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleteInput, setDeleteInput] = useState('')

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
      authUserRef.current = user

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
        const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        setLastSyncTime(now)
        const syncParts = []
        if (result.profilesPulled > 0) syncParts.push(`${result.profilesPulled} โปรไฟล์`)
        if (result.sessionsNewLocal > 0) syncParts.push(`${result.sessionsNewLocal} session ใหม่`)
        if (syncParts.length > 0) {
          setSyncMsg(`☁️ ซิงค์แล้ว — ${syncParts.join(', ')}`)
          setTimeout(() => setSyncMsg(null), 4000)
        }
      }
    }
    init()
  }, [router, buildCards])

  // Auto-sync when tab/app comes back into focus (e.g. switch from phone → computer)
  useEffect(() => {
    let lastVisible = Date.now()
    const RESYNC_COOLDOWN = 60_000  // at most once per minute on refocus

    function onVisibility() {
      if (document.visibilityState !== 'visible') return
      const gap = Date.now() - lastVisible
      lastVisible = Date.now()
      if (gap < RESYNC_COOLDOWN) return  // was hidden < 1 min, skip
      const user = authUserRef.current
      if (!user) return
      setSyncing(true)
      fullSync(user.id).then(result => {
        const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        setLastSyncTime(now)
        const { data } = buildCards()
        setCards(data)
        setSyncing(false)
        if (result.sessionsNewLocal > 0) {
          setSyncMsg(`☁️ อัปเดต ${result.sessionsNewLocal} session จากเครื่องอื่น`)
          setTimeout(() => setSyncMsg(null), 4000)
        }
      }).catch(() => setSyncing(false))
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [buildCards])

  async function handleSync() {
    if (!authUser || syncing) return
    setSyncing(true)
    setSyncMsg(null)
    const result = await fullSync(authUser.id)
    const { data } = buildCards()
    setCards(data)
    setSyncing(false)
    const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    setLastSyncTime(now)
    const parts = []
    if (result.profilesPulled > 0) parts.push(`${result.profilesPulled} โปรไฟล์`)
    if (result.sessionsNewLocal > 0) parts.push(`${result.sessionsNewLocal} session ใหม่`)
    setSyncMsg(parts.length > 0 ? `✅ ซิงค์สำเร็จ — ${parts.join(', ')}` : '✅ ข้อมูลทันสมัยแล้ว')
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

  function requestDelete(profile: Profile) {
    setDeleteInput('')
    setDeleteTarget(profile)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    try {
      const profiles: Profile[] = JSON.parse(localStorage.getItem('nobi_profiles') ?? '[]')
      const updated = profiles.filter(p => p.id !== deleteTarget.id)
      localStorage.setItem('nobi_profiles', JSON.stringify(updated))
      // Clean up all related localStorage keys
      const keys = [
        `nobi_history_${deleteTarget.id}`,
        `nobi_life_${deleteTarget.id}`,
        `nobi_trophies_${deleteTarget.id}`,
        `nobi_skills_${deleteTarget.id}`,
        `nobi_mastery_${deleteTarget.id}`,
        `nobi_streak_${deleteTarget.id}`,
        `nobi_last_practice_date_${deleteTarget.id}`,
      ]
      keys.forEach(k => localStorage.removeItem(k))
    } catch { /* ignore */ }
    setDeleteTarget(null)
    setDeleteInput('')
    const { profiles, data } = buildCards()
    if (profiles.length === 0) router.replace('/setup')
    else setCards(data)
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
            <button
            onClick={() => setShowGuide(true)}
            className="bg-white/20 text-white text-xs font-black w-8 h-8 rounded-xl hover:bg-white/30 transition-colors flex items-center justify-center"
            title="คู่มือการใช้งาน"
          >
            ?
          </button>
          {authUser ? (
              <>
                <div className="flex flex-col items-center">
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-white/20 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl hover:bg-white/30 transition-colors disabled:opacity-50"
                  >
                    {syncing ? '⏳' : '☁️'} ซิงค์
                  </button>
                  {lastSyncTime && !syncing && (
                    <span className="text-white/40 text-[9px] font-bold mt-0.5">{lastSyncTime}</span>
                  )}
                </div>
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
        <div className="space-y-2 mb-4">
          {cards.map((card, i) => {
            const { profile, sessions, accuracy, trophyCount, streak } = card
            const avatar = getAvatar(profile.avatar)
            const levelMeta = LEVEL_META[profile.level - 1] ?? LEVEL_META[0]
            const gameLevel = getGameLevel(profile.totalExp)
            const expPct = profile.totalExp % 100

            return (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 20 }}
              >
              <SwipeCard onDelete={() => requestDelete(profile)}>
              <div className="w-full bg-white rounded-2xl shadow-lg overflow-hidden text-left">
                {/* Top gradient bar — click → practice */}
                <button
                  onClick={() => selectProfile(profile)}
                  className={`w-full bg-gradient-to-r ${levelMeta.color} px-3 py-2 flex items-center gap-2.5 hover:brightness-105 active:brightness-95 transition-all`}
                >
                  <div className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center text-lg shadow-md flex-shrink-0">
                    {avatar.emoji}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white font-black text-sm truncate">{profile.nickname}</p>
                    <p className="text-white/80 text-[10px] font-semibold">
                      {levelMeta.emoji} {levelMeta.name} · Lv.{gameLevel}
                    </p>
                  </div>
                  <div className="text-white/90 text-xl flex-shrink-0">›</div>
                </button>

                {/* EXP bar */}
                <div className="px-3 pt-1.5 pb-0.5">
                  <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-0.5">
                    <span>⚡ {profile.totalExp} EXP</span>
                    <span>{expPct}/100</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full bg-gradient-to-r ${levelMeta.color} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${expPct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.08 + 0.2, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-0 px-3 py-1.5">
                  {[
                    { emoji: '📚', label: 'เซสชั่น', value: `${sessions}` },
                    { emoji: '🎯', label: 'แม่นยำ',  value: accuracy >= 0 ? `${accuracy}%` : '—' },
                    { emoji: '🔥', label: 'Streak',  value: `${streak}ว.` },
                    { emoji: '🏆', label: 'Trophy',  value: `${trophyCount}/${TROPHIES.length}` },
                  ].map(stat => (
                    <div key={stat.label} className="text-center">
                      <p className="text-sm">{stat.emoji}</p>
                      <p className="text-[11px] font-black text-violet-700 tabular-nums">{stat.value}</p>
                      <p className="text-[8px] text-gray-400 font-bold">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Profile link */}
                <div className="px-3 pb-2">
                  <button
                    onClick={() => router.push(`/profile?id=${profile.id}`)}
                    className="w-full text-center text-[11px] font-bold text-violet-400 hover:text-violet-600 py-1 border border-violet-100 rounded-xl hover:bg-violet-50 transition-colors"
                  >
                    📊 ดูโปรไฟล์และสถิติ
                  </button>
                </div>
              </div>
              </SwipeCard>
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

        {/* Version badge — clickable changelog */}
        <motion.button
          onClick={() => setShowChangelog(true)}
          className="w-full text-center text-white/50 text-[10px] font-bold mt-5 leading-relaxed hover:text-white/80 transition-colors"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        >
          v{APP_VERSION} · {APP_VERSION_NAME}
        </motion.button>

      </div>

      {/* Guide modal */}
      <AnimatePresence>
        {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
      </AnimatePresence>

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {deleteTarget && (() => {
          const avatar = getAvatar(deleteTarget.avatar)
          const nameMatch = deleteInput.trim() === deleteTarget.nickname
          return (
            <motion.div
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              >
                {/* Red danger header */}
                <div className="bg-gradient-to-r from-red-500 to-rose-600 p-5 text-center">
                  <motion.div
                    className="text-5xl mb-2"
                    animate={{ rotate: [-3, 3, -3] }}
                    transition={{ duration: 0.5, repeat: 3 }}
                  >⚠️</motion.div>
                  <h2 className="text-white font-black text-lg">ลบโปรไฟล์</h2>
                  <p className="text-white/80 text-xs font-semibold mt-1">
                    ข้อมูลทั้งหมดจะหายถาวร ไม่สามารถกู้คืนได้
                  </p>
                </div>

                <div className="p-5">
                  {/* Profile being deleted */}
                  <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl">
                      {avatar.emoji}
                    </div>
                    <div>
                      <p className="font-black text-gray-800">{deleteTarget.nickname}</p>
                      <p className="text-[10px] text-gray-400 font-semibold">
                        อายุ {deleteTarget.age} ปี · {deleteTarget.totalExp} EXP
                      </p>
                    </div>
                  </div>

                  {/* What will be lost */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 text-xs text-amber-800 font-semibold space-y-1">
                    <p className="font-black text-amber-900 mb-1">สิ่งที่จะถูกลบ:</p>
                    <p>📚 ประวัติการฝึกทั้งหมด</p>
                    <p>⚡ EXP และ Level ทั้งหมด</p>
                    <p>🏆 Trophy และ Mastery ทั้งหมด</p>
                    <p>📊 ข้อมูลจุดอ่อนและสถิติ</p>
                  </div>

                  {/* Type to confirm */}
                  <p className="text-xs text-gray-500 font-bold mb-1.5 text-center">
                    พิมพ์ชื่อ <span className="text-red-600 font-black">"{deleteTarget.nickname}"</span> เพื่อยืนยัน
                  </p>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder={`พิมพ์: ${deleteTarget.nickname}`}
                    className="w-full border-2 border-gray-200 focus:border-red-400 rounded-2xl px-4 py-3 text-sm font-bold text-center outline-none transition-colors mb-4"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />

                  {/* Action buttons */}
                  <div className="space-y-2">
                    <motion.button
                      onClick={confirmDelete}
                      disabled={!nameMatch}
                      className={`w-full py-3.5 rounded-2xl font-extrabold text-sm transition-all ${
                        nameMatch
                          ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      whileTap={nameMatch ? { scale: 0.97 } : {}}
                    >
                      🗑️ ลบถาวร
                    </motion.button>
                    <button
                      onClick={() => { setDeleteTarget(null); setDeleteInput('') }}
                      className="w-full py-3.5 rounded-2xl font-extrabold text-sm bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                    >
                      ← ยกเลิก (ปลอดภัย)
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Changelog modal */}
      <AnimatePresence>
        {showChangelog && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowChangelog(false)}
          >
            <motion.div
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden"
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-violet-500 to-pink-500 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-black text-lg">📋 Version History</h2>
                  <p className="text-white/80 text-xs font-semibold">Nobi Skill v{APP_VERSION}</p>
                </div>
                <button onClick={() => setShowChangelog(false)} className="text-white/70 hover:text-white text-2xl font-black leading-none">✕</button>
              </div>
              <div className="overflow-y-auto max-h-[55vh] p-4 space-y-3">
                {CHANGELOG.map(entry => (
                  <div key={entry.version} className="border-b border-gray-100 pb-3 last:border-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="bg-violet-100 text-violet-700 text-[10px] font-black px-2 py-0.5 rounded-full">v{entry.version}</span>
                      <span className="text-gray-400 text-[10px] font-semibold">{entry.date}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">{entry.name}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
