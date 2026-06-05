// ─── App Version ─────────────────────────────────────────────────────────────
// แก้ไขโดย _bump.cjs อัตโนมัติทุกครั้งที่รัน _push.bat
export const APP_VERSION = '1.8.2'
export const APP_VERSION_NAME = 'fix: account_id NOT NULL blocked every profile insert — fix DB + code'
export const BUILD_DATE = '2026-06-05'

// ─── Changelog ────────────────────────────────────────────────────────────────
export interface VersionEntry {
  version: string
  name: string
  date: string
}

export const CHANGELOG: VersionEntry[] = [
  { version: '1.8.2', name: 'fix: account_id NOT NULL blocked every profile insert — fix DB + code', date: '2026-06-05' },
  { version: '1.8.1', name: 'fix: profile ID was not UUID — auto-migrate local_XXXX to UUID, fix sync to Supabase', date: '2026-06-05' },
  { version: '1.8.0', name: 'feat: auto-sync on tab focus, show last sync time, merge strategy explained', date: '2026-06-05' },
  { version: '1.7.1', name: 'fix: sync cross-device — add missing DB columns, fix op constraint, pull sessions for all profiles, sync lifetime/trophy/skill stats', date: '2026-06-05' },
  { version: '1.7.0', name: 'feat: guide modal — EXP/level, mission, trophies, tier progression explained', date: '2026-06-05' },
  { version: '1.6.1', name: 'style: add home button to practice dashboard and history page', date: '2026-06-05' },
  { version: '1.6.0', name: 'feat: 9 new features — SRS, error classifier, attention SM, warm-up, speed challenge, number bond, contextual, mastery, weekly report', date: '2026-06-05' },
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
