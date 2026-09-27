import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseAdmin } from '@/lib/test-series-server';
import { decodeSubjectTag } from '@/app/admin/test-series/_components/testSeriesHelpers';

export const dynamic = 'force-dynamic';

export async function GET(
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
    if (attempt.status === 'in_progress') {
      return NextResponse.json({ error: 'Submit the test before viewing solutions' }, { status: 409 });
    }

    let questionsRes: any = await admin
      .from('questions')
      .select('id, question_text, question_image_url, option_a, option_b, option_c, option_d, option_a_image_url, option_b_image_url, option_c_image_url, option_d_image_url, correct_option, explanation, marks, negative_marks, language, order')
      .eq('test_id', attempt.test_id)
      .order('order', { ascending: true });

    if (questionsRes.error && questionsRes.error.message?.includes('image_url')) {
      // Fallback if image_url columns not added yet
      questionsRes = await admin
        .from('questions')
        .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, negative_marks, language, order')
        .eq('test_id', attempt.test_id)
        .order('order', { ascending: true });
    }

    const { data: questions, error: questionsError } = questionsRes;

    const { data: answers, error: answersError } = await admin
      .from('test_answers')
      .select('question_id, selected_option, status, is_correct')
      .eq('attempt_id', attemptId);

    if (questionsError || answersError || !questions) {
      return NextResponse.json({ error: 'Could not load results' }, { status: 500 });
    }

    const answersByQuestion = new Map((answers ?? []).map((answer) => [answer.question_id, answer]));
    const analysis = (questions as any[]).map((question: any) => {
      let qImg = question.question_image_url || null;
      let optAImg = question.option_a_image_url || null;
      let optBImg = question.option_b_image_url || null;
      let optCImg = question.option_c_image_url || null;
      let optDImg = question.option_d_image_url || null;
      let cleanExplanation = question.explanation;

      if (typeof question.explanation === 'string') {
        const decoded = decodeSubjectTag(question.explanation);
        cleanExplanation = decoded.cleanExplanation;
        if (!qImg && decoded.questionImageUrl) qImg = decoded.questionImageUrl;
        if (!optAImg && decoded.optionAImageUrl) optAImg = decoded.optionAImageUrl;
        if (!optBImg && decoded.optionBImageUrl) optBImg = decoded.optionBImageUrl;
        if (!optCImg && decoded.optionCImageUrl) optCImg = decoded.optionCImageUrl;
        if (!optDImg && decoded.optionDImageUrl) optDImg = decoded.optionDImageUrl;
      }

      return {
        ...question,
        question_image_url: qImg,
        option_a_image_url: optAImg,
        option_b_image_url: optBImg,
        option_c_image_url: optCImg,
        option_d_image_url: optDImg,
        explanation: cleanExplanation || null,
        answer: answersByQuestion.get(question.id) ?? null,
      };
    });

    return NextResponse.json({ attempt, analysis });
  } catch (error) {
    console.error('Test result error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
