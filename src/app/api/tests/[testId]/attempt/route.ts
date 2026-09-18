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
    const admin = getSupabaseAdmin();
    const { test, error: accessError } = await getAccessibleTest(admin, user.id, testId);
    if (!test) {
      return NextResponse.json({ error: accessError }, { status: 403 });
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
        .select('id, test_id, subject_id, question_text, option_a, option_b, option_c, option_d, marks, negative_marks, language, order, created_at, updated_at')
        .eq('test_id', testId)
        .order('order', { ascending: true }),
      admin
        .from('test_answers')
        .select('question_id, selected_option, status')
        .eq('attempt_id', attempt.id),
    ]);

    if (questionsError || answersError) {
      return NextResponse.json({ error: 'Could not load test questions' }, { status: 500 });
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

    const uniqueSubjectIds = new Set<string>();
    (questions ?? []).forEach((question) => {
      if (question.subject_id) uniqueSubjectIds.add(question.subject_id);
    });
    if (subjectMeta?.id) uniqueSubjectIds.add(subjectMeta.id);

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
      questions: (questions ?? []).map(stripQuestionAnswers),
      answers: answers ?? [],
    });
  } catch (error) {
    console.error('Test attempt start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
