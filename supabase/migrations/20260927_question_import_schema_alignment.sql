-- Align questions and tests tables for complete question import support
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES test_series_subjects(id) ON DELETE SET NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_image_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_a_image_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_b_image_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_c_image_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_d_image_url TEXT;
ALTER TABLE questions ALTER COLUMN option_a DROP NOT NULL;
ALTER TABLE questions ALTER COLUMN option_b DROP NOT NULL;
ALTER TABLE questions ALTER COLUMN option_c DROP NOT NULL;
ALTER TABLE questions ALTER COLUMN option_d DROP NOT NULL;

-- Ensure tests table has subject_ids text array for multi-subject tests
ALTER TABLE tests ADD COLUMN IF NOT EXISTS subject_ids TEXT[] DEFAULT '{}'::TEXT[];

CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON questions(subject_id);
