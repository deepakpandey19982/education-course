import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseAdmin } from '@/lib/test-series-server';
import { encodeSubjectTag, encodeTestSubjectsTag } from '@/app/admin/test-series/_components/testSeriesHelpers';

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

    const body = await req.json();
    const { mode, existingSeriesId, series, subjectName, test, testId, questions, sourceMetadata } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid question is required to import.' },
        { status: 400 }
      );
    }

    // =========================================================================
    // MODE A: IMPORT INTO EXISTING TEST
    // =========================================================================
    if (mode === 'import_existing') {
      if (!testId) {
        return NextResponse.json({ error: 'Test ID is required for existing import mode' }, { status: 400 });
      }

      // Fetch test info
      const { data: targetTest, error: tErr } = await admin
        .from('tests')
        .select('*')
        .eq('id', testId)
        .maybeSingle();

      if (tErr || !targetTest) {
        return NextResponse.json({ error: 'Target test not found in database' }, { status: 404 });
      }

      const activeSeriesId = existingSeriesId || targetTest.test_series_id || targetTest.subject_id;

      // Get existing questions count for ordering
      const { count: existingCount } = await admin
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('test_id', testId);

      const startOrder = (existingCount || 0) + 1;

      // Fetch series subjects for tag mapping
      const { data: subRows } = await admin
        .from('test_series_subjects')
        .select('id, name')
        .eq('series_id', activeSeriesId);

      const subList = subRows || [];
      const defaultSubId = subList[0]?.id || targetTest.subject_id || '';

      const insertedQuestionIds: string[] = [];
      const BATCH_SIZE = 50;

      for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE);
        const rows = batch.map((q: any, idx: number) => {
          const matchedSub = subList.find((s) => s.name.toLowerCase() === (q.subject_name || '').toLowerCase());
          const qSubId = q.subject_id || matchedSub?.id || defaultSubId;
          const cleanText = q.question_text?.trim() || '';
          const taggedText = qSubId ? encodeSubjectTag(cleanText, qSubId) : cleanText;

          return {
            test_id: testId,
            subject_id: qSubId,
            question_text: taggedText,
            option_a: q.option_a?.trim() || '',
            option_b: q.option_b?.trim() || '',
            option_c: q.option_c?.trim() || '',
            option_d: q.option_d?.trim() || '',
            correct_option: q.correct_option || 'A',
            explanation: q.explanation?.trim() || null,
            marks: Number(q.marks) || Number(targetTest.marks_per_correct) || 1,
            negative_marks: Number(q.negative_marks) || Number(targetTest.negative_marks) || 0,
            language: q.language || targetTest.language || 'English',
            order: startOrder + i + idx,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });

        const { data: inserted, error: insertErr } = await admin
          .from('questions')
          .insert(rows)
          .select('id');

        if (insertErr) {
          console.error('Batch insert error in import_existing:', insertErr);
          throw new Error(`Failed inserting questions: ${insertErr.message}`);
        }

        if (inserted) {
          insertedQuestionIds.push(...inserted.map((r) => r.id));
        }
      }

      // Update test max_marks
      const totalMarksDelta = questions.reduce((sum: number, q: any) => sum + (Number(q.marks) || 1), 0);
      await admin
        .from('tests')
        .update({
          max_marks: Number(targetTest.max_marks || 0) + totalMarksDelta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', testId);

      return NextResponse.json({
        success: true,
        seriesId: activeSeriesId,
        testId: testId,
        questionsCount: insertedQuestionIds.length,
      });
    }

    // =========================================================================
    // MODE B: CREATE NEW TEST SERIES
    // =========================================================================
    const cleanSubjectName = (subjectName || 'General Knowledge').trim();

    // 1. Resolve or Create Test Series
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
        description: series.description?.trim() || `Imported via Question Formatter from ${sourceMetadata?.fileName || 'file'}`,
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
        console.error('Failed to create Test Series:', seriesErr);
        return NextResponse.json(
          { error: `Failed to create Test Series: ${seriesErr?.message || 'Database error'}` },
          { status: 500 }
        );
      }

      targetSeriesId = newSeries.id;
      seriesTitle = newSeries.title;
    }

    // 2. Resolve or Create Subject in test_series_subjects
    let targetSubjectId: string | null = null;
    const { data: existingSubjects } = await admin
      .from('test_series_subjects')
      .select('id, name')
      .eq('series_id', targetSeriesId);

    const matchSubject = (existingSubjects || []).find(
      (s) => s.name.toLowerCase() === cleanSubjectName.toLowerCase()
    );

    if (matchSubject) {
      targetSubjectId = matchSubject.id;
    } else {
      const { data: newSubject, error: subErr } = await admin
        .from('test_series_subjects')
        .insert({
          series_id: targetSeriesId,
          name: cleanSubjectName,
          order: (existingSubjects?.length || 0),
          is_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (subErr || !newSubject) {
        console.error('Failed to create subject:', subErr);
        return NextResponse.json(
          { error: `Failed to create subject in Test Series: ${subErr?.message || 'Database error'}` },
          { status: 500 }
        );
      }
      targetSubjectId = newSubject.id;
    }

    // 3. Create Test in tests table
    const testTitle = test?.title?.trim() || `${seriesTitle} Test 01`;
    const durationMins = Number(test?.duration_minutes) || 60;
    const marksPerCorrect = Number(test?.marks_per_correct) || 1;
    const negMarks = Number(test?.negative_marks) || 0;
    const maxMarks = Number(test?.max_marks) || questions.length * marksPerCorrect;
    const testLanguage = test?.language || 'English';

    const testPayload: any = {
      test_series_id: targetSeriesId,
      subject_id: targetSubjectId,
      title: testTitle,
      date_label: test?.date_label || null,
      duration_minutes: durationMins,
      max_marks: maxMarks,
      marks_per_correct: marksPerCorrect,
      negative_marks: negMarks,
      language: testLanguage,
      instructions: encodeTestSubjectsTag(
        test?.instructions?.trim() || '1. Attempt all questions.\n2. Each question carries marks as indicated.',
        targetSubjectId ? [targetSubjectId] : []
      ),
      is_paid: Boolean(test?.is_paid),
      price: Number(test?.price) || 0,
      is_published: test?.is_published !== false,
      order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { data: newTest, error: testErr } = await admin
      .from('tests')
      .insert(testPayload)
      .select('id, title')
      .single();

    if (testErr && testErr.message?.includes('test_series_id')) {
      delete testPayload.test_series_id;
      const retry = await admin
        .from('tests')
        .insert(testPayload)
        .select('id, title')
        .single();
      newTest = retry.data;
      testErr = retry.error;
    }

    if (testErr || !newTest) {
      console.error('Failed to create test:', testErr);
      return NextResponse.json(
        { error: `Failed to create test: ${testErr?.message || 'Database error'}` },
        { status: 500 }
      );
    }

    const createdTestId = newTest.id;

    // 4. Insert Questions in Batches of 50
    const insertedIds: string[] = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);
      const rows = batch.map((q: any, idx: number) => {
        const cleanText = q.question_text?.trim() || '';
        const taggedText = targetSubjectId ? encodeSubjectTag(cleanText, targetSubjectId) : cleanText;

        return {
          test_id: createdTestId,
          subject_id: targetSubjectId,
          question_text: taggedText,
          option_a: q.option_a?.trim() || '',
          option_b: q.option_b?.trim() || '',
          option_c: q.option_c?.trim() || '',
          option_d: q.option_d?.trim() || '',
          correct_option: q.correct_option || 'A',
          explanation: q.explanation?.trim() || null,
          marks: Number(q.marks) || marksPerCorrect,
          negative_marks: Number(q.negative_marks) || negMarks,
          language: q.language || testLanguage,
          order: i + idx + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      const { data: inserted, error: insertErr } = await admin
        .from('questions')
        .insert(rows)
        .select('id');

      if (insertErr) {
        console.error(`Failed to insert questions batch ${i}:`, insertErr);
        throw new Error(`Failed inserting questions at item ${i + 1}: ${insertErr.message}`);
      }

      if (inserted) {
        insertedIds.push(...inserted.map((r) => r.id));
      }
    }

    return NextResponse.json({
      success: true,
      seriesId: targetSeriesId,
      seriesTitle,
      testId: createdTestId,
      testTitle: newTest.title,
      questionsCount: insertedIds.length,
    });
  } catch (error: any) {
    console.error('API /api/admin/question-formatter/commit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An error occurred while saving questions',
      },
      { status: 500 }
    );
  }
}
