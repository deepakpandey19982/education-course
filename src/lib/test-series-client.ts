import { supabase } from '@/lib/supabase';
import { TestSeries } from '@/types/supabase';
import { getApiUrl } from '@/lib/api-config';

export async function testSeriesFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  return fetch(getApiUrl(path), {
    credentials: 'include',
    ...init,
    headers,
  });
}

export type TestCard = {
  id: string;
  title: string;
  date_label: string | null;
  duration_minutes: number;
  max_marks: number;
  language: string;
  is_paid: boolean;
  price: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  question_count: number;
  subjects?: Array<{ id: string; name: string }>;
};

export type SubjectWithTests = {
  id: string;
  name: string;
  icon_url: string | null;
  tests: TestCard[];
};

export type SeriesDetailData = {
  series: {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
  };
  subjects: SubjectWithTests[];
  tests?: TestCard[];
};

/**
 * Robustly fetches published test series for both mobile and desktop.
 * Uses cache: 'no-store' and dynamic timestamp query parameter to defeat mobile WebView caching.
 * Falls back to direct Supabase client query if the local API route is unreachable or errors.
 */
export async function fetchPublishedTestSeries(type: 'free' | 'paid'): Promise<TestSeries[]> {
  const isPaid = type === 'paid';

  // 1. Try Next.js API route with anti-cache directives
  try {
    const res = await fetch(getApiUrl(`/api/test-series?type=${type}&_t=${Date.now()}`), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (res.ok) {
      const payload = await res.json();
      if (Array.isArray(payload.series) && payload.series.length > 0) {
        return payload.series;
      }
    }
  } catch (apiErr) {
    console.warn('[test-series-client] API fetch error, falling back to direct Supabase:', apiErr);
  }

  // 2. Resilient Direct Supabase Fallback (Guarantees demo is always visible on mobile/Capacitor)
  try {
    const client = supabase;
    const { data: allSeries, error: sErr } = await client
      .from('test_series')
      .select('id, title, description, thumbnail_url, is_published, order, created_at, updated_at')
      .eq('is_published', true)
      .order('order', { ascending: true });

    if (sErr || !allSeries?.length) {
      return (allSeries as TestSeries[]) ?? [];
    }

    const seriesIds = allSeries.map((s) => s.id);
    const { data: subjects, error: subErr } = await client
      .from('test_series_subjects')
      .select('id, series_id')
      .in('series_id', seriesIds)
      .eq('is_enabled', true);

    if (subErr || !subjects?.length) {
      return [];
    }

    const subjectIds = subjects.map((s) => s.id);
    const subjectToSeriesMap = new Map<string, string>();
    for (const sub of subjects) {
      subjectToSeriesMap.set(sub.id, sub.series_id);
    }

    const { data: tests } = subjectIds.length
      ? await client
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

    return (allSeries as TestSeries[]).filter((s: any) => {
      const explicitlyPaid = s.is_paid === true || s.title?.toLowerCase().includes('paid') || s.title?.toLowerCase().includes('premium');
      const hasPaidTests = seriesWithPaidTests.has(s.id);
      const hasFreeTests = seriesWithFreeTests.has(s.id);

      if (isPaid) {
        return explicitlyPaid || hasPaidTests;
      } else {
        if (explicitlyPaid && !hasFreeTests) return false;
        return true;
      }
    });
  } catch (directErr) {
    console.error('[test-series-client] Supabase fallback error:', directErr);
    return [];
  }
}

/**
 * Fetches series detail and its published subjects/tests with resilient mobile fallback.
 */
export async function fetchSeriesDetail(
  seriesId: string,
  type: 'free' | 'paid'
): Promise<SeriesDetailData> {
  const isPaid = type === 'paid';

  // 1. Try API route
  try {
    const res = await fetch(getApiUrl(`/api/test-series/${seriesId}?type=${type}&_t=${Date.now()}`), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (res.ok) {
      const payload = await res.json();
      if (payload.series && Array.isArray(payload.subjects)) {
        return payload;
      }
    }
  } catch (apiErr) {
    console.warn('[test-series-client] Detail API error, using Supabase fallback:', apiErr);
  }

  // 2. Direct Supabase Fallback
  const client = supabase;
  const { data: series, error: sErr } = await client
    .from('test_series')
    .select('id, title, description, thumbnail_url')
    .eq('id', seriesId)
    .eq('is_published', true)
    .single();

  if (sErr || !series) {
    throw new Error('Test series not found or unavailable');
  }

  const { data: subjects } = await client
    .from('test_series_subjects')
    .select('id, series_id, name, icon_url, order, is_enabled')
    .eq('series_id', seriesId)
    .eq('is_enabled', true)
    .order('order', { ascending: true });

  const subjectList = subjects ?? [];
  const subjectIds = subjectList.map((s) => s.id);

  const { data: tests } = subjectIds.length
    ? await client
        .from('tests')
        .select('id, subject_id, title, date_label, duration_minutes, max_marks, language, is_paid, price, is_published, scheduled_start, scheduled_end, order')
        .in('subject_id', subjectIds)
        .eq('is_published', true)
        .eq('is_paid', isPaid)
        .order('order', { ascending: true })
    : { data: [] };

  const testList = tests ?? [];
  const testIds = testList.map((t) => t.id);

  const { data: questionRows } = testIds.length
    ? await client.from('questions').select('test_id').in('test_id', testIds)
    : { data: [] };

  const questionCounts = new Map<string, number>();
  (questionRows ?? []).forEach(({ test_id }) => {
    questionCounts.set(test_id, (questionCounts.get(test_id) ?? 0) + 1);
  });

    return {
      series,
      subjects: subjectList.map((sub) => {
        const matchingTests = testList.filter((t: any) => {
          if (t.subject_id === sub.id) return true;
          if (Array.isArray(t.subject_ids) && t.subject_ids.includes(sub.id)) return true;
          return false;
        });

        return {
          id: sub.id,
          name: sub.name,
          icon_url: sub.icon_url,
          tests: matchingTests.map((t) => ({
            id: t.id,
            title: t.title,
            date_label: t.date_label,
            duration_minutes: t.duration_minutes,
            max_marks: t.max_marks,
            language: t.language,
            is_paid: t.is_paid,
            price: t.price,
            scheduled_start: t.scheduled_start,
            scheduled_end: t.scheduled_end,
            question_count: questionCounts.get(t.id) ?? 0,
          })),
        };
      }),
    };
}
