'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { getAvatar } from '@/lib/avatars'
import { loadLifetime, loadTrophies, TROPHIES } from '@/lib/trophies'
import { loadSkillStats, getWeakSkills, skillLabel, skillEmoji, accuracyOf } from '@/lib/adaptive'
import { LEVEL_META, OP_META, ALL_OPS, opLevel } from '@/lib/types'
import type { Profile } from '@/lib/types'

function getGameLevel(exp: number) { return Math.floor(exp / 100) + 1 }

interface ProfileSummary {
  profile: Profile
  sessions: number
  accuracy: number
  streak: number
  trophyCount: number
  weakTopics: string[]
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <motion.div
        className={`h-full bg-gradient-to-r ${color} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  )
}

export default function ParentDashboardPage() {
  const router = useRouter()
  const [summaries, setSummaries] = useState<ProfileSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const profiles: Profile[] = JSON.parse(localStorage.getItem('nobi_profiles') ?? '[]')
    const data: ProfileSummary[] = profiles.map(p => {
      const life = loadLifetime(p.id)
      const trophies = loadTrophies(p.id)
      const skillStats = loadSkillStats(p.id)
      const weak = getWeakSkills(skillStats).slice(0, 3)
      const streak = parseInt(localStorage.getItem(`nobi_streak_${p.id}`) ?? '0', 10)
      return {
        profile: p,
        sessions: life.sessions,
        accuracy: life.problems > 0 ? Math.round(life.correct / life.problems * 100) : -1,
        streak,
        trophyCount: TROPHIES.filter(t => trophies[t.id]).length,
        weakTopics: weak.map(s => skillLabel(s.tag)),
      }
    })
    setSummaries(data)
    setLoaded(true)
  }, [])

  if (!loaded) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 flex items-center justify-center">
      <motion.div className="text-6xl" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⭐</motion.div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 p-4">
      <div className="max-w-2xl mx-auto pt-4 pb-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.push('/')} className="text-white/70 text-sm font-bold hover:text-white flex items-center gap-1">
            ← กลับ
          </button>
          <h1 className="text-white font-black text-xl">👨‍👩‍👧 รายงานผู้ปกครอง</h1>
          <div className="w-16" />
        </div>

        {summaries.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-xl">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-gray-600 font-bold">ยังไม่มีโปรไฟล์</p>
            <button onClick={() => router.push('/setup')} className="mt-4 bg-violet-500 text-white font-bold px-6 py-3 rounded-2xl">
              + สร้างโปรไฟล์
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {summaries.map((s, i) => {
              const { profile, sessions, accuracy, streak, trophyCount, weakTopics } = s
              const avatar = getAvatar(profile.avatar)
              const levelMeta = LEVEL_META[profile.level - 1] ?? LEVEL_META[0]
              const gameLevel = getGameLevel(profile.totalExp)
              const expPct = profile.totalExp % 100

              return (
                <motion.div
                  key={profile.id}
                  className="bg-white rounded-3xl shadow-xl overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                >
                  {/* Profile header */}
                  <div className={`bg-gradient-to-r ${levelMeta.color} p-4 flex items-center gap-4`}>
                    <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center text-3xl shadow-md flex-shrink-0">
                      {avatar.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-white font-black text-lg">{profile.nickname}</h2>
                      <p className="text-white/80 text-xs font-semibold">
                        {levelMeta.emoji} {levelMeta.name} · Game Lv.{gameLevel} · อายุ {profile.age} ปี
                      </p>
                    </div>
                    <button
                      onClick={() => router.push(`/profile?id=${profile.id}`)}
                      className="bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-white/30 transition-colors"
                    >
                      ดูเพิ่ม
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* EXP bar */}
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1">
                        <span>⚡ {profile.totalExp} EXP รวม</span>
                        <span>{expPct}/100 ถึง Lv.{gameLevel + 1}</span>
                      </div>
                      <ProgressBar pct={expPct} color={levelMeta.color} />
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { e: '📚', v: `${sessions}`, l: 'เซสชั่น' },
                        { e: '🎯', v: accuracy >= 0 ? `${accuracy}%` : '—', l: 'แม่นยำ' },
                        { e: '🔥', v: `${streak}วัน`, l: 'Streak' },
                        { e: '🏆', v: `${trophyCount}/${TROPHIES.length}`, l: 'Trophy' },
                      ].map(stat => (
                        <div key={stat.l} className="bg-violet-50 rounded-2xl p-2.5 text-center">
                          <p className="text-lg">{stat.e}</p>
                          <p className="text-sm font-black text-violet-700 tabular-nums">{stat.v}</p>
                          <p className="text-[9px] text-gray-400 font-bold">{stat.l}</p>
                        </div>
                      ))}
                    </div>

                    {/* Op levels */}
                    <div>
                      <p className="text-xs font-black text-gray-500 mb-2">📊 ระดับแต่ละ operation</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {ALL_OPS.map(op => {
                          const meta = OP_META[op]
                          const lvl = opLevel(profile, op)
                          return (
                            <div key={op} className="flex items-center gap-2">
                              <span className="text-sm w-4 text-center">{meta.emoji}</span>
                              <span className="text-[10px] font-bold text-gray-500 w-10">{meta.name}</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full bg-gradient-to-r ${meta.color} rounded-full`}
                                  style={{ width: `${(lvl / 10) * 100}%` }} />
                              </div>
                              <span className="text-[10px] font-black text-violet-600 w-8 text-right">Lv.{lvl}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Weak topics */}
                    {weakTopics.length > 0 && (
                      <div className="bg-amber-50 rounded-2xl p-3 border border-amber-100">
                        <p className="text-xs font-black text-amber-700 mb-1.5">🎯 จุดอ่อนที่ควรฝึก</p>
                        <div className="flex flex-wrap gap-1.5">
                          {weakTopics.map(t => (
                            <span key={t} className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Practice button */}
                    <button
                      onClick={() => {
                        localStorage.setItem('nobi_active_profile', profile.id)
                        localStorage.setItem('nobi_profile', JSON.stringify(profile))
                        router.push('/practice')
                      }}
                      className={`w-full bg-gradient-to-r ${levelMeta.color} text-white font-extrabold py-3 rounded-2xl shadow-md hover:brightness-105 transition-all`}
                    >
                      🚀 เริ่มฝึก{profile.nickname}
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Weekly summary card */}
        {summaries.length > 0 && (
          <motion.div
            className="mt-5 bg-white/20 rounded-3xl p-5 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: summaries.length * 0.07 + 0.1 }}
          >
            <h3 className="text-white font-black text-sm mb-3">📈 สรุปรวม</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: 'เซสชั่นรวม',
                  value: summaries.reduce((sum, s) => sum + s.sessions, 0),
                  emoji: '📚',
                },
                {
                  label: 'Trophy รวม',
                  value: summaries.reduce((sum, s) => sum + s.trophyCount, 0),
                  emoji: '🏆',
                },
                {
                  label: 'Streak สูงสุด',
                  value: Math.max(...summaries.map(s => s.streak), 0) + 'วัน',
                  emoji: '🔥',
                },
              ].map(stat => (
                <div key={stat.label} className="bg-white/20 rounded-2xl p-3 text-center">
                  <p className="text-2xl">{stat.emoji}</p>
                  <p className="text-white font-black text-lg">{stat.value}</p>
                  <p className="text-white/70 text-[10px] font-bold">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  )
}
