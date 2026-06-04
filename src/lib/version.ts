// ─── App Version ─────────────────────────────────────────────────────────────
// แก้ไขโดย _bump.cjs อัตโนมัติทุกครั้งที่รัน _push.bat
export const APP_VERSION = '1.5.0'
export const APP_VERSION_NAME = 'feat: version modal, rename user, attention analysis, calc hints (carry/borrow)'
export const BUILD_DATE = '2026-06-04'

// ─── Changelog ────────────────────────────────────────────────────────────────
export interface VersionEntry {
  version: string
  name: string
  date: string
}

export const CHANGELOG: VersionEntry[] = [
  { version: '1.5.0', name: 'feat: version modal, rename user, attention analysis, calc hints (carry/borrow)', date: '2026-06-04' },
  { version: '1.3.6', name: 'Fix: profile page 404 — use query param /profile?id= instead of dynamic route', date: '2026-05-23' },
  { version: '1.3.5', name: 'Phase 5: Parent Dashboard + Leaderboard + Operations (fraction/decimal/times_table) + Daily Reminder', date: '2026-05-23' },
  { version: '1.3.4', name: 'Fix: tsconfig supabase exclude + version system', date: '2026-05-23' },
  { version: '1.3.3', name: 'Bug fixes and improvements', date: '2026-05-23' },
  { version: '1.3.2', name: 'Fix: exclude supabase/functions from TypeScript compiler', date: '2026-05-23' },
  { version: '1.3.1', name: 'Fix: onSwitchUser undefined in DashboardScreen', date: '2026-05-23' },
  { version: '1.3.0', name: 'Phase 4: Multi-user auth + cloud sync', date: '2026-05-23' },
  { version: '1.2.0', name: 'Phase 3: Per-operation level tracking + AI feedback', date: '2026-05-23' },
  { version: '1.1.0', name: 'Phase 2: Supabase Edge Function + Gemini AI', date: '2026-05-23' },
  { version: '1.0.0', name: 'Phase 1: Assessment, Profile, History, Gamification', date: '2026-05-23' },
]
