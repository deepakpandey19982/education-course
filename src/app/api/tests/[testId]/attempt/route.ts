import { NextResponse } from 'next/server';
import {
  getAccessibleTest,
  getRequestUser,
  getSupabaseAdmin,
  stripQuestionAnswers,
} from '@/lib/test-series-server';
import { resolveTestSubjectIds } from '@/app/admin/test-series/_components/testSeriesHelpers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ testId: string }> }
) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { testId } = await context.params;
    let admin;
    try {
      admin = getSupabaseAdmin();
    } catch (envErr: any) {
      console.error('Test attempt Supabase admin initialization error:', envErr);
      return NextResponse.json(
        {
          error:
            'SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel Environment Variables. Please add SUPABASE_SERVICE_ROLE_KEY in your Vercel project settings to enable server-side question loading.',
        },
        { status: 500 }
      );
    }

    const { test, error: accessError } = await getAccessibleTest(admin, user.id, testId);
    if (!test) {
      return NextResponse.json({ error: accessError || 'Access denied' }, { status: 403 });
    }

    const { data: existingAttempt, error: attemptLookupError } = await admin
      .from('test_attempts')
      .select('*')
      .eq('user_id', user.id)
      .eq('test_id', testId)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (attemptLookupError) {
      return NextResponse.json({ error: 'Could not load the test attempt' }, { status: 500 });
    }
    let attempt = existingAttempt;

    if (!attempt) {
      const { data: createdAttempt, error: createError } = await admin
        .from('test_attempts')
        .insert({
          user_id: user.id,
          test_id: testId,
          duration_minutes_snapshot: test.duration_minutes,
        })
        .select('*')
        .single();

      if (createError || !createdAttempt) {
        // A concurrent request can win the partial unique index race. Re-read once.
        const { data: concurrentAttempt } = await admin
          .from('test_attempts')
          .select('*')
          .eq('user_id', user.id)
          .eq('test_id', testId)
          .eq('status', 'in_progress')
          .maybeSingle();

        if (!concurrentAttempt) {
          return NextResponse.json({ error: 'Could not start the test attempt' }, { status: 500 });
        }
        attempt = concurrentAttempt;
      } else {
        attempt = createdAttempt;
      }
    }

    const [{ data: questions, error: questionsError }, { data: answers, error: answersError }] = await Promise.all([
      admin
        .from('questions')
        .select('*')
        .eq('test_id', testId)
        .order('order', { ascending: true }),
      admin
        .from('test_answers')
        .select('question_id, selected_option, status')
        .eq('attempt_id', attempt.id),
    ]);

    if (questionsError || answersError) {
      console.error('Questions load error:', questionsError, '| Answers load error:', answersError);
      const detail = questionsError?.message || answersError?.message || 'unknown error';
      return NextResponse.json({ error: `Could not load test questions: ${detail}` }, { status: 500 });
    }

    let testMeta: any = null;
    const { data: fullTestMeta, error: fullTestMetaError } = await admin
      .from('tests')
      .select('id, title, subject_id, instructions, marks_per_correct, negative_marks')
      .eq('id', testId)
      .maybeSingle();

    if (!fullTestMetaError && fullTestMeta) {
      testMeta = fullTestMeta;
    } else {
      const { data: fbTestMeta, error: fbError } = await admin
        .from('tests')
        .select('id, title, subject_id, marks_per_correct, negative_marks')
        .eq('id', testId)
        .maybeSingle();
      if (fbError || !fbTestMeta) {
        return NextResponse.json({ error: 'Could not load this test configuration' }, { status: 500 });
      }
      testMeta = fbTestMeta;
    }

    // Try reading subject_ids column if available
    try {
      const { data: sidsData } = await admin
        .from('tests')
        .select('subject_ids')
        .eq('id', testId)
        .maybeSingle();
      if (sidsData?.subject_ids && Array.isArray(sidsData.subject_ids)) {
        testMeta.subject_ids = sidsData.subject_ids;
      }
    } catch {
      // Ignore if subject_ids column doesn't exist
    }

    const configuredSubjectIds = resolveTestSubjectIds(testMeta);
    if (!configuredSubjectIds.length && testMeta.subject_id) {
      configuredSubjectIds.push(testMeta.subject_id);
    }

    // Load EXACTLY the subjects configured for this test
    const { data: testSubjectsData, error: testSubjectsError } = configuredSubjectIds.length > 0
      ? await admin
          .from('test_series_subjects')
          .select('id, name, order')
          .in('id', configuredSubjectIds)
          .eq('is_enabled', true)
          .order('order', { ascending: true })
      : { data: [], error: null };

    if (testSubjectsError) {
      return NextResponse.json({ error: 'Could not load the test subject list' }, { status: 500 });
    }

    // Preserve the order defined in configuredSubjectIds
    const subjectMap = new Map((testSubjectsData ?? []).map((s: any) => [s.id, s]));
    const orderedSubjects: Array<{ id: string; name: string }> = [];
    for (const sid of configuredSubjectIds) {
      const s = subjectMap.get(sid);
      if (s && !orderedSubjects.some((os) => os.id === s.id)) {
        orderedSubjects.push({ id: s.id, name: s.name });
      }
    }
    for (const s of (testSubjectsData ?? [])) {
      if (!orderedSubjects.some((os) => os.id === s.id)) {
        orderedSubjects.push({ id: s.id, name: s.name });
      }
    }

    if (!orderedSubjects.length) {
      orderedSubjects.push({ id: testMeta.subject_id || 'default-subject', name: 'General' });
    }

    const mappedQuestions = (questions ?? []).map((q: any) => {
      let subjId = q.subject_id;
      if (!subjId && typeof q.explanation === 'string') {
        const match = q.explanation.match(/<!--subj:([a-f0-9-]+)-->/i);
        if (match) subjId = match[1];
      }
      subjId = subjId || testMeta.subject_id || orderedSubjects[0]?.id || null;

      return {
        ...stripQuestionAnswers(q),
        subject_id: subjId,
      };
    });

    return NextResponse.json({
      attempt,
      test: {
        id: test.id,
        title: test.title,
        subject_name: orderedSubjects[0]?.name ?? 'Subject',
        subjects: orderedSubjects,
        marks_per_correct: Number(testMeta.marks_per_correct ?? 1),
        negative_marks: Number(testMeta.negative_marks ?? 0),
      },
      questions: mappedQuestions,
      answers: answers ?? [],
    });
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Test attempt start error:', errorMsg);
    return NextResponse.json(
      { error: `Unable to start test: ${errorMsg}` },
      { status: 500 }
    );
  }
}
