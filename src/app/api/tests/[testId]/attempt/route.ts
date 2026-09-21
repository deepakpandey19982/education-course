import { NextResponse } from 'next/server';
import {
  getAccessibleTest,
  getRequestUser,
  getSupabaseAdmin,
  stripQuestionAnswers,
} from '@/lib/test-series-server';

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

    const { data: testMeta, error: testMetaError } = await admin
      .from('tests')
      .select('id, title, subject_id, marks_per_correct, negative_marks')
      .eq('id', testId)
      .maybeSingle();

    if (testMetaError || !testMeta) {
      return NextResponse.json({ error: 'Could not load this test configuration' }, { status: 500 });
    }

    const { data: subjectMeta, error: subjectMetaError } = await admin
      .from('test_series_subjects')
      .select('id, name, series_id')
      .eq('id', testMeta.subject_id)
      .maybeSingle();

    if (subjectMetaError) {
      return NextResponse.json({ error: 'Could not load the subject configuration' }, { status: 500 });
    }

    const { data: seriesSubjects, error: seriesSubjectsError } = subjectMeta?.series_id
      ? await admin
          .from('test_series_subjects')
          .select('id, name, order')
          .eq('series_id', subjectMeta.series_id)
          .eq('is_enabled', true)
          .order('order', { ascending: true })
      : { data: [], error: null };

    if (seriesSubjectsError) {
      return NextResponse.json({ error: 'Could not load the test subject list' }, { status: 500 });
    }

    const resolvedSubjectId = subjectMeta?.id || testMeta.subject_id || null;
    const uniqueSubjectIds = new Set<string>();

    const mappedQuestions = (questions ?? []).map((q: any) => {
      let subjId = q.subject_id;
      if (!subjId && typeof q.explanation === 'string') {
        const match = q.explanation.match(/<!--subj:([a-f0-9-]+)-->/i);
        if (match) subjId = match[1];
      }
      subjId = subjId || resolvedSubjectId;
      if (subjId) uniqueSubjectIds.add(subjId);

      return {
        ...stripQuestionAnswers(q),
        subject_id: subjId,
      };
    });

    if (resolvedSubjectId) uniqueSubjectIds.add(resolvedSubjectId);

    const subjectList = (seriesSubjects ?? []).filter((subject) => uniqueSubjectIds.has(subject.id));
    const fallbackSubjects = subjectList.length > 0 ? subjectList : (seriesSubjects ?? []).filter((subject) => subject.id === subjectMeta?.id || subject.id === testMeta.subject_id);

    return NextResponse.json({
      attempt,
      test: {
        id: test.id,
        title: test.title,
        subject_name: subjectMeta?.name ?? 'Subject',
        subjects: (fallbackSubjects.length > 0 ? fallbackSubjects : (seriesSubjects ?? []).map((subject) => ({ id: subject.id, name: subject.name }))).map((subject) => ({ id: subject.id, name: subject.name })),
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
