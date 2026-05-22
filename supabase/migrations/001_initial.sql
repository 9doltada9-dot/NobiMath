-- ============================================================
-- Nobi Skill — Initial Database Schema
-- ============================================================

-- ── Profiles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname     TEXT        NOT NULL,
  age          INTEGER     NOT NULL CHECK (age BETWEEN 5 AND 20),
  avatar       TEXT        NOT NULL,
  level        INTEGER     NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  total_exp    INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Assessment Results ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessment_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  determined_level  INTEGER     NOT NULL CHECK (determined_level BETWEEN 1 AND 10),
  accuracy          FLOAT       NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
  avg_time_seconds  FLOAT       NOT NULL,
  total_questions   INTEGER     NOT NULL,
  answers           JSONB       NOT NULL DEFAULT '[]',
  completed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Practice Sessions ──────────────────────────────────────────────────────────
-- One row per day per profile. AI generates these after each completed session.
CREATE TABLE IF NOT EXISTS practice_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_date      DATE        NOT NULL,
  level               INTEGER     NOT NULL CHECK (level BETWEEN 1 AND 10),
  problems            JSONB       NOT NULL DEFAULT '[]',  -- array of {a, b, answer, level}
  submitted_answers   JSONB,                              -- array of AnswerRecord after completion
  score               INTEGER,
  accuracy            FLOAT,
  avg_time_seconds    FLOAT,
  ai_feedback         JSONB,                              -- AIFeedback object from Gemini
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  UNIQUE (profile_id, scheduled_date)
);

-- ── Weak Patterns ──────────────────────────────────────────────────────────────
-- Tracks which specific number combinations the child struggles with.
CREATE TABLE IF NOT EXISTS weak_patterns (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level       INTEGER     NOT NULL,
  pattern_key TEXT        NOT NULL,   -- e.g. "7+8", "carry_tens"
  error_count INTEGER     NOT NULL DEFAULT 1,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, pattern_key)
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assessment_profile   ON assessment_results(profile_id);
CREATE INDEX IF NOT EXISTS idx_practice_profile     ON practice_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_practice_date        ON practice_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_weak_patterns_profile ON weak_patterns(profile_id);

-- ── Auto-update updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security (enable when adding Auth) ───────────────────────────────
-- ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE practice_sessions  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE weak_patterns      ENABLE ROW LEVEL SECURITY;
