import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseAdmin } from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

async function handleCourseDownload(req: Request, courseId: string | null) {
  try {
    if (!courseId) {
      return NextResponse.json({ error: 'Missing courseId parameter' }, { status: 400 });
    }

    // 1. Identify user via Bearer token, query token, or cookies
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 2. Fetch course details to verify existence and pricing
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, title, price, is_published')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // 3. Determine if user is an admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';
    const isFreeCourse = (course.price ?? 0) === 0;

    // 4. Access Security Check:
    // - Free courses are accessible to any authenticated user.
    // - Paid courses require an order with status = 'paid' (or admin role).
    if (!isFreeCourse && !isAdmin) {
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .eq('status', 'paid')
        .maybeSingle();

      if (orderError || !order) {
        return NextResponse.json({
          error: 'Unauthorized: You must purchase the course before downloading.'
        }, { status: 403 });
      }
    }

    // 5. Fetch private file path from course_files table
    const { data: fileData, error: fileError } = await supabaseAdmin
      .from('course_files')
      .select('file_path, file_name')
      .eq('course_id', courseId)
      .maybeSingle();

    if (fileError || !fileData || !fileData.file_path) {
      return NextResponse.json({ error: 'Course file not found in storage' }, { status: 404 });
    }

    // 6. Generate a Secure Signed URL (Expires in 15 minutes = 900 seconds)
    const { data: signedData, error: signedError } = await supabaseAdmin
      .storage
      .from('course-pdfs')
      .createSignedUrl(fileData.file_path, 900);

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json({ error: 'Could not generate secure download link' }, { status: 500 });
    }

    // 7. Check if client wants JSON or direct redirect
    const acceptHeader = req.headers.get('accept') || '';
    const url = new URL(req.url);
    const wantsJson = acceptHeader.includes('application/json') || url.searchParams.get('format') === 'json';

    if (wantsJson) {
      return NextResponse.json({
        success: true,
        downloadUrl: signedData.signedUrl,
        fileName: fileData.file_name,
      });
    }

    // Direct browser navigation gets a 302 redirect to the secure signed URL
    return NextResponse.redirect(signedData.signedUrl, 302);

  } catch (error: any) {
    console.error('Download Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get('courseId');
  return handleCourseDownload(req, courseId);
}

export async function POST(req: Request) {
  let courseId: string | null = null;
  try {
    const body = await req.json();
    courseId = body.courseId;
  } catch {
    const { searchParams } = new URL(req.url);
    courseId = searchParams.get('courseId');
  }
  return handleCourseDownload(req, courseId);
}
