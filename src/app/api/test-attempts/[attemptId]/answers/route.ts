import { NextResponse } from 'next/server';
import {
  getRequestUser,
  getSupabaseAdmin,
  isAttemptExpired,
} from '@/lib/test-series-server';

const answerStatuses = new Set([
  'not_visited',
  'visited',
  'answered',
  'marked_for_review',
  'answered_marked',
]);

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  context: { params: Promise<{ attemptId: string }> }
) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { questionId, selectedOption, status } = await request.json();
    if (typeof questionId !== 'string' || !answerStatuses.has(status)) {
      return NextResponse.json({ error: 'Invalid answer payload' }, { status: 400 });
    }
    if (selectedOption !== null && !['A', 'B', 'C', 'D'].includes(selectedOption)) {
      return NextResponse.json({ error: 'Invalid selected option' }, { status: 400 });
    }

    const { attemptId } = await context.params;
    const admin = getSupabaseAdmin();
    const { data: attempt, error: attemptError } = await admin
      .from('test_attempts')
      .select('id, test_id, started_at, duration_minutes_snapshot, status')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }
    if (attempt.status !== 'in_progress') {
      return NextResponse.json({ error: 'This attempt has already been submitted' }, { status: 409 });
    }
    if (isAttemptExpired(attempt)) {
      return NextResponse.json({ error: 'Time has expired; submit the test now' }, { status: 409 });
    }

    const { data: question, error: questionError } = await admin
      .from('questions')
      .select('id')
      .eq('id', questionId)
      .eq('test_id', attempt.test_id)
      .maybeSingle();
    if (questionError || !question) {
      return NextResponse.json({ error: 'Question does not belong to this test' }, { status: 400 });
    }

    const { data: answer, error: saveError } = await admin
      .from('test_answers')
      .upsert(
        {
          attempt_id: attemptId,
          question_id: questionId,
          selected_option: selectedOption,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'attempt_id,question_id' }
      )
      .select('*')
      .single();

    if (saveError || !answer) {
      return NextResponse.json({ error: 'Could not save answer' }, { status: 500 });
    }
    return NextResponse.json({ answer });
  } catch (error) {
    console.error('Test answer save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
