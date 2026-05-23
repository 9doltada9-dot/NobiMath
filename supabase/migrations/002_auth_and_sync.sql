-- ============================================================
-- Nobi Skill — Phase 4: Auth + Multi-user Sync
-- ============================================================

-- ── Update profiles table ──────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS op_levels JSONB       NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── Session Records (history rows, one per practice session) ──────────────────
CREATE TABLE IF NOT EXISTS session_records (
  id               TEXT        PRIMARY KEY,               -- session_<timestamp>
  profile_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  date             TIMESTAMPTZ NOT NULL,
  op               TEXT        NOT NULL CHECK (op IN ('add','sub','mul','div')),
  score            INTEGER     NOT NULL,
  total            INTEGER     NOT NULL,
  accuracy         FLOAT       NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
  avg_time_seconds FLOAT       NOT NULL DEFAULT 0,
  exp_gained       INTEGER     NOT NULL DEFAULT 0,
  level            INTEGER     NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS session_records_profile_idx ON session_records (profile_id, date);
CREATE INDEX IF NOT EXISTS session_records_user_idx    ON session_records (user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- profiles: owner can do everything; null user_id rows are readable by anyone (legacy)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"  ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"  ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own"  ON profiles;

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE
  USING (auth.uid() = user_id);

-- session_records RLS
ALTER TABLE session_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_select_own" ON session_records;
DROP POLICY IF EXISTS "sessions_insert_own" ON session_records;
DROP POLICY IF EXISTS "sessions_delete_own" ON session_records;

CREATE POLICY "sessions_select_own" ON session_records FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "sessions_insert_own" ON session_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_delete_own" ON session_records FOR DELETE
  USING (auth.uid() = user_id);
