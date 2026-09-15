import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
    }

    // 1. Securely identify the user via cookies using @supabase/ssr
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = user.id;

    // Initialize Admin Client inside the handler to avoid build-time env errors
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Security Check: Verify that the authenticated user has actually paid for this course
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, status')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('status', 'paid')
      .single();

    if (orderError || !order) {
      return NextResponse.json({
        error: 'Unauthorized: You must purchase the course before downloading.'
      }, { status: 403 });
    }

    // 3. Fetch the private file path from course_files table
    const { data: fileData, error: fileError } = await supabaseAdmin
      .from('course_files')
      .select('file_path')
      .eq('course_id', courseId)
      .single();

    if (fileError || !fileData) {
      return NextResponse.json({ error: 'Course file not found in storage' }, { status: 404 });
    }

    // 4. Generate a Signed URL (Expires in 15 minutes)
    const { data: signedData, error: signedError } = await supabaseAdmin
      .storage
      .from('course-pdfs')
      .createSignedUrl(fileData.file_path, 900);

    if (signedError || !signedData) {
      return NextResponse.json({ error: 'Could not generate secure link' }, { status: 500 });
    }

    // 5. Redirect the user to the secure temporary URL
    return NextResponse.redirect(signedData.signedUrl, 302);

  } catch (error: any) {
    console.error('Download Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
