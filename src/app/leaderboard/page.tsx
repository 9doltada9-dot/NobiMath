'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { getAvatar } from '@/lib/avatars'
import { LEVEL_META } from '@/lib/types'
import type { Profile, SessionRecord } from '@/lib/types'

function getGameLevel(exp: number) { return Math.floor(exp / 100) + 1 }

function loadHistory(profileId: string): SessionRecord[] {
  try { return JSON.parse(localStorage.getItem(`nobi_history_${profileId}`) ?? '[]') } catch { return [] }
}

function weeklyExp(profileId: string): number {
  const hist = loadHistory(profileId)
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  return hist
    .filter(s => new Date(s.date).getTime() >= cutoff)
    .reduce((sum, s) => sum + s.expGained, 0)
}

interface RankedProfile {
  profile: Profile
  totalExp: number
  weeklyExp: number
  streak: number
  rank: number
  weekRank: number
}

const MEDAL = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const router = useRouter()
  const [ranked, setRanked] = useState<RankedProfile[]>([])
  const [tab, setTab] = useState<'total' | 'weekly'>('total')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const profiles: Profile[] = JSON.parse(localStorage.getItem('nobi_profiles') ?? '[]')
    const data = profiles.map(p => ({
      profile: p,
      totalExp: p.totalExp,
      weeklyExp: weeklyExp(p.id),
      streak: parseInt(localStorage.getItem(`nobi_streak_${p.id}`) ?? '0', 10),
      rank: 0,
      weekRank: 0,
    }))

    // Assign ranks
    const byTotal = [...data].sort((a, b) => b.totalExp - a.totalExp)
    byTotal.forEach((r, i) => { r.rank = i + 1 })

    const byWeekly = [...data].sort((a, b) => b.weeklyExp - a.weeklyExp)
    byWeekly.forEach((r, i) => { r.weekRank = i + 1 })

    setRanked(byTotal)
    setLoaded(true)
  }, [])

  const sorted = tab === 'total'
    ? [...ranked].sort((a, b) => a.rank - b.rank)
    : [...ranked].sort((a, b) => a.weekRank - b.weekRank)

  if (!loaded) return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 flex items-center justify-center">
      <motion.div className="text-6xl" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>🏆</motion.div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 p-4">
      <div className="max-w-lg mx-auto pt-4 pb-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => router.push('/')} className="text-white/70 text-sm font-bold hover:text-white flex items-center gap-1">
            ← กลับ
          </button>
          <h1 className="text-white font-black text-xl">🏆 Leaderboard</h1>
          <div className="w-16" />
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white/20 rounded-2xl p-1 mb-6">
          {(['total', 'weekly'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-black transition-all ${
                tab === t ? 'bg-white text-orange-600 shadow-md' : 'text-white/80'
              }`}
            >
              {t === 'total' ? '⚡ EXP รวม' : '📅 สัปดาห์นี้'}
            </button>
          ))}
        </div>

        {sorted.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-xl">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-gray-600 font-bold">ยังไม่มีโปรไฟล์</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((r, i) => {
              const { profile } = r
              const avatar = getAvatar(profile.avatar)
              const levelMeta = LEVEL_META[profile.level - 1] ?? LEVEL_META[0]
              const gameLevel = getGameLevel(profile.totalExp)
              const currentRank = tab === 'total' ? r.rank : r.weekRank
              const score = tab === 'total' ? r.totalExp : r.weeklyExp
              const isTop3 = currentRank <= 3
              const medal = MEDAL[currentRank - 1] ?? ''

              return (
                <motion.div
                  key={profile.id}
                  className={`bg-white rounded-3xl shadow-xl overflow-hidden ${isTop3 ? 'ring-2 ring-yellow-300' : ''}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Rank badge */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      isTop3
                        ? 'bg-gradient-to-br from-yellow-400 to-orange-400'
                        : 'bg-gray-100'
                    }`}>
                      {isTop3 ? (
                        <span className="text-2xl">{medal}</span>
                      ) : (
                        <span className="text-lg font-black text-gray-500">#{currentRank}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${levelMeta.color} flex items-center justify-center text-2xl shadow-md flex-shrink-0`}>
                      {avatar.emoji}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-800 text-base truncate">{profile.nickname}</p>
                      <p className="text-xs text-gray-500 font-semibold">
                        {levelMeta.emoji} {levelMeta.name} · Game Lv.{gameLevel}
                      </p>
                      {tab === 'weekly' && r.weeklyExp === 0 && (
                        <p className="text-[10px] text-gray-400 font-semibold">ยังไม่ได้ฝึกสัปดาห์นี้</p>
                      )}
                    </div>

                    {/* Score */}
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xl font-black tabular-nums ${
                        isTop3 ? 'text-orange-500' : 'text-violet-600'
                      }`}>
                        {score.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold">
                        {tab === 'total' ? 'EXP' : 'EXP/สัปดาห์'}
                      </p>
                      <p className="text-[10px] text-orange-400 font-bold">🔥 {r.streak} วัน</p>
                    </div>
                  </div>

                  {/* EXP progress bar for total tab */}
                  {tab === 'total' && (
                    <div className="px-4 pb-3 pt-0">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full bg-gradient-to-r ${levelMeta.color} rounded-full`}
                          initial={{ width: 0 }}
                          animate={{ width: `${profile.totalExp % 100}%` }}
                          transition={{ duration: 0.8, delay: i * 0.06 + 0.2 }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Motivational footer */}
        {sorted.length > 1 && (
          <motion.p
            className="text-white/60 text-center text-xs font-semibold mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            ฝึกทุกวันเพื่อขึ้นอันดับ! 💪
          </motion.p>
        )}

      </div>
    </div>
  )
}
