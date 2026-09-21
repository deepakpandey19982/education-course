import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/test-series-server';

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
    const admin = getSupabaseClient();

    // 1. Fetch all published series ordered by display order
    let seriesList: any[] = [];
    try {
      const { data: allSeries, error: seriesError } = await admin
        .from('test_series')
        .select('id, title, description, thumbnail_url, is_published, is_paid, order, created_at, updated_at')
        .eq('is_published', true)
        .order('order', { ascending: true });
      if (!seriesError && allSeries) {
        seriesList = allSeries;
      } else {
        // Fallback without is_paid column if not yet migrated
        const { data: fallbackSeries, error: fallbackError } = await admin
          .from('test_series')
          .select('id, title, description, thumbnail_url, is_published, order, created_at, updated_at')
          .eq('is_published', true)
          .order('order', { ascending: true });
        if (fallbackError) throw fallbackError;
        seriesList = fallbackSeries ?? [];
      }
    } catch {
      const { data: fallbackSeries, error: fallbackError } = await admin
        .from('test_series')
        .select('id, title, description, thumbnail_url, is_published, order, created_at, updated_at')
        .eq('is_published', true)
        .order('order', { ascending: true });
      if (fallbackError) throw fallbackError;
      seriesList = fallbackSeries ?? [];
    }

    if (!seriesList.length) {
      return NextResponse.json({ series: [] }, { headers: NO_CACHE_HEADERS });
    }

    const seriesIds = seriesList.map((s) => s.id);

    // 2. Fetch all enabled subjects for these series in a single batched query
    const { data: subjects } = await admin
      .from('test_series_subjects')
      .select('id, series_id')
      .in('series_id', seriesIds);

    const subjectList = subjects ?? [];
    const subjectIds = subjectList.map((s) => s.id);
    const subjectToSeriesMap = new Map<string, string>();
    for (const sub of subjectList) {
      subjectToSeriesMap.set(sub.id, sub.series_id);
    }

    // 3. Batched fetch of published tests
    const { data: tests } = subjectIds.length
      ? await admin
          .from('tests')
          .select('id, subject_id, is_paid')
          .in('subject_id', subjectIds)
          .eq('is_published', true)
      : { data: [] };

    const seriesWithPaidTests = new Set<string>();
    const seriesWithFreeTests = new Set<string>();
    for (const test of tests ?? []) {
      const sId = subjectToSeriesMap.get(test.subject_id);
      if (sId) {
        if (test.is_paid) {
          seriesWithPaidTests.add(sId);
        } else {
          seriesWithFreeTests.add(sId);
        }
      }
    }

    // Filter series according to free/paid category
    const filteredSeries = seriesList.filter((s) => {
      const explicitlyPaid = s.is_paid === true || s.title?.toLowerCase().includes('paid') || s.title?.toLowerCase().includes('premium');
      const hasPaidTests = seriesWithPaidTests.has(s.id);
      const hasFreeTests = seriesWithFreeTests.has(s.id);

      if (isPaid) {
        // Paid series: marked as paid or contains paid tests
        return explicitlyPaid || hasPaidTests;
      } else {
        // Free series: not explicitly paid (unless it has free tests), or has free tests, or newly created free series
        if (explicitlyPaid && !hasFreeTests) return false;
        return true;
      }
    });

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

