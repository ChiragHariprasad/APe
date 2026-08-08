-- ============================================================
-- APE Teacher Flow — PostgreSQL Schema (Neon)
-- ============================================================
-- 5 new tables for teacher-side data collection.
-- Does NOT modify any existing student tables.
-- ============================================================

-- ============================================================
-- 1. teacher_profiles (one per teacher, dispositional traits)
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_profiles (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    years_teaching          SMALLINT,
    level                   VARCHAR(10),          -- UG / PG / both
    mode                    VARCHAR(10),          -- theory / lab / both
    avg_class_size          SMALLINT,
    capability_confidence   SMALLINT CHECK (capability_confidence BETWEEN 1 AND 5),
    interest_new_methods    SMALLINT CHECK (interest_new_methods BETWEEN 1 AND 5),
    edtech_comfort          SMALLINT CHECK (edtech_comfort BETWEEN 1 AND 5),
    onboarding_complete     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_user ON teacher_profiles (user_id);

-- ============================================================
-- 2. teacher_course_profiles (one per teacher × course)
--    Stores T1 course-specific + T2 responses + interview results
-- ============================================================
DO $$ BEGIN
    CREATE TYPE teacher_survey_status AS ENUM (
        'not_started', 't1_in_progress', 't2_in_progress',
        'interview_in_progress', 't3_in_progress', 'completed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS teacher_course_profiles (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id              UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    subject_id              UUID NOT NULL REFERENCES subjects(id),
    status                  teacher_survey_status NOT NULL DEFAULT 'not_started',

    -- T1 per-course fields (Teacher Profile)
    current_pedagogies      JSONB,                -- multi-select pedagogy keys used
    primary_pedagogy        VARCHAR(30),           -- single-select primary pedagogy
    primary_confidence      SMALLINT CHECK (primary_confidence BETWEEN 1 AND 5),
    active_method_comfort   SMALLINT CHECK (active_method_comfort BETWEEN 1 AND 5),
    interest_trying         SMALLINT CHECK (interest_trying BETWEEN 1 AND 5),
    willingness_change      SMALLINT CHECK (willingness_change BETWEEN 1 AND 5),
    willing_changes         JSONB,                -- T1.7 multi-select
    constraints_vector      JSONB,                -- T1.8 multi-select
    top_constraints         JSONB,                -- T1.9 ranked top 3

    -- T2 fields (Course Pedagogy Profile)
    course_pedagogies       JSONB,                -- T2.1 multi-select
    course_primary          VARCHAR(30),           -- T2.2 single-select
    perceived_effectiveness SMALLINT CHECK (perceived_effectiveness BETWEEN 1 AND 5),
    pedagogy_satisfaction   SMALLINT CHECK (pedagogy_satisfaction BETWEEN 1 AND 5),
    course_fit              SMALLINT CHECK (course_fit BETWEEN 1 AND 5),
    course_barriers         JSONB,                -- T2.6 multi-select
    change_enablers         JSONB,                -- T2.7 multi-select

    -- Interview-extracted profile (from adaptive interview)
    interview_profile       JSONB,                -- structured profile labels
    pedagogy_mix            JSONB,                -- classified pedagogy mix array

    -- Computed mismatch
    mismatch_scenario       VARCHAR(5),           -- A, B, C, D

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,

    UNIQUE (teacher_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_course_profiles_teacher ON teacher_course_profiles (teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_course_profiles_subject ON teacher_course_profiles (subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_course_profiles_status ON teacher_course_profiles (status);

-- ============================================================
-- 3. teacher_interview_turns (conversation log per course)
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_interview_turns (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_course_id   UUID NOT NULL REFERENCES teacher_course_profiles(id) ON DELETE CASCADE,
    turn_index          SMALLINT NOT NULL,
    branch              VARCHAR(30),              -- lecture_heavy, mixed_method, etc.
    question            TEXT NOT NULL,
    answer              TEXT NOT NULL,
    llm_classification  JSONB,                    -- raw LLM output for audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_turns_course ON teacher_interview_turns (teacher_course_id);

-- ============================================================
-- 4. teacher_mismatch_probes (T3 conditional responses)
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_mismatch_probes (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_course_id       UUID NOT NULL REFERENCES teacher_course_profiles(id) ON DELETE CASCADE,
    scenario                VARCHAR(5) NOT NULL,  -- A, B, C, D
    student_pes             NUMERIC,              -- student PES at time of probe
    teacher_satisfaction    SMALLINT,             -- teacher satisfaction at time

    -- Scenario B fields (Teacher=Satisfied, Student=Not Satisfied)
    effectiveness_reasons   JSONB,                -- T3.1 multi-select
    willingness_to_change   SMALLINT CHECK (willingness_to_change BETWEEN 1 AND 5),
    change_requirements     JSONB,                -- T3.3 multi-select

    -- Scenario C fields (Teacher=Not Satisfied, Student=Satisfied)
    pedagogy_problems       JSONB,                -- T3.4 multi-select
    continue_if_positive    SMALLINT CHECK (continue_if_positive BETWEEN 1 AND 5),
    ease_changes            JSONB,                -- T3.6 multi-select

    -- Scenario D fields (Teacher=Not Satisfied, Student=Not Satisfied)
    preferred_changes       JSONB,                -- T3.7 multi-select
    interested_pedagogies   JSONB,                -- T3.8 multi-select
    change_barriers         JSONB,                -- T3.9 multi-select

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mismatch_probes_course ON teacher_mismatch_probes (teacher_course_id);

-- ============================================================
-- 5. teacher_post_evaluations (T4, one per teacher × course × pedagogy)
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_post_evaluations (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_course_id       UUID NOT NULL REFERENCES teacher_course_profiles(id) ON DELETE CASCADE,
    evaluated_pedagogy      VARCHAR(30) NOT NULL,

    -- T4.1 Effectiveness
    effectiveness_score     SMALLINT CHECK (effectiveness_score BETWEEN 1 AND 5),

    -- T4.2 Feasibility sub-items
    time_fit                SMALLINT CHECK (time_fit BETWEEN 1 AND 5),
    effort_manageable       SMALLINT CHECK (effort_manageable BETWEEN 1 AND 5),
    prep_manageable         SMALLINT CHECK (prep_manageable BETWEEN 1 AND 5),
    mgmt_manageable         SMALLINT CHECK (mgmt_manageable BETWEEN 1 AND 5),
    feasibility_score       NUMERIC,              -- mean(above 4)

    -- T4.3 Context fit sub-items
    class_size_fit          SMALLINT CHECK (class_size_fit BETWEEN 1 AND 5),
    student_readiness_fit   SMALLINT CHECK (student_readiness_fit BETWEEN 1 AND 5),
    subject_difficulty_fit  SMALLINT CHECK (subject_difficulty_fit BETWEEN 1 AND 5),
    curriculum_fit          SMALLINT CHECK (curriculum_fit BETWEEN 1 AND 5),
    participation_fit       SMALLINT CHECK (participation_fit BETWEEN 1 AND 5),
    context_fit_score       NUMERIC,              -- mean(above 5)

    -- T4.4 Resource burden sub-items
    planning_burden         SMALLINT CHECK (planning_burden BETWEEN 1 AND 5),
    tech_burden             SMALLINT CHECK (tech_burden BETWEEN 1 AND 5),
    material_burden         SMALLINT CHECK (material_burden BETWEEN 1 AND 5),
    workload_burden         SMALLINT CHECK (workload_burden BETWEEN 1 AND 5),
    assessment_burden       SMALLINT CHECK (assessment_burden BETWEEN 1 AND 5),
    resource_burden_score   NUMERIC,              -- mean(above 5)

    -- T4.5 Final action
    teacher_action          VARCHAR(30),           -- continue / adjust / blend / pivot / discontinue
    ape_action              VARCHAR(30),           -- system-computed action

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (teacher_course_id, evaluated_pedagogy)
);

CREATE INDEX IF NOT EXISTS idx_post_eval_course ON teacher_post_evaluations (teacher_course_id);
