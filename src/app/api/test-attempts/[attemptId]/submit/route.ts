import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseAdmin } from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ attemptId: string }> }
) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { attemptId } = await context.params;
    const admin = getSupabaseAdmin();
    const { data: attempt, error: attemptError } = await admin
      .from('test_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }
    if (attempt.status !== 'in_progress') {
      return NextResponse.json({ error: 'This attempt has already been submitted' }, { status: 409 });
    }

    const [{ data: questions, error: questionsError }, { data: answers, error: answersError }] = await Promise.all([
      admin
        .from('questions')
        .select('id, correct_option, marks, negative_marks')
        .eq('test_id', attempt.test_id),
      admin
        .from('test_answers')
        .select('id, question_id, selected_option')
        .eq('attempt_id', attemptId),
    ]);

    if (questionsError || answersError || !questions) {
      return NextResponse.json({ error: 'Could not grade this attempt' }, { status: 500 });
    }

    const answersByQuestion = new Map((answers ?? []).map((answer) => [answer.question_id, answer]));
    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    const answerUpdates = questions.flatMap((question) => {
      const answer = answersByQuestion.get(question.id);
      if (!answer?.selected_option) {
        unattemptedCount += 1;
        return [];
      }

      const isCorrect = answer.selected_option === question.correct_option;
      if (isCorrect) {
        correctCount += 1;
        score += Number(question.marks);
      } else {
        incorrectCount += 1;
        score -= Number(question.negative_marks);
      }

      return [admin
        .from('test_answers')
        .update({ is_correct: isCorrect, updated_at: new Date().toISOString() })
        .eq('id', answer.id)];
    });

    const answerUpdateResults = await Promise.all(answerUpdates);
    if (answerUpdateResults.some(({ error }) => error)) {
      return NextResponse.json({ error: 'Could not save grading results' }, { status: 500 });
    }

    const answeredCount = correctCount + incorrectCount;
    const accuracy = answeredCount === 0 ? 0 : Number(((correctCount / answeredCount) * 100).toFixed(2));
    const status = Date.now() >= new Date(attempt.started_at).getTime() + attempt.duration_minutes_snapshot * 60 * 1000
      ? 'auto_submitted'
      : 'submitted';

    const { data: submittedAttempt, error: submitError } = await admin
      .from('test_attempts')
      .update({
        submitted_at: new Date().toISOString(),
        status,
        score,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        unattempted_count: unattemptedCount,
        accuracy,
      })
      .eq('id', attemptId)
      .eq('status', 'in_progress')
      .select('*')
      .maybeSingle();

    if (submitError || !submittedAttempt) {
      return NextResponse.json({ error: 'This attempt was updated elsewhere; reload the result' }, { status: 409 });
    }

    return NextResponse.json({ attempt: submittedAttempt });
  } catch (error) {
    console.error('Test submission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
