-- =============================================================================
-- Migration: 20260920_course_downloads.sql
-- Description: Creates course_downloads table for tracking verified PDF downloads
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.course_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    course_file_id UUID REFERENCES public.course_files(id) ON DELETE SET NULL,
    access_type TEXT NOT NULL CHECK (access_type IN ('FREE', 'PAID')),
    file_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.course_downloads ENABLE ROW LEVEL SECURITY;

-- Admins can view all download records
DROP POLICY IF EXISTS "Admins can view all course downloads" ON public.course_downloads;
CREATE POLICY "Admins can view all course downloads"
ON public.course_downloads FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Users can view their own downloads
DROP POLICY IF EXISTS "Users can view own course downloads" ON public.course_downloads;
CREATE POLICY "Users can view own course downloads"
ON public.course_downloads FOR SELECT
USING (auth.uid() = user_id);

-- Service role and authenticated APIs can insert download records
DROP POLICY IF EXISTS "Allow insert on course downloads" ON public.course_downloads;
CREATE POLICY "Allow insert on course downloads"
ON public.course_downloads FOR INSERT
WITH CHECK (true);
