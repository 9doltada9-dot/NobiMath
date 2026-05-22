export interface Avatar {
  id: string
  emoji: string
  name: string
  color: string        // Tailwind gradient classes
  bgColor: string      // Tailwind bg color for highlights
}

export const AVATARS: Avatar[] = [
  { id: 'lion',       emoji: '🦁', name: 'สิงโต',     color: 'from-yellow-400 to-orange-500',  bgColor: 'bg-yellow-50'  },
  { id: 'tiger',      emoji: '🐯', name: 'เสือโคร่ง',  color: 'from-orange-400 to-red-500',    bgColor: 'bg-orange-50'  },
  { id: 'panda',      emoji: '🐼', name: 'แพนด้า',    color: 'from-gray-300 to-gray-500',     bgColor: 'bg-gray-50'    },
  { id: 'fox',        emoji: '🦊', name: 'จิ้งจอก',   color: 'from-orange-300 to-amber-500',  bgColor: 'bg-amber-50'   },
  { id: 'frog',       emoji: '🐸', name: 'กบน้อย',    color: 'from-green-400 to-emerald-500', bgColor: 'bg-green-50'   },
  { id: 'butterfly',  emoji: '🦋', name: 'ผีเสื้อ',   color: 'from-purple-400 to-pink-500',   bgColor: 'bg-purple-50'  },
  { id: 'dolphin',    emoji: '🐬', name: 'โลมา',      color: 'from-sky-400 to-cyan-500',      bgColor: 'bg-sky-50'     },
  { id: 'unicorn',    emoji: '🦄', name: 'ยูนิคอร์น', color: 'from-pink-400 to-violet-500',   bgColor: 'bg-pink-50'    },
  { id: 'dragon',     emoji: '🐉', name: 'มังกร',     color: 'from-red-400 to-rose-600',      bgColor: 'bg-red-50'     },
  { id: 'dino',       emoji: '🦖', name: 'ไดโนเสาร์', color: 'from-teal-400 to-green-600',    bgColor: 'bg-teal-50'    },
  { id: 'rocket',     emoji: '🚀', name: 'จรวด',      color: 'from-blue-500 to-indigo-600',   bgColor: 'bg-blue-50'    },
  { id: 'star',       emoji: '⭐', name: 'ดาวเด่น',   color: 'from-yellow-300 to-amber-500',  bgColor: 'bg-yellow-50'  },
]

export function getAvatar(id: string): Avatar {
  return AVATARS.find(a => a.id === id) ?? AVATARS[11]
}
