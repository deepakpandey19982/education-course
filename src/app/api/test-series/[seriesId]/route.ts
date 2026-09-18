import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await context.params;
    const type = new URL(request.url).searchParams.get('type') === 'paid' ? 'paid' : 'free';
    const admin = getSupabaseAdmin();
    const { data: series, error: seriesError } = await admin
      .from('test_series')
      .select('id, title, description, thumbnail_url, is_published, order, created_at, updated_at')
      .eq('id', seriesId)
      .eq('is_published', true)
      .maybeSingle();

    if (seriesError || !series) {
      return NextResponse.json({ error: 'Test series not found' }, { status: 404 });
    }

    const { data: subjects, error: subjectsError } = await admin
      .from('test_series_subjects')
      .select('id, series_id, name, icon_url, order, is_enabled, created_at, updated_at')
      .eq('series_id', seriesId)
      .eq('is_enabled', true)
      .order('order', { ascending: true });
    if (subjectsError) throw subjectsError;

    const subjectIds = (subjects ?? []).map((subject) => subject.id);
    const { data: tests, error: testsError } = subjectIds.length
      ? await admin
        .from('tests')
        .select('id, subject_id, title, date_label, thumbnail_url, duration_minutes, max_marks, language, instructions, is_paid, price, is_published, scheduled_start, scheduled_end, order')
        .in('subject_id', subjectIds)
        .eq('is_published', true)
        .eq('is_paid', type === 'paid')
        .order('order', { ascending: true })
      : { data: [], error: null };
    if (testsError) throw testsError;

    const testIds = (tests ?? []).map((test) => test.id);
    const { data: questionRows, error: questionsError } = testIds.length
      ? await admin.from('questions').select('test_id').in('test_id', testIds)
      : { data: [], error: null };
    if (questionsError) throw questionsError;

    const questionCounts = new Map<string, number>();
    (questionRows ?? []).forEach(({ test_id }) => {
      questionCounts.set(test_id, (questionCounts.get(test_id) ?? 0) + 1);
    });

    return NextResponse.json({
      series,
      subjects: (subjects ?? []).map((subject) => ({
        ...subject,
        tests: (tests ?? [])
          .filter((test) => test.subject_id === subject.id)
          .map((test) => ({ ...test, question_count: questionCounts.get(test.id) ?? 0 })),
      })),
    });
  } catch (error) {
    console.error('Test series detail error:', error);
    return NextResponse.json({ error: 'Could not load this test series' }, { status: 500 });
  }
}
