// ─── EXP Tier System ─────────────────────────────────────────────────────────
// 10 tiers from EXP 0 (baby) → 3500 (king).
// Each tier has age-sensitive display data and animation style.

export interface ExpTier {
  rank: number
  minExp: number
  name: string            // Thai name
  description: string
  emoji: string           // Main character emoji
  particles: string[]     // Floating particle emojis (higher tiers get more)
  color: string           // Tailwind gradient classes for bar & glow
  bgColor: string         // Hex for subtle background circle
}

export const EXP_TIERS: ExpTier[] = [
  {
    rank: 1, minExp: 0, name: 'ทารกน้อย', description: 'เพิ่งเริ่มต้นการเดินทาง',
    emoji: '🐣', particles: ['✨'],
    color: 'from-pink-300 to-yellow-300', bgColor: '#fce7f3',
  },
  {
    rank: 2, minExp: 50, name: 'เด็กน้อย', description: 'กำลังเรียนรู้สิ่งใหม่ๆ',
    emoji: '🌱', particles: ['🌸', '⭐'],
    color: 'from-green-300 to-teal-400', bgColor: '#d1fae5',
  },
  {
    rank: 3, minExp: 150, name: 'นักเรียน', description: 'ตั้งใจเรียน ใฝ่รู้เสมอ',
    emoji: '📚', particles: ['⭐', '💡'],
    color: 'from-blue-300 to-cyan-400', bgColor: '#dbeafe',
  },
  {
    rank: 4, minExp: 300, name: 'ผู้ฝึกหัด', description: 'ฝึกฝนทุกวัน ก้าวหน้าแน่นอน',
    emoji: '⚔️', particles: ['✨', '⚡'],
    color: 'from-amber-400 to-orange-400', bgColor: '#fef3c7',
  },
  {
    rank: 5, minExp: 500, name: 'นักรบ', description: 'เก่งกล้า สู้ไม่ถอย',
    emoji: '🔥', particles: ['🔥', '⚡', '✨'],
    color: 'from-orange-400 to-red-500', bgColor: '#fee2e2',
  },
  {
    rank: 6, minExp: 800, name: 'วีรบุรุษ', description: 'ผ่านการพิสูจน์มาแล้ว',
    emoji: '⚡', particles: ['💫', '⭐', '🌟'],
    color: 'from-purple-400 to-pink-500', bgColor: '#ede9fe',
  },
  {
    rank: 7, minExp: 1200, name: 'แชมป์เปี้ยน', description: 'ยอดเยี่ยมที่สุดในสนาม',
    emoji: '🏆', particles: ['🏆', '⭐', '💫', '✨'],
    color: 'from-yellow-400 to-amber-500', bgColor: '#fef9c3',
  },
  {
    rank: 8, minExp: 1800, name: 'ตำนาน', description: 'ชื่อที่ทุกคนรู้จัก',
    emoji: '👑', particles: ['👑', '💎', '🌟', '💫'],
    color: 'from-violet-500 to-purple-700', bgColor: '#f3e8ff',
  },
  {
    rank: 9, minExp: 2500, name: 'ปรมาจารย์', description: 'เชี่ยวชาญทุกด้านอย่างแท้จริง',
    emoji: '💎', particles: ['💎', '🌟', '👑', '⭐'],
    color: 'from-cyan-400 to-blue-600', bgColor: '#e0f2fe',
  },
  {
    rank: 10, minExp: 3500, name: 'พระราชา', description: 'ผู้ยิ่งใหญ่แห่งอาณาจักรคณิต',
    emoji: '🌟', particles: ['🌟', '💫', '✨', '👑', '💎'],
    color: 'from-yellow-300 to-orange-500', bgColor: '#fefce8',
  },
]

export function getCurrentTier(totalExp: number): ExpTier {
  for (let i = EXP_TIERS.length - 1; i >= 0; i--) {
    if (totalExp >= EXP_TIERS[i].minExp) return EXP_TIERS[i]
  }
  return EXP_TIERS[0]
}

export function getNextTier(totalExp: number): ExpTier | null {
  const cur = getCurrentTier(totalExp)
  return EXP_TIERS.find(t => t.rank === cur.rank + 1) ?? null
}

export function getTierProgress(totalExp: number): number {
  const cur = getCurrentTier(totalExp)
  const nxt = getNextTier(totalExp)
  if (!nxt) return 1
  return Math.min(1, (totalExp - cur.minExp) / (nxt.minExp - cur.minExp))
}

/** Visual style based on age — cartoon → sleek */
export type AgeStyle = 'cartoon' | 'vibrant' | 'cool' | 'sleek'

export function getAgeStyle(age: number): AgeStyle {
  if (age <= 8)  return 'cartoon'
  if (age <= 12) return 'vibrant'
  if (age <= 16) return 'cool'
  return 'sleek'
}
