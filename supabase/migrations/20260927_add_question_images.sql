-- =============================================================================
-- ADD QUESTION IMAGES SUPPORT
-- Supports image/diagram-based MCQs (question figure and option A-D figures)
-- Safe & idempotent: uses ADD COLUMN IF NOT EXISTS and DROP NOT NULL
-- =============================================================================

ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_image_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_a_image_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_b_image_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_c_image_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_d_image_url TEXT;

-- Relax NOT NULL on option columns to allow image-only options
ALTER TABLE questions ALTER COLUMN option_a DROP NOT NULL;
ALTER TABLE questions ALTER COLUMN option_b DROP NOT NULL;
ALTER TABLE questions ALTER COLUMN option_c DROP NOT NULL;
ALTER TABLE questions ALTER COLUMN option_d DROP NOT NULL;
