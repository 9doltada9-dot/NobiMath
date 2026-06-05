'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LEVEL_META, OP_META, ALL_OPS } from '@/lib/types'
import { EXP_TIERS } from '@/lib/tiers'
import { TROPHIES } from '@/lib/trophies'
import { MASTERY_STREAK, MASTERY_TIME } from '@/lib/mastery'
import { getAgeQuestionCount } from '@/lib/mission'

type Tab = 'exp' | 'mission' | 'trophy' | 'tier'

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'exp',     label: 'EXP & ระดับ', emoji: '⚡' },
  { id: 'mission', label: 'ภารกิจ',     emoji: '🎯' },
  { id: 'trophy',  label: 'ถ้วยรางวัล', emoji: '🏆' },
  { id: 'tier',    label: 'ยศ & ขั้น',  emoji: '🌟' },
]

interface Props { onClose: () => void }

export default function GuideModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('exp')

  return (
    <motion.div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-3"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '88vh' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-pink-500 px-5 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white font-black text-lg">📖 คู่มือ Nobi Skill</h2>
              <p className="text-white/70 text-xs font-semibold">ระบบ EXP · ภารกิจ · ถ้วยรางวัล · การเลื่อนขั้น</p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl font-black leading-none">✕</button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-t-xl text-xs font-black transition-colors ${
                  tab === t.id
                    ? 'bg-white text-violet-700'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(88vh - 110px)' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="p-4 space-y-4"
            >
              {tab === 'exp' && <ExpTab />}
              {tab === 'mission' && <MissionTab />}
              {tab === 'trophy' && <TrophyTab />}
              {tab === 'tier' && <TierTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: EXP & ระดับ
// ─────────────────────────────────────────────────────────────────────────────
function ExpTab() {
  return (
    <div className="space-y-4">
      {/* EXP คืออะไร */}
      <Section title="⚡ EXP คืออะไร?" color="violet">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { emoji: '✅', label: 'ตอบถูก', value: '+10 EXP' },
            { emoji: '⚡', label: 'Speed Mode', value: '+15 EXP' },
            { emoji: '🎯', label: 'Mission', value: 'EXP x2' },
          ].map(item => (
            <div key={item.label} className="bg-violet-50 rounded-2xl p-2.5 text-center">
              <p className="text-lg">{item.emoji}</p>
              <p className="text-[10px] font-bold text-gray-500 mt-0.5">{item.label}</p>
              <p className="text-xs font-black text-violet-600">{item.value}</p>
            </div>
          ))}
        </div>
        <InfoRow icon="🎮" text="Game Level เพิ่มทุก 100 EXP — เก็บ EXP ได้ไม่จำกัด!" />
        <InfoRow icon="🏅" text={`Mastery: ตอบถูก ${MASTERY_STREAK} ครั้งติดกัน ภายใน ${MASTERY_TIME} วินาที = ทักษะนั้น MASTERED`} />
      </Section>

      {/* Math Level */}
      <Section title="📊 ระดับคณิต (Math Level)" color="blue">
        <p className="text-[11px] text-gray-500 font-semibold mb-3">
          แต่ละ operation (บวก/ลบ/คูณ/หาร) มีระดับ 1–10 ปรับอัตโนมัติตามผลฝึก
        </p>
        <div className="space-y-1.5">
          {LEVEL_META.map(lv => (
            <div key={lv.level} className="flex items-center gap-2">
              <span className="text-base w-5 text-center">{lv.emoji}</span>
              <span className="text-[10px] font-black text-gray-500 w-4 text-center">{lv.level}</span>
              <span className="text-xs font-bold text-gray-700 w-28">{lv.name}</span>
              <span className="text-[10px] text-gray-400 flex-1">{lv.description}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Operations */}
      <Section title="🔢 วิชาที่ฝึกได้" color="amber">
        <div className="grid grid-cols-2 gap-2">
          {ALL_OPS.map(op => {
            const m = OP_META[op]
            return (
              <div key={op} className={`rounded-2xl p-2.5 flex items-center gap-2 bg-gray-50`}>
                <span className="text-lg">{m.emoji}</span>
                <div>
                  <p className="text-xs font-black text-gray-700">{m.name}</p>
                  <p className="text-[10px] text-gray-400">{m.symbol}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: ภารกิจ
// ─────────────────────────────────────────────────────────────────────────────
function MissionTab() {
  const ageRows = [
    { age: '≤ 6 ปี', ops: 'บวก', count: getAgeQuestionCount(6) },
    { age: '7–8 ปี', ops: 'บวก, ลบ', count: getAgeQuestionCount(8) },
    { age: '9–10 ปี', ops: 'บวก ลบ คูณ หาร', count: getAgeQuestionCount(10) },
    { age: '11–12 ปี', ops: 'ทุกวิชา', count: getAgeQuestionCount(12) },
    { age: '13–14 ปี', ops: 'ทุกวิชา + ขั้นสูง', count: getAgeQuestionCount(14) },
    { age: '15+ ปี', ops: 'ทุกวิชา ระดับสูง', count: getAgeQuestionCount(99) },
  ]

  return (
    <div className="space-y-4">
      <Section title="🎯 ภารกิจประจำวัน คืออะไร?" color="violet">
        <InfoRow icon="🤖" text="AI วิเคราะห์จุดอ่อนและระดับของเด็ก จัดโจทย์ให้เหมาะสมที่สุด" />
        <InfoRow icon="📊" text="เน้นวิชาที่ระดับต่ำหรือมีจุดอ่อนมากกว่าวิชาอื่น" />
        <InfoRow icon="🔀" text="ผสมหลายวิชาในการฝึกเดียว ไม่เบื่อ" />
        <InfoRow icon="🌡️" text="เริ่มด้วย 3 ข้อวอร์มอัพ (ระดับง่ายกว่า) ก่อนโจทย์จริง" />
      </Section>

      <Section title="📈 จำนวนข้อตามอายุ" color="blue">
        <div className="space-y-1.5">
          {ageRows.map(row => (
            <div key={row.age} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
              <span className="text-xs font-black text-gray-500 w-16">{row.age}</span>
              <span className="text-[11px] text-gray-600 flex-1">{row.ops}</span>
              <span className="text-xs font-black text-violet-600">{row.count} ข้อ</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="⚡ Speed Challenge" color="amber">
        <InfoRow icon="🔒" text="ปลดล็อกเมื่อ Streak ≥ 7 วัน" />
        <InfoRow icon="⏱️" text="60 วินาที ตอบให้ได้มากที่สุด" />
        <InfoRow icon="💰" text="แต่ละข้อที่ถูก = +15 EXP (มากกว่าปกติ 50%)" />
      </Section>

      <Section title="🧠 ระบบ Adaptive อัตโนมัติ" color="green">
        <InfoRow icon="😴" text="เบื่อ (ถูกหมดเลย): ระบบเพิ่ม difficulty ทันที" />
        <InfoRow icon="😕" text="สับสน (ผิดต่อเนื่อง): ระบบลด difficulty + แสดง hint" />
        <InfoRow icon="😵" text="เหนื่อย (ช้าลงมาก): ระบบแนะนำพักผ่อน" />
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: ถ้วยรางวัล
// ─────────────────────────────────────────────────────────────────────────────
function TrophyTab() {
  return (
    <div className="space-y-4">
      <Section title="🏆 ถ้วยรางวัลทั้งหมด" color="amber">
        <p className="text-[11px] text-gray-400 font-semibold mb-3">
          ทำเงื่อนไขครบ → ได้ถ้วยทันที ไม่ต้องกดรับ
        </p>
        <div className="space-y-2">
          {TROPHIES.map(t => (
            <div key={t.id} className="flex items-start gap-3 p-2.5 bg-amber-50 rounded-2xl">
              <span className="text-2xl mt-0.5">{t.emoji}</span>
              <div>
                <p className="text-sm font-black text-amber-800">{t.name}</p>
                <p className="text-[11px] text-amber-600 font-semibold">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: ยศ & การเลื่อนขั้น
// ─────────────────────────────────────────────────────────────────────────────
function TierTab() {
  return (
    <div className="space-y-4">
      <Section title="🌟 ยศ EXP — เลื่อนขั้นสูงสุด 10 ขั้น" color="violet">
        <p className="text-[11px] text-gray-400 font-semibold mb-3">
          สะสม EXP เพียงพอ → ยศเพิ่มขึ้นอัตโนมัติ พร้อมอนิเมชั่นใหม่
        </p>
        <div className="space-y-2">
          {EXP_TIERS.map((tier, i) => {
            const next = EXP_TIERS[i + 1]
            const needed = next ? next.minExp - tier.minExp : '∞'
            return (
              <div key={tier.rank} className="flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50">
                <span className="text-2xl w-8 text-center">{tier.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-gray-700">{tier.name}</span>
                    <span className="bg-violet-100 text-violet-600 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      Rank {tier.rank}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-semibold">{tier.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-violet-600">{tier.minExp.toLocaleString()}</p>
                  <p className="text-[9px] text-gray-400">EXP</p>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="🎮 Game Level vs Math Level" color="blue">
        <InfoRow icon="🎮" text="Game Level = EXP รวม ÷ 100 — วัดความพยายามโดยรวม" />
        <InfoRow icon="📊" text="Math Level = วัดความสามารถแต่ละวิชา (1–10 ต่อ operation)" />
        <InfoRow icon="🔄" text="Math Level ปรับอัตโนมัติ: แม่นยำสูง → ยาก, แม่นยำต่ำ → ง่าย" />
        <InfoRow icon="🏅" text="Mastery Badge = ฝึกทักษะนั้นจน Master (5 ถูกติดกัน ≤ 8 วิ)" />
      </Section>

      <Section title="💡 เคล็ดลับเพิ่ม EXP เร็ว" color="green">
        <InfoRow icon="🔥" text="ฝึกทุกวันติดต่อกัน Streak สูง → ปลดล็อก Speed Mode" />
        <InfoRow icon="🎯" text="ทำภารกิจประจำวันครบ → EXP เยอะกว่าฝึกธรรมดา" />
        <InfoRow icon="⚡" text="ตอบให้ถูกและเร็ว → Spaced Repetition จะจัดให้ฝึกน้อยลง (ไม่เสียเวลา)" />
        <InfoRow icon="📖" text="เปิด hint วิธีคิด → เข้าใจแล้วจะทำผิดน้อยลง = EXP มากขึ้น" />
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable components
// ─────────────────────────────────────────────────────────────────────────────
function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const bg = color === 'violet' ? 'from-violet-500 to-purple-500'
           : color === 'blue'   ? 'from-sky-500 to-blue-500'
           : color === 'amber'  ? 'from-amber-400 to-orange-400'
           : color === 'green'  ? 'from-emerald-400 to-teal-500'
           : 'from-gray-400 to-gray-500'
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      <div className={`bg-gradient-to-r ${bg} px-4 py-2.5`}>
        <h3 className="text-white font-black text-sm">{title}</h3>
      </div>
      <div className="p-3 space-y-1.5 bg-white">{children}</div>
    </div>
  )
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-base leading-tight mt-0.5 flex-shrink-0">{icon}</span>
      <p className="text-[11px] text-gray-600 font-semibold leading-snug">{text}</p>
    </div>
  )
}
