import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseAdmin, insertQuestionRowsWithFallback } from '@/lib/test-series-server';
import { encodeSubjectTag, encodeQuestionExplanation, encodeTestSubjectsTag } from '@/app/admin/test-series/_components/testSeriesHelpers';
import type { CreateSeriesFromPdfCommitPayload } from '@/lib/question-parser/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Verify admin role
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }

    const body: CreateSeriesFromPdfCommitPayload = await req.json();
    const { existingSeriesId, series, subjectName, test, questions } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid question is required to create a Test Series.' },
        { status: 400 }
      );
    }

    const cleanSubjectName = (subjectName || 'General Knowledge').trim();

    // -------------------------------------------------------------
    // Step 1: Resolve or Create Test Series
    // -------------------------------------------------------------
    let targetSeriesId = existingSeriesId;
    let seriesTitle = series?.title?.trim() || cleanSubjectName;

    if (targetSeriesId) {
      const { data: existingSeries, error: existErr } = await admin
        .from('test_series')
        .select('id, title')
        .eq('id', targetSeriesId)
        .maybeSingle();

      if (existErr || !existingSeries) {
        return NextResponse.json({ error: 'Specified existing Test Series not found' }, { status: 404 });
      }
      seriesTitle = existingSeries.title;
    } else {
      if (!series?.title?.trim()) {
        return NextResponse.json({ error: 'Series title is required' }, { status: 400 });
      }

      const seriesPayload: any = {
        title: series.title.trim(),
        description: series.description?.trim() || null,
        thumbnail_url: series.thumbnail_url || null,
        is_paid: Boolean(series.is_paid),
        is_published: series.is_published !== false,
        order: Number(series.order) || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let { data: newSeries, error: seriesErr } = await admin
        .from('test_series')
        .insert(seriesPayload)
        .select('id, title')
        .single();

      if (seriesErr && seriesErr.message?.includes('is_paid')) {
        delete seriesPayload.is_paid;
        const retry = await admin
          .from('test_series')
          .insert(seriesPayload)
          .select('id, title')
          .single();
        newSeries = retry.data;
        seriesErr = retry.error;
      }

      if (seriesErr || !newSeries) {
        console.error('Failed to create test series:', seriesErr);
        throw new Error(`Failed to create test series: ${seriesErr?.message || 'Unknown database error'}`);
      }

      targetSeriesId = newSeries.id;
      seriesTitle = newSeries.title;
    }

    // -------------------------------------------------------------
    // Step 2: Resolve or Create Subject in this Series
    // -------------------------------------------------------------
    let targetSubjectId: string | null = null;

    const { data: existingSubjects } = await admin
      .from('test_series_subjects')
      .select('id, name')
      .eq('series_id', targetSeriesId);

    const matchedSubject = (existingSubjects || []).find(
      (s) => s.name.toLowerCase().trim() === cleanSubjectName.toLowerCase()
    );

    if (matchedSubject) {
      targetSubjectId = matchedSubject.id;
    } else {
      const { data: newSubject, error: subErr } = await admin
        .from('test_series_subjects')
        .insert({
          series_id: targetSeriesId,
          name: cleanSubjectName,
          order: (existingSubjects?.length || 0) + 1,
          is_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (subErr || !newSubject) {
        console.error('Failed to create test subject:', subErr);
        throw new Error(`Failed to create subject "${cleanSubjectName}": ${subErr?.message}`);
      }

      targetSubjectId = newSubject.id;
    }

    if (!targetSubjectId) {
      throw new Error('Failed to resolve or create target subject');
    }


    // -------------------------------------------------------------
    // Step 3: Create Test in this Series
    // -------------------------------------------------------------
    const testTitle = test?.title?.trim() || seriesTitle;
    const marksPerCorrect = Number(test?.marks_per_correct) || 1;
    const totalMarks = Number(test?.max_marks) || questions.length * marksPerCorrect;
    const encodedInstructions = encodeTestSubjectsTag(test?.instructions || '', [targetSubjectId]);


    const testPayload: any = {
      series_id: targetSeriesId,
      subject_id: targetSubjectId,
      subject_ids: [targetSubjectId],
      title: testTitle,
      date_label: test?.date_label?.trim() || null,
      duration_minutes: Number(test?.duration_minutes) || 60,
      max_marks: totalMarks,
      marks_per_correct: marksPerCorrect,
      negative_marks: Number(test?.negative_marks) || 0,
      language: test?.language || 'English',
      instructions: encodedInstructions,
      is_paid: Boolean(test?.is_paid),
      price: Number(test?.price) || 0,
      is_published: test?.is_published !== false,
      scheduled_start: test?.scheduled_start || null,
      scheduled_end: test?.scheduled_end || null,
      order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { data: newTest, error: testErr } = await admin
      .from('tests')
      .insert(testPayload)
      .select('id')
      .single();

    if (testErr && (testErr.message?.includes('series_id') || testErr.message?.includes('subject_ids'))) {
      const fallbackPayload = { ...testPayload };
      delete fallbackPayload.series_id;
      delete fallbackPayload.subject_ids;
      const retry = await admin.from('tests').insert(fallbackPayload).select('id').single();
      newTest = retry.data;
      testErr = retry.error;
    }

    if (testErr || !newTest) {
      console.error('Failed to create test:', testErr);
      throw new Error(`Failed to create test: ${testErr?.message}`);
    }

    const testId = newTest.id;

    // -------------------------------------------------------------
    // Step 4: Insert All Questions into this Test
    // -------------------------------------------------------------
    const rowsToInsert = questions.map((q, idx) => {
      const taggedExplanation = encodeQuestionExplanation(q.explanation || '', {
        subjectId: targetSubjectId,
        questionImageUrl: q.question_image_url || null,
        optionAImageUrl: q.option_a_image_url || null,
        optionBImageUrl: q.option_b_image_url || null,
        optionCImageUrl: q.option_c_image_url || null,
        optionDImageUrl: q.option_d_image_url || null,
      });

      return {
        test_id: testId,
        subject_id: targetSubjectId,
        question_text: String(q.question_text || '').trim(),
        question_image_url: q.question_image_url || null,
        option_a: String(q.option_a || '').trim(),
        option_a_image_url: q.option_a_image_url || null,
        option_b: String(q.option_b || '').trim(),
        option_b_image_url: q.option_b_image_url || null,
        option_c: String(q.option_c || '').trim(),
        option_c_image_url: q.option_c_image_url || null,
        option_d: String(q.option_d || '').trim(),
        option_d_image_url: q.option_d_image_url || null,
        correct_option: q.correct_option as 'A' | 'B' | 'C' | 'D',
        explanation: taggedExplanation || null,
        marks: Number(q.marks) || marksPerCorrect,
        negative_marks: Number(q.negative_marks) || Number(test?.negative_marks) || 0,
        language: q.language || test?.language || 'English',
        order: idx + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    const insertedRows = await insertQuestionRowsWithFallback(admin, rowsToInsert);
    const insertedCount = insertedRows.length > 0 ? insertedRows.length : rowsToInsert.length;

    return NextResponse.json({
      success: true,
      seriesId: targetSeriesId,
      testId,
      seriesTitle,
      testTitle,
      subjectName: cleanSubjectName,
      questionsCount: insertedCount,
      message: `Successfully created "${seriesTitle}" with ${insertedCount} questions!`,
    });
  } catch (error: any) {
    console.error('API /api/admin/test-series/create-from-pdf/commit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An error occurred while creating the test series',
      },
      { status: 500 }
    );
  }
}
