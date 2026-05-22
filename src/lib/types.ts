// ─── Profile ──────────────────────────────────────────────────────────────────
export interface Profile {
  id: string
  nickname: string
  age: number
  avatar: string          // Avatar id
  level: number           // Current working level (1-10)
  totalExp: number
  createdAt: string
}

// ─── Operations ─────────────────────────────────────────────────────────────
export type Op = 'add' | 'sub' | 'mul' | 'div'

export interface OpMeta {
  op: Op
  symbol: string          // display symbol (＋ − × ÷)
  name: string            // Thai name
  emoji: string
  color: string           // Tailwind gradient classes
}

export const OP_META: Record<Op, OpMeta> = {
  add: { op: 'add', symbol: '+', name: 'บวก',  emoji: '➕', color: 'from-violet-500 to-pink-500'   },
  sub: { op: 'sub', symbol: '−', name: 'ลบ',   emoji: '➖', color: 'from-sky-500 to-indigo-500'    },
  mul: { op: 'mul', symbol: '×', name: 'คูณ',  emoji: '✖️', color: 'from-amber-500 to-orange-500'  },
  div: { op: 'div', symbol: '÷', name: 'หาร',  emoji: '➗', color: 'from-emerald-500 to-teal-500'  },
}

export const ALL_OPS: Op[] = ['add', 'sub', 'mul', 'div']

// ─── Skill Tags (adaptive weak-spot tracking) ──────────────────────────────────
// Op-namespaced strings, e.g. 'add-d2', 'add-carry', 'sub-borrow', 'mul-d3', 'div-d2'.
export type SkillTag = string

// ─── Math Problem ─────────────────────────────────────────────────────────────
export interface Problem {
  a: number
  b: number
  answer: number
  level: number           // Difficulty level (1-10)
  op?: Op                 // operation (defaults to 'add' for older records)
  tags?: SkillTag[]       // skill tags for adaptive tracking
  focusTag?: SkillTag     // set when this problem was generated to drill a weak skill
}

// ─── Skill Stats (per child, persisted in localStorage) ─────────────────────────
export interface SkillStat {
  tag: SkillTag
  attempts: number
  correct: number
  totalTimeSeconds: number
  recentWrong: number     // recency-weighted wrong counter (decays on correct)
  lastSeen: string        // ISO timestamp of last attempt
}

export type SkillStats = Record<string, SkillStat>

// ─── Answer Record ────────────────────────────────────────────────────────────
export interface AnswerRecord {
  problem: Problem
  userAnswer: number | null
  isCorrect: boolean
  timeSeconds: number
}

// ─── Assessment ───────────────────────────────────────────────────────────────
export interface AssessmentResult {
  profileId: string
  determinedLevel: number
  accuracy: number          // 0-100
  avgTimeSeconds: number
  totalQuestions: number
  answers: AnswerRecord[]
  completedAt: string
}

// ─── Practice Session ─────────────────────────────────────────────────────────
export interface PracticeSession {
  id: string
  profileId: string
  scheduledDate: string     // YYYY-MM-DD
  level: number
  problems: Problem[]
  submittedAnswers?: AnswerRecord[]
  score?: number
  accuracy?: number
  avgTimeSeconds?: number
  aiFeedback?: AIFeedback
  status: 'pending' | 'in_progress' | 'completed'
  createdAt: string
  completedAt?: string
}

// ─── AI Feedback ──────────────────────────────────────────────────────────────
export interface AIFeedback {
  summary: string           // Short summary in Thai
  strengths: string[]
  weaknesses: string[]
  recommendedLevel: number
  encouragement: string     // Fun message for kid
}

// ─── Level Meta ───────────────────────────────────────────────────────────────
export interface LevelMeta {
  level: number
  name: string
  description: string
  emoji: string
  color: string             // Tailwind gradient classes
}

export const LEVEL_META: LevelMeta[] = [
  { level: 1,  name: 'นักคณิตน้อย',        description: 'บวกเลข 1 หลัก ไม่มีทด',        emoji: '🌱', color: 'from-green-400 to-teal-400'   },
  { level: 2,  name: 'นักคณิตหัดใหม่',      description: 'บวกเลข 1 หลัก มีทด',           emoji: '⭐', color: 'from-yellow-400 to-green-400'  },
  { level: 3,  name: 'นักคณิตกำลังเติบโต',  description: 'บวกเลข 2+1 หลัก ไม่มีทด',      emoji: '🌟', color: 'from-cyan-400 to-blue-400'     },
  { level: 4,  name: 'นักคณิตมือฉมัง',      description: 'บวกเลข 2+1 หลัก มีทด',         emoji: '💫', color: 'from-blue-400 to-indigo-400'   },
  { level: 5,  name: 'นักคณิตเก่ง',         description: 'บวกเลข 2+2 หลัก ไม่มีทด',      emoji: '🔥', color: 'from-purple-400 to-pink-400'   },
  { level: 6,  name: 'นักคณิตขั้นสูง',      description: 'บวกเลข 2+2 หลัก มีทด',         emoji: '🚀', color: 'from-pink-400 to-rose-400'     },
  { level: 7,  name: 'นักคณิตมืออาชีพ',     description: 'บวกเลข 3+2 หลัก',              emoji: '👑', color: 'from-orange-400 to-red-400'    },
  { level: 8,  name: 'นักคณิตระดับเซียน',   description: 'บวกเลข 3+3 หลัก ไม่มีทด',      emoji: '🏆', color: 'from-red-400 to-purple-500'    },
  { level: 9,  name: 'นักคณิตระดับแชมป์',   description: 'บวกเลข 3+3 หลัก มีทด',         emoji: '💎', color: 'from-violet-500 to-purple-600' },
  { level: 10, name: 'อัจฉริยะคณิต',        description: 'บวกเลขหลายหลัก ความเร็วสูง',   emoji: '🎯', color: 'from-yellow-400 to-orange-500' },
]
