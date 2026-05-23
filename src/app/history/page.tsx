'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { OP_META, ALL_OPS } from '@/lib/types'
import type { Profile, SessionRecord, Op } from '@/lib/types'

function loadHistory(profileId: string): SessionRecord[] {
  try { return JSON.parse(localStorage.getItem(`nobi_history_${profileId}`) ?? '[]') } catch { return [] }
}

const ITEMS_PER_PAGE = 20

export default function HistoryPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [history, setHistory] = useState<SessionRecord[]>([])
  const [filterOp, setFilterOp] = useState<Op | 'all'>('all')
  const [page, setPage] = useState(0)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('nobi_profile')
      if (!raw) { router.replace('/'); return }
      const p: Profile = JSON.parse(raw)
      setProfile(p)
      const h = loadHistory(p.id)
      setHistory(h.slice().reverse())          // newest first
    } catch {
      router.replace('/')
    }
  }, [router])

  if (!profile) return null

  const filtered = filterOp === 'all'
    ? history
    : history.filter(s => s.op === filterOp)
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))
  const page_ = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(page_ * ITEMS_PER_PAGE, (page_ + 1) * ITEMS_PER_PAGE)

  // Summary stats
  const totalSessions = history.length
  const totalCorrect = history.reduce((s, r) => s + r.score, 0)
  const totalProblems = history.reduce((s, r) => s + r.total, 0)
  const avgAcc = totalProblems > 0 ? Math.round(totalCorrect / totalProblems * 100) : 0
  const totalExp = history.reduce((s, r) => s + r.expGained, 0)
  const opCounts = Object.fromEntries(ALL_OPS.map(op => [op, history.filter(s => s.op === op).length]))

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 p-4">
      <div className="max-w-lg mx-auto pt-4 pb-8">

        {/* Back */}
        <button
          onClick={() => router.push('/practice')}
          className="text-white/70 text-sm font-bold mb-4 flex items-center gap-1 hover:text-white"
        >
          ← กลับฝึก
        </button>

        {/* Title */}
        <motion.div
          className="text-center mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-white font-black text-xl">📅 ประวัติการฝึก</h1>
          <p className="text-white/70 text-sm font-semibold">{profile.nickname}</p>
        </motion.div>

        {/* Summary card */}
        <motion.div
          className="bg-white rounded-3xl shadow-xl p-5 mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-sm font-black text-gray-600 mb-3">📊 สรุปทั้งหมด</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { e: '📚', v: `${totalSessions}`, l: 'เซสชั่น' },
              { e: '🎯', v: `${avgAcc}%`,       l: 'แม่นยำเฉลี่ย' },
              { e: '⚡', v: `${totalExp}`,       l: 'EXP รวม' },
            ].map(s => (
              <div key={s.l} className="bg-purple-50 rounded-2xl p-3 text-center">
                <div className="text-xl mb-1">{s.e}</div>
                <div className="text-sm font-black text-violet-700 tabular-nums">{s.v}</div>
                <div className="text-[10px] text-gray-400 font-bold">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Op distribution */}
          <div className="grid grid-cols-4 gap-2">
            {ALL_OPS.map(op => {
              const meta = OP_META[op]
              const count = opCounts[op] ?? 0
              return (
                <div key={op} className="text-center">
                  <div className="text-xl">{meta.emoji}</div>
                  <div className="text-xs font-black text-violet-700">{count}</div>
                  <div className="text-[9px] text-gray-400 font-bold">{meta.name}</div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          className="flex gap-2 mb-3 overflow-x-auto pb-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {([
            { key: 'all' as const, label: 'ทั้งหมด', emoji: '📋' },
            ...ALL_OPS.map(op => ({ key: op as Op | 'all', label: OP_META[op].name, emoji: OP_META[op].emoji })),
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilterOp(tab.key); setPage(0) }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${
                filterOp === tab.key
                  ? 'bg-white text-violet-700 shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
        </motion.div>

        {/* History list */}
        <motion.div
          className="bg-white rounded-3xl shadow-xl overflow-hidden mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {pageItems.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-gray-400 font-bold text-sm">ยังไม่มีประวัติ</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pageItems.map((s, i) => {
                const meta = OP_META[s.op]
                const date = new Date(s.date)
                const dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                const accColor = s.accuracy >= 90 ? 'text-emerald-600' : s.accuracy >= 70 ? 'text-amber-600' : 'text-red-500'
                return (
                  <motion.div
                    key={s.id}
                    className="flex items-center gap-3 px-4 py-3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    {/* Op badge */}
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-lg flex-shrink-0 shadow-sm`}>
                      {meta.emoji}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-gray-700">
                        {meta.name} · ระดับ {s.level}
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold">{dateStr} {timeStr}</p>
                    </div>

                    {/* Score */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-violet-700 tabular-nums">{s.score}/{s.total}</p>
                      <p className={`text-[10px] font-black tabular-nums ${accColor}`}>{s.accuracy}%</p>
                    </div>

                    {/* Time + EXP */}
                    <div className="text-right flex-shrink-0 w-12">
                      <p className="text-xs font-black text-emerald-600 tabular-nums">+{s.expGained}</p>
                      <p className="text-[10px] text-gray-400">{s.avgTimeSeconds}s/ข้อ</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page_ === 0}
              className="bg-white/20 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40 hover:bg-white/30 transition-colors"
            >
              ← ก่อนหน้า
            </button>
            <span className="text-white/80 text-sm font-semibold">
              {page_ + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page_ === totalPages - 1}
              className="bg-white/20 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40 hover:bg-white/30 transition-colors"
            >
              ถัดไป →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
