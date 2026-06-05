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

// ─── Accuracy Sparkline Chart ──────────────────────────────────────────────────
function AccuracyChart({ sessions }: { sessions: SessionRecord[] }) {
  if (sessions.length < 2) return null

  const W = 300, H = 80, PAD = 8
  const points = sessions.map((s, i) => ({
    x: PAD + (i / (sessions.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - s.accuracy / 100) * (H - PAD * 2),
    acc: s.accuracy,
    op: s.op,
  }))

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath = `M${points[0].x},${H} ` +
    points.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${points[points.length - 1].x},${H} Z`

  const avg = Math.round(sessions.reduce((s, r) => s + r.accuracy, 0) / sessions.length)
  const last = sessions[sessions.length - 1].accuracy
  const trend = last > avg ? '▲' : last < avg ? '▼' : '─'
  const trendColor = last > avg ? 'text-emerald-500' : last < avg ? 'text-red-400' : 'text-gray-400'

  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1 px-1">
        <span>เก่าสุด</span>
        <span className={`font-black text-sm ${trendColor}`}>{trend} {last}%</span>
        <span>ล่าสุด</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
        {/* 50% and 90% guide lines */}
        {[50, 90].map(pct => {
          const y = PAD + (1 - pct / 100) * (H - PAD * 2)
          return (
            <g key={pct}>
              <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,3" />
              <text x={W - PAD + 2} y={y + 3} fontSize="8" fill="#9ca3af">{pct}%</text>
            </g>
          )
        })}
        {/* Area fill */}
        <path d={areaPath} fill="url(#chartGrad)" opacity="0.3" />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2.5}
            fill={p.acc >= 90 ? '#10b981' : p.acc >= 70 ? '#7c3aed' : '#f59e0b'}
            stroke="white" strokeWidth="1.5"
          />
        ))}
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex justify-center gap-4 mt-1">
        {[
          { color: 'bg-emerald-400', label: '≥90%' },
          { color: 'bg-violet-500',  label: '70-89%' },
          { color: 'bg-amber-400',   label: '<70%' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${l.color}`} />
            <span className="text-[9px] text-gray-400 font-bold">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

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

        {/* Nav row */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white font-bold text-sm px-3 py-2 rounded-2xl transition-colors"
          >
            🏠 หน้าหลัก
          </button>
          <button
            onClick={() => router.push('/practice')}
            className="text-white/70 text-sm font-bold flex items-center gap-1 hover:text-white"
          >
            ฝึกต่อ →
          </button>
        </div>

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

          {/* Op distribution — filter ops that have been practiced */}
          <div className="grid grid-cols-4 gap-2">
            {ALL_OPS.filter(op => (opCounts[op] ?? 0) > 0 || ['add','sub','mul','div'].includes(op)).map(op => {
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

        {/* Accuracy Trend Chart */}
        {history.length >= 3 && (
          <motion.div
            className="bg-white rounded-3xl shadow-xl p-5 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <h2 className="text-sm font-black text-gray-600 mb-3">📈 ความแม่นยำ 20 ครั้งล่าสุด</h2>
            <AccuracyChart sessions={history.slice(0, 20).reverse()} />
          </motion.div>
        )}

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
