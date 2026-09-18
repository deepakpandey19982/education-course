import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const type = new URL(request.url).searchParams.get('type') === 'paid' ? 'paid' : 'free';
    const admin = getSupabaseAdmin();

    const { data: allSeries, error: seriesError } = await admin
      .from('test_series')
      .select('id, title, description, thumbnail_url, is_published, order, created_at, updated_at')
      .eq('is_published', true)
      .order('order', { ascending: true });

    if (seriesError) throw seriesError;

    const filteredSeries: Array<Record<string, unknown>> = [];

    for (const series of allSeries ?? []) {
      const { data: subjects, error: subjectsError } = await admin
        .from('test_series_subjects')
        .select('id')
        .eq('series_id', series.id)
        .eq('is_enabled', true);

      if (subjectsError) throw subjectsError;

      const subjectIds = (subjects ?? []).map((subject) => subject.id);
      const { data: tests, error: testsError } = subjectIds.length
        ? await admin
            .from('tests')
            .select('id')
            .in('subject_id', subjectIds)
            .eq('is_published', true)
            .eq('is_paid', type === 'paid')
        : { data: [], error: null };

      if (testsError) throw testsError;

      if ((tests ?? []).length) {
        filteredSeries.push({ ...series });
      }
    }

    return NextResponse.json({ series: filteredSeries });
  } catch (error) {
    console.error('Test series list error:', error);
    return NextResponse.json({ error: 'Could not load test series' }, { status: 500 });
  }
}
