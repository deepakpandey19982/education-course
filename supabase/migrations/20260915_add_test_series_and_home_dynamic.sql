-- =============================================================================
-- 1. HOME PAGE DYNAMIC CONTENT TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS home_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    link TEXT,
    title TEXT,
    subtitle TEXT,
    "order" INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS home_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    icon_url TEXT,
    link TEXT,
    description TEXT,
    "order" INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- =============================================================================
-- 2. TEST SERIES SYSTEM TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    is_published BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID,
    title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    max_marks INTEGER NOT NULL,
    negative_marks FLOAT DEFAULT 0,
    is_paid BOOLEAN DEFAULT false,
    price DECIMAL(10,2) DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID,
    name TEXT NOT NULL,
    "order" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option CHAR(1),
    explanation TEXT,
    marks INTEGER DEFAULT 1,
    negative_marks FLOAT DEFAULT 0,
    language TEXT DEFAULT 'English',
    "order" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS test_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    test_id UUID,
    start_time TIMESTAMPTZ DEFAULT now(),
    end_time TIMESTAMPTZ,
    final_score FLOAT,
    status TEXT DEFAULT 'started',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID,
    question_id UUID,
    selected_option CHAR(1),
    is_correct BOOLEAN
);

-- =============================================================================
-- 3. CONSTRAINTS (Idempotent)
-- =============================================================================

-- Check Constraints
ALTER TABLE questions DROP CONSTRAINT IF EXISTS check_correct_option;
ALTER TABLE questions ADD CONSTRAINT check_correct_option CHECK (correct_option IN ('A', 'B', 'C', 'D'));

ALTER TABLE test_attempts DROP CONSTRAINT IF EXISTS check_attempt_status;
ALTER TABLE test_attempts ADD CONSTRAINT check_attempt_status CHECK (status IN ('started', 'submitted'));

ALTER TABLE test_responses DROP CONSTRAINT IF EXISTS check_selected_option;
ALTER TABLE test_responses ADD CONSTRAINT check_selected_option CHECK (selected_option IN ('A', 'B', 'C', 'D'));

-- Foreign Keys
ALTER TABLE tests DROP CONSTRAINT IF EXISTS fk_tests_series;
ALTER TABLE tests ADD CONSTRAINT fk_tests_series FOREIGN KEY (series_id) REFERENCES test_series(id) ON DELETE CASCADE;

ALTER TABLE test_subjects DROP CONSTRAINT IF EXISTS fk_subjects_tests;
ALTER TABLE test_subjects ADD CONSTRAINT fk_subjects_tests FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE;

ALTER TABLE questions DROP CONSTRAINT IF EXISTS fk_questions_subjects;
ALTER TABLE questions ADD CONSTRAINT fk_questions_subjects FOREIGN KEY (subject_id) REFERENCES test_subjects(id) ON DELETE CASCADE;

ALTER TABLE test_attempts DROP CONSTRAINT IF EXISTS fk_attempts_user;
ALTER TABLE test_attempts ADD CONSTRAINT fk_attempts_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE test_attempts DROP CONSTRAINT IF EXISTS fk_attempts_test;
ALTER TABLE test_attempts ADD CONSTRAINT fk_attempts_test FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE;

ALTER TABLE test_responses DROP CONSTRAINT IF EXISTS fk_responses_attempt;
ALTER TABLE test_responses ADD CONSTRAINT fk_responses_attempt FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE;

ALTER TABLE test_responses DROP CONSTRAINT IF EXISTS fk_responses_question;
ALTER TABLE test_responses ADD CONSTRAINT fk_responses_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

-- =============================================================================
-- 4. INITIAL DATA
-- =============================================================================

INSERT INTO site_settings (key, value)
VALUES ('banner_interval', '5')
ON CONFLICT (key) DO NOTHING;
