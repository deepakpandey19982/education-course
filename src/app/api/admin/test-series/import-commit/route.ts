import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseAdmin } from '@/lib/test-series-server';
import { encodeSubjectTag, resolveTestSubjectIds, encodeTestSubjectsTag } from '@/app/admin/test-series/_components/testSeriesHelpers';

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
    const { testId, seriesId, questions } = body;

    if (!testId || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'Valid testId and a non-empty questions array are required' },
        { status: 400 }
      );
    }

    // Verify test exists
    const { data: test, error: testErr } = await admin
      .from('tests')
      .select('*')
      .eq('id', testId)
      .maybeSingle();

    if (testErr || !test) {
      return NextResponse.json({ error: 'Target test not found' }, { status: 404 });
    }

    // Get current maximum order for this test
    const { data: lastQ } = await admin
      .from('questions')
      .select('order')
      .eq('test_id', testId)
      .order('order', { ascending: false })
      .limit(1)
      .maybeSingle();

    let startOrder = (lastQ?.order ?? 0) + 1;

    // Collect all subjects used by the imported questions
    const importedSubjectIds = new Set<string>();

    const rowsToInsert = questions.map((q: any, idx: number) => {
      const qSubId = q.subject_id || test.subject_id || null;
      if (qSubId) {
        importedSubjectIds.add(qSubId);
      }

      // Encode subject tag in explanation
      const taggedExplanation = encodeSubjectTag(q.explanation || '', qSubId);

      return {
        test_id: testId,
        subject_id: qSubId,
        question_text: String(q.question_text || '').trim(),
        option_a: String(q.option_a || '').trim(),
        option_b: String(q.option_b || '').trim(),
        option_c: String(q.option_c || '').trim(),
        option_d: String(q.option_d || '').trim(),
        correct_option: q.correct_option as 'A' | 'B' | 'C' | 'D',
        explanation: taggedExplanation || null,
        marks: Number(q.marks) || Number(test.marks_per_correct) || 1,
        negative_marks: Number(q.negative_marks) || Number(test.negative_marks) || 0,
        language: q.language || test.language || 'English',
        order: startOrder + idx,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // Chunk inserts if importing hundreds of questions
    const CHUNK_SIZE = 50;
    let insertedCount = 0;

    for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
      const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
      let { error: insertErr } = await admin.from('questions').insert(chunk);

      if (insertErr && insertErr.message?.includes('subject_id')) {
        // Fallback without subject_id column
        const fallbackChunk = chunk.map((c) => {
          const copy: any = { ...c };
          delete copy.subject_id;
          return copy;
        });
        const retry = await admin.from('questions').insert(fallbackChunk);
        insertErr = retry.error;
      }

      if (insertErr) {
        console.error('Failed to insert question batch:', insertErr);
        throw new Error(`Database insert failed: ${insertErr.message}`);
      }

      insertedCount += chunk.length;
    }

    // Ensure the test includes all imported subject IDs so student navigation includes them
    try {
      const currentSubjectIds = new Set<string>(resolveTestSubjectIds(test));
      let needsTestUpdate = false;

      for (const sId of importedSubjectIds) {
        if (!currentSubjectIds.has(sId)) {
          currentSubjectIds.add(sId);
          needsTestUpdate = true;
        }
      }

      if (needsTestUpdate) {
        const updatedList = Array.from(currentSubjectIds);
        const encodedInstructions = encodeTestSubjectsTag(test.instructions, updatedList);

        await admin
          .from('tests')
          .update({
            subject_ids: updatedList,
            instructions: encodedInstructions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', testId);
      }
    } catch (subjUpdateErr) {
      console.warn('Could not auto-update test subject_ids:', subjUpdateErr);
    }

    return NextResponse.json({
      success: true,
      count: insertedCount,
      message: `Successfully imported ${insertedCount} questions`,
    });
  } catch (error: any) {
    console.error('API /api/admin/test-series/import-commit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An error occurred while importing questions',
      },
      { status: 500 }
    );
  }
}
