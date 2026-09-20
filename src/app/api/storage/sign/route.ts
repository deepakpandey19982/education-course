import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { urlOrPath } = await request.json();
    if (!urlOrPath || typeof urlOrPath !== 'string') {
      return NextResponse.json({ error: 'urlOrPath is required' }, { status: 400 });
    }

    // If it's already a valid signed URL or external URL, return as-is
    if (urlOrPath.includes('token=') || urlOrPath.startsWith('data:')) {
      return NextResponse.json({ url: urlOrPath });
    }

    // Extract storage relative path if it's a supabase URL
    let path = urlOrPath;
    const publicPattern = /\/storage\/v1\/object\/public\/course-pdfs\/(.+)$/;
    const signPattern = /\/storage\/v1\/object\/sign\/course-pdfs\/([^?]+)/;
    
    const publicMatch = urlOrPath.match(publicPattern);
    if (publicMatch) {
      path = decodeURIComponent(publicMatch[1]);
    } else {
      const signMatch = urlOrPath.match(signPattern);
      if (signMatch) {
        path = decodeURIComponent(signMatch[1]);
      }
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage
      .from('course-pdfs')
      .createSignedUrl(path, 315360000);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Could not sign storage URL' }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
