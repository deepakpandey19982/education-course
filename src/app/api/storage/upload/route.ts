import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseAdmin } from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

const ALLOWED_FOLDERS = [
  'courses',
  'banners',
  'options',
  'features',
  'feature-grid',
  'avatars',
  'site-assets',
  'test-series',
  'subjects',
  'thumbnails',
  'series',
  'tests',
  'pdfs',
];
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/jpg',
  'image/gif',
];

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'avatars';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const isSafeFolder = /^[a-zA-Z0-9_-]+$/.test(folder);
    if (!isSafeFolder || !ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json({
        error: `Invalid storage destination "${folder}". Allowed destinations: ${ALLOWED_FOLDERS.join(', ')}`,
      }, { status: 400 });
    }

    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({
        error: `Unsupported file type "${file.type}". Allowed image types: JPEG, PNG, WebP, GIF, and SVG.`,
      }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // If uploading non-avatar assets (courses, banners, options, etc.), verify user is admin
    if (folder !== 'avatars') {
      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin privileges required to upload site and course assets' }, { status: 403 });
      }
    }

    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${folder}/${Math.random().toString(36).substring(2)}-${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from('course-pdfs')
      .upload(fileName, buffer, {
        contentType: file.type || 'image/png',
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // 10 years signed URL (315360000 seconds)
    const { data: signedData, error: signError } = await admin.storage
      .from('course-pdfs')
      .createSignedUrl(fileName, 315360000);

    if (signError || !signedData?.signedUrl) {
      console.error('Signing error:', signError);
      return NextResponse.json({ error: 'Could not generate secure access URL' }, { status: 500 });
    }

    return NextResponse.json({
      url: signedData.signedUrl,
      path: fileName,
    });
  } catch (error: any) {
    console.error('Storage route error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
