import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await context.params;
    const type = new URL(request.url).searchParams.get('type') === 'paid' ? 'paid' : 'free';
    const admin = getSupabaseClient();

    let series: any = null;
    try {
      const { data, error: seriesError } = await admin
        .from('test_series')
        .select('id, title, description, thumbnail_url, is_published, is_paid, order, created_at, updated_at')
        .eq('id', seriesId)
        .eq('is_published', true)
        .maybeSingle();
      if (!seriesError && data) {
        series = data;
      } else {
        const { data: fallback, error: fbErr } = await admin
          .from('test_series')
          .select('id, title, description, thumbnail_url, is_published, order, created_at, updated_at')
          .eq('id', seriesId)
          .eq('is_published', true)
          .maybeSingle();
        if (fbErr || !fallback) return NextResponse.json({ error: 'Test series not found' }, { status: 404 });
        series = fallback;
      }
    } catch {
      const { data: fallback, error: fbErr } = await admin
        .from('test_series')
        .select('id, title, description, thumbnail_url, is_published, order, created_at, updated_at')
        .eq('id', seriesId)
        .eq('is_published', true)
        .maybeSingle();
      if (fbErr || !fallback) return NextResponse.json({ error: 'Test series not found' }, { status: 404 });
      series = fallback;
    }

    const { data: subjects, error: subjectsError } = await admin
      .from('test_series_subjects')
      .select('id, series_id, name, icon_url, order, is_enabled, created_at, updated_at')
      .eq('series_id', seriesId)
      .eq('is_enabled', true)
      .order('order', { ascending: true });
    if (subjectsError) throw subjectsError;

    const subjectList = subjects ?? [];
    const subjectIds = subjectList.map((subject: any) => subject.id);

    // Fetch tests matching this series' subjects or direct series_id
    let tests: any[] = [];
    if (subjectIds.length > 0) {
      try {
        const { data: fullTests, error: ftError } = await admin
          .from('tests')
          .select('id, series_id, subject_id, subject_ids, title, date_label, thumbnail_url, duration_minutes, max_marks, language, instructions, is_paid, price, is_published, scheduled_start, scheduled_end, order')
          .in('subject_id', subjectIds)
          .eq('is_published', true)
          .eq('is_paid', type === 'paid')
          .order('order', { ascending: true });
        if (!ftError && fullTests) {
          tests = fullTests;
        } else {
          const { data: fbTests } = await admin
            .from('tests')
            .select('id, subject_id, title, date_label, thumbnail_url, duration_minutes, max_marks, language, instructions, is_paid, price, is_published, scheduled_start, scheduled_end, order')
            .in('subject_id', subjectIds)
            .eq('is_published', true)
            .eq('is_paid', type === 'paid')
            .order('order', { ascending: true });
          tests = fbTests ?? [];
        }
      } catch {
        const { data: fbTests } = await admin
          .from('tests')
          .select('id, subject_id, title, date_label, thumbnail_url, duration_minutes, max_marks, language, instructions, is_paid, price, is_published, scheduled_start, scheduled_end, order')
          .in('subject_id', subjectIds)
          .eq('is_published', true)
          .eq('is_paid', type === 'paid')
          .order('order', { ascending: true });
        tests = fbTests ?? [];
      }
    }

    try {
      const { data: directTests } = await admin
        .from('tests')
        .select('id, series_id, subject_id, subject_ids, title, date_label, thumbnail_url, duration_minutes, max_marks, language, instructions, is_paid, price, is_published, scheduled_start, scheduled_end, order')
        .eq('series_id', seriesId)
        .eq('is_published', true)
        .eq('is_paid', type === 'paid')
        .order('order', { ascending: true });
      if (directTests && directTests.length > 0) {
        const existingIds = new Set(tests.map((t) => t.id));
        directTests.forEach((t) => {
          if (!existingIds.has(t.id)) tests.push(t);
        });
      }
    } catch {
      // Safe fallback if series_id column not present in DB cache
    }

    const testIds = tests.map((test: any) => test.id);
    const { data: questionRows } = testIds.length
      ? await admin.from('questions').select('test_id').in('test_id', testIds)
      : { data: [] };

    const questionCounts = new Map<string, number>();
    (questionRows ?? []).forEach(({ test_id }: { test_id: string }) => {
      questionCounts.set(test_id, (questionCounts.get(test_id) ?? 0) + 1);
    });

    const { resolveTestSubjectIds, decodeTestSubjectsTag } = await import('@/app/admin/test-series/_components/testSeriesHelpers');
    const enrichedTests = tests.map((test: any) => {
      const configuredSubjectIds = resolveTestSubjectIds(test);
      const testSubjects = subjectList
        .filter((sub: any) => configuredSubjectIds.includes(sub.id))
        .map((sub: any) => ({ id: sub.id, name: sub.name }));

      const decoded = decodeTestSubjectsTag(test.instructions);

      return {
        ...test,
        instructions: decoded.cleanInstructions,
        question_count: questionCounts.get(test.id) ?? 0,
        subjects: testSubjects.length > 0 ? testSubjects : [{ id: test.subject_id, name: 'Subject' }],
      };
    });

    const NO_CACHE_HEADERS = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    };

    return NextResponse.json({
      series,
      tests: enrichedTests,
      subjects: subjectList.map((subject: any) => {
        const matchingTests = enrichedTests.filter((test: any) => {
          return test.subjects.some((s: any) => s.id === subject.id) || test.subject_id === subject.id;
        });

        return {
          ...subject,
          tests: matchingTests,
        };
      }),
    }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Test series detail error:', error);
    return NextResponse.json(
      { error: 'Could not load this test series' },
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
