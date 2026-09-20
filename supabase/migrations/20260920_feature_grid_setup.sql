-- =============================================================================
-- Migration: 20260920_feature_grid_setup.sql
-- Description: Sets up the home_options table and security policies for Feature Grid
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.home_options (
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

-- Ensure RLS is active
ALTER TABLE public.home_options ENABLE ROW LEVEL SECURITY;

-- Allow public users (including anonymous visitors) to read enabled items
DROP POLICY IF EXISTS "Public can view enabled home options" ON public.home_options;
CREATE POLICY "Public can view enabled home options" 
ON public.home_options FOR SELECT 
USING (is_enabled = true);

-- Allow admins full access (read, insert, update, delete)
DROP POLICY IF EXISTS "Admins can manage home options" ON public.home_options;
CREATE POLICY "Admins can manage home options" 
ON public.home_options FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);
