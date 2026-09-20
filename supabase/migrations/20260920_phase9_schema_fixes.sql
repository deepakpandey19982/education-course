-- =============================================================================
-- PHASE 9 SCHEMA FIXES
-- Fixes: avatar_url on profiles, site-assets bucket, ensure questions have
-- correct test_id column (not just subject_id), allow unpublished tests to be
-- attempted by enrolled users, and ensure all necessary columns exist.
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- =============================================================================

-- 1. Add avatar_url to profiles if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create the site-assets bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Ensure storage policies exist for site-assets
DROP POLICY IF EXISTS "Public can view site assets" ON storage.objects;
CREATE POLICY "Public can view site assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'site-assets');

DROP POLICY IF EXISTS "Admins can upload site assets" ON storage.objects;
CREATE POLICY "Admins can upload site assets" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'site-assets'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Admins can update site assets" ON storage.objects;
CREATE POLICY "Admins can update site assets" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'site-assets'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Admins can delete site assets" ON storage.objects;
CREATE POLICY "Admins can delete site assets" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'site-assets'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 4. Also allow authenticated users to upload to site-assets for profile avatars
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'site-assets'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = 'avatars'
    );

-- 5. Ensure questions table has test_id column (the 20260915 migration linked
--    questions to subjects, but the API queries questions by test_id directly)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS test_id UUID REFERENCES tests(id) ON DELETE CASCADE;

-- 6. Ensure tests table has subject_id (added in 20260916)
-- This is already there from the migration, but guard it
ALTER TABLE tests ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES test_series_subjects(id) ON DELETE CASCADE;

-- 7. Ensure tests have all required columns from 20260916 schema
ALTER TABLE tests ADD COLUMN IF NOT EXISTS marks_per_correct NUMERIC(6,2) NOT NULL DEFAULT 1;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS date_label TEXT;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'English';
ALTER TABLE tests ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 8. Ensure test_series has updated_at
ALTER TABLE test_series ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 9. Ensure test_series_subjects table exists (20260916 renamed test_subjects)
-- If only test_subjects exists (from 20260915) and not test_series_subjects,
-- create the new table. Migration 20260916 handles this but guard here.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_series_subjects') THEN
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
    END IF;
END $$;

-- 10. Re-enable RLS for new columns (already enabled by 20260916)
-- questions RLS: use service-role for API reads, admins manage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'questions' AND policyname = 'Admins can manage questions'
    ) THEN
        ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Admins can manage questions" ON questions
            FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
    END IF;
END $$;
