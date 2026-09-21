-- =============================================================================
-- TEST SERIES HIERARCHY & MULTI-SUBJECT ENHANCEMENTS (2026-09-21)
-- Safe, additive migration:
-- 1. Adds `is_paid` flag to `test_series` so series are directly designated Free/Paid.
-- 2. Adds `series_id` to `tests` for direct hierarchy relationship.
-- 3. Adds `subject_ids` to `tests` to support multi-subject tests (e.g. Computer + GK + Reasoning).
-- 4. Ensures `subject_id` exists on `questions` for subject-level question tracking.
-- 5. Backfills existing data cleanly without deleting anything.
-- =============================================================================

-- 1. Add is_paid to test_series (default false = Free)
ALTER TABLE test_series ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;

-- 2. Add series_id and subject_ids to tests
ALTER TABLE tests ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES test_series(id) ON DELETE CASCADE;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS subject_ids UUID[] DEFAULT '{}';

-- 3. Ensure subject_id on questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES test_series_subjects(id) ON DELETE SET NULL;

-- 4. Backfill tests.series_id from test_series_subjects for any existing tests
UPDATE tests t
SET series_id = s.series_id
FROM test_series_subjects s
WHERE t.subject_id = s.id AND t.series_id IS NULL;

-- 5. Backfill tests.subject_ids with its primary subject_id if empty
UPDATE tests
SET subject_ids = ARRAY[subject_id]
WHERE subject_id IS NOT NULL AND (subject_ids IS NULL OR cardinality(subject_ids) = 0);

-- 6. Backfill questions.subject_id from tests.subject_id if currently null
UPDATE questions q
SET subject_id = t.subject_id
FROM tests t
WHERE q.test_id = t.id AND q.subject_id IS NULL;

-- 7. Mark known paid series
UPDATE test_series
SET is_paid = true
WHERE id = 'b5c28222-d6d5-4469-a985-899eed4e0446'
   OR title ILIKE '%paid%'
   OR title ILIKE '%premium%';

-- Also mark any series with paid tests as is_paid = true
UPDATE test_series s
SET is_paid = true
FROM test_series_subjects sub
JOIN tests t ON t.subject_id = sub.id AND t.is_paid = true
WHERE s.id = sub.series_id;

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tests_series_id ON tests(series_id);
CREATE INDEX IF NOT EXISTS idx_test_series_is_paid ON test_series(is_paid);
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON questions(subject_id);
