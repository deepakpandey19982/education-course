import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await context.params;
    const admin = getSupabaseAdmin();
    const { data: test, error: testError } = await admin
      .from('tests')
      .select('id, subject_id, title, date_label, thumbnail_url, duration_minutes, max_marks, language, instructions, is_paid, price, is_published, scheduled_start, scheduled_end, order')
      .eq('id', testId)
      .eq('is_published', true)
      .maybeSingle();
    if (testError || !test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    const { count, error: countError } = await admin
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', testId);
    if (countError) throw countError;

    const NO_CACHE_HEADERS = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    };

    return NextResponse.json({ test: { ...test, question_count: count ?? 0 } }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Test detail error:', error);
    return NextResponse.json(
      { error: 'Could not load this test' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  }
}
