import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET(request: Request) {
  try {
    const type = new URL(request.url).searchParams.get('type') === 'paid' ? 'paid' : 'free';
    const isPaid = type === 'paid';
    const admin = getSupabaseAdmin();

    // 1. Fetch all published series ordered by display order
    const { data: allSeries, error: seriesError } = await admin
      .from('test_series')
      .select('id, title, description, thumbnail_url, is_published, order, created_at, updated_at')
      .eq('is_published', true)
      .order('order', { ascending: true });

    if (seriesError) throw seriesError;

    const seriesList = allSeries ?? [];
    if (!seriesList.length) {
      return NextResponse.json({ series: [] }, { headers: NO_CACHE_HEADERS });
    }

    const seriesIds = seriesList.map((s) => s.id);

    // 2. Fetch all enabled subjects for these series in a single batched query
    const { data: subjects, error: subjectsError } = await admin
      .from('test_series_subjects')
      .select('id, series_id')
      .in('series_id', seriesIds)
      .eq('is_enabled', true);

    if (subjectsError) throw subjectsError;

    const subjectList = subjects ?? [];
    if (!subjectList.length) {
      return NextResponse.json({ series: [] }, { headers: NO_CACHE_HEADERS });
    }

    const subjectIds = subjectList.map((s) => s.id);
    const subjectToSeriesMap = new Map<string, string>();
    for (const sub of subjectList) {
      subjectToSeriesMap.set(sub.id, sub.series_id);
    }

    // 3. Batched fetch of published tests matching the free/paid filter
    const { data: tests, error: testsError } = await admin
      .from('tests')
      .select('id, subject_id')
      .in('subject_id', subjectIds)
      .eq('is_published', true)
      .eq('is_paid', isPaid);

    if (testsError) throw testsError;

    // Identify series IDs that have at least one published test of this type
    const activeSeriesIds = new Set<string>();
    for (const test of tests ?? []) {
      const sId = subjectToSeriesMap.get(test.subject_id);
      if (sId) activeSeriesIds.add(sId);
    }

    const filteredSeries = seriesList.filter((s) => activeSeriesIds.has(s.id));

    return NextResponse.json(
      { series: filteredSeries },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Test series list error:', error);
    return NextResponse.json(
      { error: 'Could not load test series' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

