-- ============================================================
-- APE Survey Collection — PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id       VARCHAR(64) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    display_name    VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ============================================================
-- 2. academic_batches
-- ============================================================
CREATE TABLE IF NOT EXISTS academic_batches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_year      SMALLINT NOT NULL UNIQUE,
    label           VARCHAR(50) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. student_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS student_profiles (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    batch_id            UUID NOT NULL REFERENCES academic_batches(id),
    is_lateral_entry    BOOLEAN NOT NULL DEFAULT FALSE,
    current_semester    SMALLINT NOT NULL,
    usn_year            SMALLINT NOT NULL,
    onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_user ON student_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_batch ON student_profiles (batch_id);

-- ============================================================
-- 4. pedagogies
-- ============================================================
CREATE TABLE IF NOT EXISTS pedagogies (
    id                  VARCHAR(4) PRIMARY KEY,
    name                VARCHAR(128) NOT NULL,
    success_criterion   TEXT NOT NULL,
    questions           JSONB NOT NULL
);

-- ============================================================
-- 5. subjects
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_code    VARCHAR(20) NOT NULL,
    subject_name    VARCHAR(255) NOT NULL,
    faculty         JSONB NOT NULL DEFAULT '[]',
    pedagogy_id     VARCHAR(4) NOT NULL REFERENCES pedagogies(id),
    batch_year      SMALLINT NOT NULL,
    semester_key    VARCHAR(20) NOT NULL,
    semester_number SMALLINT NOT NULL,
    is_lab          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (subject_code, batch_year, semester_key, is_lab)
);

CREATE INDEX IF NOT EXISTS idx_subjects_batch_sem ON subjects (batch_year, semester_number);
CREATE INDEX IF NOT EXISTS idx_subjects_pedagogy ON subjects (pedagogy_id);

-- ============================================================
-- 6. survey_sessions
-- ============================================================
DO $$ BEGIN
    CREATE TYPE survey_status AS ENUM ('in_progress', 'completed', 'abandoned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS survey_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id      UUID NOT NULL REFERENCES subjects(id),
    status          survey_status NOT NULL DEFAULT 'in_progress',
    current_index   SMALLINT NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON survey_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON survey_sessions (status);

-- ============================================================
-- 7. survey_answers (Likert-scale, questions 0-9)
-- ============================================================
CREATE TABLE IF NOT EXISTS survey_answers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES survey_sessions(id) ON DELETE CASCADE,
    question_index  SMALLINT NOT NULL CHECK (question_index BETWEEN 0 AND 9),
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (session_id, question_index)
);

CREATE INDEX IF NOT EXISTS idx_answers_session ON survey_answers (session_id);

-- ============================================================
-- 8. voice_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS voice_notes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_url     TEXT NOT NULL,
    storage_key     TEXT NOT NULL,
    mime_type       VARCHAR(50) NOT NULL DEFAULT 'audio/webm',
    duration_secs   SMALLINT NOT NULL CHECK (duration_secs <= 240),
    file_size_bytes INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. open_ended_responses
-- ============================================================
CREATE TABLE IF NOT EXISTS open_ended_responses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES survey_sessions(id) ON DELETE CASCADE,
    question_index  SMALLINT NOT NULL CHECK (question_index IN (10, 11)),
    question_text   TEXT NOT NULL,
    text_response   TEXT,
    voice_note_id   UUID REFERENCES voice_notes(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (session_id, question_index)
);

CREATE INDEX IF NOT EXISTS idx_open_ended_session ON open_ended_responses (session_id);

-- ============================================================
-- 10. transcripts
-- ============================================================
CREATE TABLE IF NOT EXISTS transcripts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voice_note_id   UUID NOT NULL UNIQUE REFERENCES voice_notes(id) ON DELETE CASCADE,
    transcript_text TEXT NOT NULL,
    language        VARCHAR(10) NOT NULL DEFAULT 'en',
    confidence      REAL,
    provider        VARCHAR(50) NOT NULL DEFAULT 'whisper',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. completion_status
-- ============================================================
CREATE TABLE IF NOT EXISTS completion_status (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id      UUID NOT NULL REFERENCES subjects(id),
    session_id      UUID NOT NULL REFERENCES survey_sessions(id),
    is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at    TIMESTAMPTZ,

    UNIQUE (user_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_completion_user ON completion_status (user_id);

-- ============================================================
-- Seed academic batches
-- ============================================================
INSERT INTO academic_batches (batch_year, label) VALUES
    (2022, '2022-2026 Batch'),
    (2023, '2023-2027 Batch'),
    (2024, '2024-2028 Batch')
ON CONFLICT (batch_year) DO NOTHING;
