-- ============================================================
-- Nobi Skill — Sync Fix Migration
-- Fixes: missing columns, op CHECK constraint
-- ============================================================

-- ── 1. Add missing columns to profiles ────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS level          INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_exp      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_stats JSONB   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trophies_json  JSONB   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skill_stats    JSONB   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS streak         INTEGER NOT NULL DEFAULT 0;

-- Sync current_level → level for any existing rows
UPDATE profiles SET level = current_level WHERE level = 1 AND current_level != 1;

-- ── 2. Fix session_records op CHECK — include all operations ─────────────────
ALTER TABLE session_records DROP CONSTRAINT IF EXISTS session_records_op_check;
ALTER TABLE session_records
  ADD CONSTRAINT session_records_op_check
  CHECK (op = ANY (ARRAY['add','sub','mul','div','times_table','fraction','decimal']));

-- ── 3. Performance index ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_session_records_profile_date
  ON session_records(profile_id, date DESC);
