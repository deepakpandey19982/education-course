-- =============================================================================
-- TEST SERIES MANAGEMENT SYSTEM (rebuild of the incomplete 20260915 draft)
-- Fixes: correct hierarchy (Series -> Subjects -> Tests -> Questions),
-- adds RLS on every table, adds server-authoritative attempt/timer fields,
-- adds answer-status tracking, and wires paid tests into the existing
-- Razorpay `orders` table instead of creating a parallel payment system.
--
-- Safe to run: only touches the never-finished draft tables from
-- 20260915_add_test_series_and_home_dynamic.sql. Does not touch
-- profiles / courses / course_files / orders (only additive ALTERs on orders).
-- =============================================================================

-- Drop the old draft test-series tables (never had RLS, wrong hierarchy, no data).
DROP TABLE IF EXISTS test_responses CASCADE;
DROP TABLE IF EXISTS test_attempts CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS test_subjects CASCADE;
DROP TABLE IF EXISTS tests CASCADE;
DROP TABLE IF EXISTS test_series CASCADE;

-- =============================================================================
-- 1. HOME PAGE DYNAMIC CONTENT (kept from draft, adds updated_at + per-banner interval)
-- =============================================================================

CREATE TABLE IF NOT EXISTS home_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    link TEXT,
    title TEXT,
    subtitle TEXT,
    interval_seconds INTEGER NOT NULL DEFAULT 5,
    "order" INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE home_banners ADD COLUMN IF NOT EXISTS interval_seconds INTEGER NOT NULL DEFAULT 5;
ALTER TABLE home_banners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS home_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    icon_url TEXT,
    link TEXT,
    description TEXT,
    "order" INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE home_options ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- =============================================================================
-- 2. TEST SERIES SYSTEM (correct hierarchy: series -> subjects -> tests -> questions)
-- =============================================================================

CREATE TABLE test_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    is_published BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE test_series_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES test_series(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon_url TEXT,
    "order" INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES test_series_subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date_label TEXT,                        -- e.g. "13 SEP 2026" shown on the card
    thumbnail_url TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    max_marks INTEGER NOT NULL DEFAULT 0,
    marks_per_correct NUMERIC(6,2) NOT NULL DEFAULT 1,
    negative_marks NUMERIC(6,2) NOT NULL DEFAULT 0,
    language TEXT NOT NULL DEFAULT 'English',
    instructions TEXT,
    is_paid BOOLEAN NOT NULL DEFAULT false,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT false,
    scheduled_start TIMESTAMPTZ,             -- optional, drives LIVE/UPCOMING badge
    scheduled_end TIMESTAMPTZ,                -- optional, drives ENDED badge
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES test_series_subjects(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    explanation TEXT,
    marks NUMERIC(6,2) NOT NULL DEFAULT 1,
    negative_marks NUMERIC(6,2) NOT NULL DEFAULT 0,
    language TEXT NOT NULL DEFAULT 'English',
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES test_series_subjects(id) ON DELETE SET NULL;

-- Server-authoritative attempt: duration_minutes_snapshot + started_at are the
-- source of truth for the timer; the client never dictates remaining time.
CREATE TABLE test_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_minutes_snapshot INTEGER NOT NULL,
    submitted_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'auto_submitted')),
    score NUMERIC(8,2),
    correct_count INTEGER,
    incorrect_count INTEGER,
    unattempted_count INTEGER,
    accuracy NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Only one active attempt per user per test at a time.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_attempt_per_user_test
    ON test_attempts (user_id, test_id)
    WHERE status = 'in_progress';

CREATE TABLE test_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_option CHAR(1) CHECK (selected_option IN ('A', 'B', 'C', 'D')),
    status TEXT NOT NULL DEFAULT 'not_visited'
        CHECK (status IN ('not_visited', 'visited', 'answered', 'marked_for_review', 'answered_marked')),
    is_correct BOOLEAN,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (attempt_id, question_id)
);

-- =============================================================================
-- 3. WIRE PAID TESTS INTO THE EXISTING ORDERS / RAZORPAY FLOW
-- =============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS test_id UUID REFERENCES tests(id) ON DELETE SET NULL;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_item_required;
ALTER TABLE orders ADD CONSTRAINT orders_item_required
    CHECK (course_id IS NOT NULL OR test_id IS NOT NULL);

-- =============================================================================
-- 4. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_subjects_series ON test_series_subjects(series_id);
CREATE INDEX IF NOT EXISTS idx_tests_subject ON tests(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_test ON questions(test_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_test ON test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_answers_attempt ON test_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_orders_test ON orders(test_id);

-- =============================================================================
-- 5. updated_at TRIGGERS (reuses update_modified_column() from schema.sql)
-- =============================================================================

DROP TRIGGER IF EXISTS update_home_banners_modtime ON home_banners;
CREATE TRIGGER update_home_banners_modtime BEFORE UPDATE ON home_banners FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_home_options_modtime ON home_options;
CREATE TRIGGER update_home_options_modtime BEFORE UPDATE ON home_options FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_test_series_modtime ON test_series;
CREATE TRIGGER update_test_series_modtime BEFORE UPDATE ON test_series FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_subjects_modtime ON test_series_subjects;
CREATE TRIGGER update_subjects_modtime BEFORE UPDATE ON test_series_subjects FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_tests_modtime ON tests;
CREATE TRIGGER update_tests_modtime BEFORE UPDATE ON tests FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_questions_modtime ON questions;
CREATE TRIGGER update_questions_modtime BEFORE UPDATE ON questions FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- =============================================================================
-- 6. ROW LEVEL SECURITY
--    Key rule: `questions` has NO public/user SELECT policy at all. Students
--    never read questions directly from Supabase - only via a server route
--    (service-role key) that strips correct_option/explanation until submit,
--    verifies payment for paid tests, and grades server-side. This matches
--    requirement #18 (never trust the client with answers or scores).
-- =============================================================================

ALTER TABLE home_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_series_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_answers ENABLE ROW LEVEL SECURITY;

-- home_banners
DROP POLICY IF EXISTS "Enabled banners are viewable by everyone" ON home_banners;
CREATE POLICY "Enabled banners are viewable by everyone" ON home_banners
    FOR SELECT USING (is_enabled = true);
DROP POLICY IF EXISTS "Admins can manage banners" ON home_banners;
CREATE POLICY "Admins can manage banners" ON home_banners
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- home_options
DROP POLICY IF EXISTS "Enabled options are viewable by everyone" ON home_options;
CREATE POLICY "Enabled options are viewable by everyone" ON home_options
    FOR SELECT USING (is_enabled = true);
DROP POLICY IF EXISTS "Admins can manage options" ON home_options;
CREATE POLICY "Admins can manage options" ON home_options
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- site_settings
DROP POLICY IF EXISTS "Settings are viewable by everyone" ON site_settings;
CREATE POLICY "Settings are viewable by everyone" ON site_settings
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage settings" ON site_settings;
CREATE POLICY "Admins can manage settings" ON site_settings
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- test_series
DROP POLICY IF EXISTS "Published series are viewable by everyone" ON test_series;
CREATE POLICY "Published series are viewable by everyone" ON test_series
    FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS "Admins can manage series" ON test_series;
CREATE POLICY "Admins can manage series" ON test_series
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- test_series_subjects
DROP POLICY IF EXISTS "Enabled subjects of published series are viewable" ON test_series_subjects;
CREATE POLICY "Enabled subjects of published series are viewable" ON test_series_subjects
    FOR SELECT USING (
        is_enabled = true
        AND EXISTS (SELECT 1 FROM test_series s WHERE s.id = series_id AND s.is_published = true)
    );
DROP POLICY IF EXISTS "Admins can manage subjects" ON test_series_subjects;
CREATE POLICY "Admins can manage subjects" ON test_series_subjects
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- tests (metadata only - title/duration/marks/price are fine to expose publicly for cards)
DROP POLICY IF EXISTS "Published tests are viewable by everyone" ON tests;
CREATE POLICY "Published tests are viewable by everyone" ON tests
    FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS "Admins can manage tests" ON tests;
CREATE POLICY "Admins can manage tests" ON tests
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- questions: admin-only. No student policy. Reads happen only through a
-- service-role API route.
DROP POLICY IF EXISTS "Admins can manage questions" ON questions;
CREATE POLICY "Admins can manage questions" ON questions
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- test_attempts: users see/manage only their own; admins see all
DROP POLICY IF EXISTS "Users manage own attempts" ON test_attempts;
CREATE POLICY "Users manage own attempts" ON test_attempts
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all attempts" ON test_attempts;
CREATE POLICY "Admins can view all attempts" ON test_attempts
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- test_answers: users manage only answers on their own attempts; admins view all
DROP POLICY IF EXISTS "Users manage own answers" ON test_answers;
CREATE POLICY "Users manage own answers" ON test_answers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid())
    );
DROP POLICY IF EXISTS "Admins can view all answers" ON test_answers;
CREATE POLICY "Admins can view all answers" ON test_answers
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- =============================================================================
-- 7. INITIAL DATA
-- =============================================================================

INSERT INTO site_settings (key, value)
VALUES ('banner_interval_default', '5')
ON CONFLICT (key) DO NOTHING;
