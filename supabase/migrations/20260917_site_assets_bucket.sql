-- =============================================================================
-- SITE ASSETS STORAGE BUCKET
-- Public bucket for banner/option/test-series/subject/test thumbnail images,
-- uploaded from the Admin Panel (same pattern as the existing course-pdfs
-- bucket, but public-read since these are marketing/UI images, not paid PDFs).
-- Does not touch the existing course-pdfs bucket or its policies.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

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
