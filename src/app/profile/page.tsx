'use client'

import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { getAvatar } from '@/lib/avatars'
import { loadLifetime, loadTrophies, getTrophy, TROPHIES } from '@/lib/trophies'
import { loadSkillStats, getWeakSkills, skillLabel, skillEmoji, accuracyOf } from '@/lib/adaptive'
import { LEVEL_META, OP_META, ALL_OPS, opLevel } from '@/lib/types'
import type { Profile, SessionRecord } from '@/lib/types'

function getGameLevel(exp: number) { return Math.floor(exp / 100) + 1 }

function loadHistory(profileId: string): SessionRecord[] {
  try { return JSON.parse(localStorage.getItem(`nobi_history_${profileId}`) ?? '[]') } catch { return [] }
}

// ─── Attention / time-pattern analysis ────────────────────────────────────────
interface TimeBucket { key: string; label: string; emoji: string; accuracies: number[] }
interface AttentionData {
  buckets: (TimeBucket & { avg: number })[]
  weeklyData: { dayLabel: string; avg: number; count: number }[]
}

function analyzeTimePatterns(sessions: SessionRecord[]): AttentionData | null {
  if (sessions.length < 3) return null
  const raw: TimeBucket[] = [
    { key: 'morning',   label: 'เช้า (6-11น.)',   emoji: '🌅', accuracies: [] },
    { key: 'afternoon', label: 'บ่าย (12-17น.)',   emoji: '☀️', accuracies: [] },
    { key: 'evening',   label: 'เย็น (18-21น.)',   emoji: '🌆', accuracies: [] },
    { key: 'night',     label: 'ดึก (22น.+)',      emoji: '🌙', accuracies: [] },
  ]
  for (const s of sessions) {
    const h = new Date(s.date).getHours()
    const idx = h >= 6 && h < 12 ? 0 : h >= 12 && h < 18 ? 1 : h >= 18 && h < 22 ? 2 : 3
    raw[idx].accuracies.push(s.accuracy)
  }
  const buckets = raw
    .map(b => ({ ...b, avg: b.accuracies.length > 0 ? Math.round(b.accuracies.reduce((a, c) => a + c, 0) / b.accuracies.length) : -1 }))
    .filter(b => b.avg >= 0)
    .sort((a, b) => b.avg - a.avg)

  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (6 - i)); return d
  })
  const dayMap = new Map<string, number[]>()
  days.forEach(d => dayMap.set(d.toDateString(), []))
  sessions.forEach(s => {
    const key = new Date(s.date).toDateString()
    if (dayMap.has(key)) dayMap.get(key)!.push(s.accuracy)
  })
  const weeklyData = days.map(d => {
    const accs = dayMap.get(d.toDateString()) ?? []
    return {
      dayLabel: d.toLocaleDateString('th-TH', { weekday: 'short' }),
      avg: accs.length > 0 ? Math.round(accs.reduce((a, c) => a + c, 0) / accs.length) : -1,
      count: accs.length,
    }
  })
  return { buckets, weeklyData }
}

function ProfileContent() {
  const router = useRouter()
  const params = useSearchParams()
  const profileId = params.get('id') ?? ''

  const [profile, setProfile] = useState<Profile | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  function saveName() {
    if (!nameInput.trim() || !profile) return
    const profiles: Profile[] = JSON.parse(localStorage.getItem('nobi_profiles') ?? '[]')
    const updated = profiles.map(p => p.id === profile.id ? { ...p, nickname: nameInput.trim() } : p)
    localStorage.setItem('nobi_profiles', JSON.stringify(updated))
    // Update active profile cache too
    const active = localStorage.getItem('nobi_profile')
    if (active) {
      try {
        const ap = JSON.parse(active)
        if (ap.id === profile.id) localStorage.setItem('nobi_profile', JSON.stringify({ ...ap, nickname: nameInput.trim() }))
      } catch { /* ignore */ }
    }
    setProfile({ ...profile, nickname: nameInput.trim() })
    setEditingName(false)
  }

  useEffect(() => {
    if (!profileId) { router.replace('/'); return }
    const profiles: Profile[] = JSON.parse(localStorage.getItem('nobi_profiles') ?? '[]')
    const p = profiles.find(x => x.id === profileId)
    if (!p) { router.replace('/'); return }
    setProfile(p)
  }, [profileId, router])

  if (!profile) return null

  const avatar = getAvatar(profile.avatar)
  const levelMeta = LEVEL_META[profile.level - 1] ?? LEVEL_META[0]
  const gameLevel = getGameLevel(profile.totalExp)
  const life = loadLifetime(profile.id)
  const trophyMap = loadTrophies(profile.id)
  const trophyCount = TROPHIES.filter(t => trophyMap[t.id]).length
  const skillStats = loadSkillStats(profile.id)
  const weakSkills = getWeakSkills(skillStats).slice(0, 5)
  const history = loadHistory(profile.id).slice(-20).reverse()
  const streak = parseInt(localStorage.getItem(`nobi_streak_${profile.id}`) ?? '0', 10)
  const overallAcc = life.problems > 0 ? Math.round(life.correct / life.problems * 100) : 0
  const attentionData = analyzeTimePatterns(loadHistory(profile.id))

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 p-4">
      <div className="max-w-lg mx-auto pt-4 pb-8">

        {/* Back + Action row */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/')} className="text-white/70 text-sm font-bold flex items-center gap-1 hover:text-white">
            ← กลับ
          </button>
          <button
            onClick={() => {
              localStorage.setItem('nobi_active_profile', profile.id)
              localStorage.setItem('nobi_profile', JSON.stringify(profile))
              router.push('/assessment')
            }}
            className="bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-white/30 transition-colors"
          >
            🎓 ทำแบบทดสอบ
          </button>
        </div>

        {/* Header card */}
        <motion.div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-4"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className={`bg-gradient-to-r ${levelMeta.color} p-5 flex items-center gap-4`}>
            <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center text-3xl shadow-lg">
              {avatar.emoji}
            </div>
            <div>
              {editingName ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    className="text-gray-800 font-black text-base bg-white/95 rounded-xl px-3 py-1 outline-none w-36"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                    autoFocus
                    maxLength={20}
                  />
                  <button onClick={saveName} className="text-green-300 font-black text-lg leading-none">✓</button>
                  <button onClick={() => setEditingName(false)} className="text-white/60 font-black text-sm leading-none">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-white font-black text-xl">{profile.nickname}</h1>
                  <button
                    onClick={() => { setNameInput(profile.nickname); setEditingName(true) }}
                    className="text-white/60 text-base hover:text-white/90 transition-colors"
                    title="แก้ชื่อ"
                  >
                    ✏️
                  </button>
                </div>
              )}
              <p className="text-white/80 text-sm font-semibold">{levelMeta.emoji} {levelMeta.name}</p>
              <p className="text-white/70 text-xs font-semibold">Game Lv.{gameLevel} · อายุ {profile.age} ปี</p>
            </div>
          </div>

          {/* EXP bar */}
          <div className="px-5 pt-3 pb-1">
            <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1">
              <span>⚡ {profile.totalExp} EXP รวม</span>
              <span>{profile.totalExp % 100}/100 ถึง Lv.{gameLevel + 1}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div className={`h-full bg-gradient-to-r ${levelMeta.color} rounded-full`}
                initial={{ width: 0 }} animate={{ width: `${profile.totalExp % 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }} />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-0 px-5 py-3">
            {[
              { e: '📚', v: life.sessions, l: 'เซสชั่น' },
              { e: '🎯', v: `${overallAcc}%`, l: 'แม่นยำ' },
              { e: '🔥', v: `${streak}วัน`, l: 'Streak' },
              { e: '🏆', v: `${trophyCount}/${TROPHIES.length}`, l: 'Trophy' },
            ].map(s => (
              <div key={s.l} className="text-center">
                <p className="text-lg">{s.e}</p>
                <p className="text-sm font-black text-violet-700 tabular-nums">{s.v}</p>
                <p className="text-[9px] text-gray-400 font-bold">{s.l}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Op level breakdown */}
        <motion.div className="bg-white rounded-3xl shadow-xl p-5 mb-4"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <h2 className="text-sm font-black text-gray-600 mb-3">📊 ระดับแต่ละ operation</h2>
          <div className="space-y-3">
            {ALL_OPS.map(op => {
              const meta = OP_META[op]
              const lvl = opLevel(profile, op)
              const sessionCount = life.ops[op] ?? 0
              return (
                <div key={op} className="flex items-center gap-3">
                  <span className="text-base w-5 text-center">{meta.emoji}</span>
                  <span className="text-xs font-bold text-gray-500 w-10">{meta.name}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full bg-gradient-to-r ${meta.color} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(lvl / 10) * 100}%` }}
                      transition={{ duration: 0.6, delay: 0.15 }}
                    />
                  </div>
                  <span className="text-xs font-black text-violet-700 tabular-nums w-10 text-right">Lv.{lvl}</span>
                  <span className="text-[10px] text-gray-400 tabular-nums w-12 text-right">{sessionCount} ครั้ง</span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Weak skills */}
        {weakSkills.length > 0 && (
          <motion.div className="bg-white rounded-3xl shadow-xl p-5 mb-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <h2 className="text-sm font-black text-gray-600 mb-3">🎯 จุดอ่อนที่ต้องฝึก</h2>
            <div className="space-y-2.5">
              {weakSkills.map(s => {
                const acc = Math.round(accuracyOf(s) * 100)
                return (
                  <div key={s.tag} className="flex items-center gap-2">
                    <span className="text-base">{skillEmoji(s.tag)}</span>
                    <span className="text-xs font-bold text-gray-600 flex-1 truncate">{skillLabel(s.tag)}</span>
                    <div className="w-20 h-2 bg-amber-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full" style={{ width: `${acc}%` }} />
                    </div>
                    <span className="text-xs font-black text-amber-600 tabular-nums w-9 text-right">{acc}%</span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Trophies */}
        <motion.div className="bg-white rounded-3xl shadow-xl p-5 mb-4"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <h2 className="text-sm font-black text-gray-600 mb-3">🏆 ถ้วยรางวัล ({trophyCount}/{TROPHIES.length})</h2>
          <div className="grid grid-cols-4 gap-2">
            {TROPHIES.map(t => {
              const unlocked = !!trophyMap[t.id]
              return (
                <div key={t.id} className={`rounded-2xl p-2.5 text-center border ${unlocked ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div className={`text-2xl mb-0.5 ${unlocked ? '' : 'grayscale opacity-30'}`}>{unlocked ? t.emoji : '🔒'}</div>
                  <p className={`text-[9px] font-black leading-tight ${unlocked ? 'text-amber-700' : 'text-gray-400'}`}>{t.name}</p>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Attention & Time Analysis */}
        {attentionData && (
          <motion.div className="bg-white rounded-3xl shadow-xl p-5 mb-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <h2 className="text-sm font-black text-gray-600 mb-3">🧠 วิเคราะห์สมาธิและความล้า</h2>

            {/* Best time */}
            {attentionData.buckets.length > 0 && (
              <div className="bg-violet-50 rounded-2xl p-3 mb-3">
                <p className="text-[10px] text-violet-400 font-bold mb-1">ช่วงเวลาที่ฝึกได้ดีที่สุด</p>
                <div className="space-y-1.5">
                  {attentionData.buckets.map((b, i) => (
                    <div key={b.key} className="flex items-center gap-2">
                      <span className="text-base w-5">{b.emoji}</span>
                      <span className="text-xs font-bold text-gray-600 w-28">{b.label}</span>
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${i === 0 ? 'bg-gradient-to-r from-violet-500 to-pink-500' : 'bg-gray-300'}`}
                          style={{ width: `${b.avg}%` }}
                        />
                      </div>
                      <span className={`text-xs font-black tabular-nums w-9 text-right ${i === 0 ? 'text-violet-600' : 'text-gray-400'}`}>
                        {b.avg}%{i === 0 ? ' 🏆' : ''}
                      </span>
                    </div>
                  ))}
                </div>
                {attentionData.buckets[3]?.key === 'night' && attentionData.buckets[3].avg < 60 && (
                  <p className="text-[10px] text-amber-600 font-bold mt-2">⚠️ ตอนดึกแม่นยำต่ำ — แนะนำให้ฝึกตอน{attentionData.buckets[0].label.split(' ')[0]}แทน</p>
                )}
              </div>
            )}

            {/* Weekly bar chart */}
            <p className="text-[10px] text-gray-400 font-bold mb-1.5">แม่นยำรายวัน (7 วันล่าสุด)</p>
            <div className="flex items-end justify-between gap-1 h-12">
              {attentionData.weeklyData.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                  <div className="w-full flex items-end justify-center" style={{ height: 36 }}>
                    {d.avg >= 0 ? (
                      <motion.div
                        className={`w-full rounded-t-lg ${d.count > 0 ? 'bg-violet-400' : 'bg-gray-100'}`}
                        style={{ height: `${Math.max(4, d.avg * 0.36)}px` }}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(4, d.avg * 0.36)}px` }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                      />
                    ) : (
                      <div className="w-full h-1 bg-gray-100 rounded" />
                    )}
                  </div>
                  <span className="text-[9px] text-gray-400 font-bold">{d.dayLabel}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-gray-400 mt-1 text-right">
              {attentionData.weeklyData.filter(d => d.count > 0).length} วันที่ฝึกในสัปดาห์นี้
            </p>
          </motion.div>
        )}

        {/* Recent sessions */}
        {history.length > 0 && (
          <motion.div className="bg-white rounded-3xl shadow-xl p-5"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-sm font-black text-gray-600 mb-3">📅 เซสชั่นล่าสุด</h2>
            <div className="space-y-2">
              {history.slice(0, 8).map(s => {
                const meta = OP_META[s.op]
                return (
                  <div key={s.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-lg">{meta?.emoji ?? '🔢'}</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-700">{meta?.name ?? s.op} · ระดับ {s.level}</p>
                      <p className="text-[10px] text-gray-400">{new Date(s.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-violet-700">{s.score}/{s.total}</p>
                      <p className="text-[10px] text-gray-400">{s.accuracy}%</p>
                    </div>
                    <div className="text-right w-12">
                      <p className="text-xs font-black text-emerald-600">+{s.expGained}</p>
                      <p className="text-[10px] text-gray-400">EXP</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <motion.div className="text-6xl" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⭐</motion.div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  )
}
