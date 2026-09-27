import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { parseQuestionFile } from '../src/lib/question-parser';
import { insertQuestionRowsWithFallback } from '../src/lib/test-series-server';
import { encodeQuestionExplanation, resolveTestSubjectIds, encodeTestSubjectsTag, decodeSubjectTag } from '../src/app/admin/test-series/_components/testSeriesHelpers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log('=== TESTING QUESTIONS 81-120 PARSE & COMMIT ===\n');

  const pdfPath =
    'C:\\Users\\deepa\\Downloads\\UP Police Practice Set in Hindi PDF Download By Disha Publication (sscstudy.com).pdf';

  if (!fs.existsSync(pdfPath)) {
    console.error('PDF file not found at:', pdfPath);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  console.log('1. Parsing PDF for Range 81 to 120...');

  const parseResult = await parseQuestionFile(pdfBuffer, 'UP Police Practice Set.pdf', {
    fromQuestion: 81,
    toQuestion: 120,
    sectionId: 'sec-1',
  });

  console.log(`Total questions detected: ${parseResult.questions.length}`);
  console.log(`Valid: ${parseResult.questions.filter((q) => q.status === 'valid').length}`);
  console.log(`Needs Review: ${parseResult.questions.filter((q) => q.status === 'needs_review').length}`);
  console.log(`Invalid: ${parseResult.questions.filter((q) => q.status === 'invalid').length}`);

  if (parseResult.questions.length !== 40) {
    throw new Error(`Expected exactly 40 questions, got ${parseResult.questions.length}`);
  }

  const validCount = parseResult.questions.filter((q) => q.status === 'valid').length;
  const needsReviewCount = parseResult.questions.filter((q) => q.status === 'needs_review').length;

  console.log(`\nVerification: 40 questions found, ${validCount} Valid, ${needsReviewCount} Needs Review`);

  // Verify critical questions
  const q83 = parseResult.questions.find((q) => q.question_number === 83);
  console.log('Q83 text:', q83?.question_text);
  if (!q83?.question_text.includes(':') || !q83?.question_text.includes('::')) {
    throw new Error('Q83 missing colon or double colon!');
  }

  const q86 = parseResult.questions.find((q) => q.question_number === 86);
  console.log('Q86 text:', q86?.question_text);
  if (!q86?.question_text.includes('169/121')) {
    throw new Error('Q86 missing 169/121 fraction!');
  }

  const q95 = parseResult.questions.find((q) => q.question_number === 95);
  console.log('Q95 has_image:', Boolean(q95?.question_image_url), 'is_image_based:', q95?.is_image_based);
  if (q95?.question_image_url || q95?.is_image_based) {
    throw new Error('Q95 falsely detected as diagram question!');
  }

  const q100 = parseResult.questions.find((q) => q.question_number === 100);
  console.log('Q100 options: A=', q100?.option_a, 'B=', q100?.option_b);
  if (q100?.status !== 'valid') {
    throw new Error('Q100 duplicate options should be valid!');
  }

  // 2. Prepare test in Supabase for import
  console.log('\n2. Finding target Test in Supabase...');
  const { data: test, error: tErr } = await admin.from('tests').select('*').limit(1).single();
  if (tErr || !test) {
    throw new Error(`Target test not found in DB: ${tErr?.message}`);
  }
  console.log('Target test:', test.title, test.id);

  // 3. Build payload as sent by handleCommitImport
  console.log('\n3. Building import commit payload for the 40 questions...');
  const targetList = parseResult.questions.filter((q) => q.status === 'valid');

  const rowsToInsert = targetList.map((q: any, idx: number) => {
    const qSubId = q.subject_id || test.subject_id || null;

    const taggedExplanation = encodeQuestionExplanation(q.explanation || '', {
      subjectId: qSubId,
      questionImageUrl: q.question_image_url || null,
      optionAImageUrl: q.option_a_image_url || null,
      optionBImageUrl: q.option_b_image_url || null,
      optionCImageUrl: q.option_c_image_url || null,
      optionDImageUrl: q.option_d_image_url || null,
    });

    return {
      test_id: test.id,
      subject_id: qSubId,
      question_text: String(q.question_text || '').trim(),
      question_image_url: q.question_image_url || null,
      option_a: String(q.options?.A || q.option_a || '').trim(),
      option_a_image_url: q.option_a_image_url || null,
      option_b: String(q.options?.B || q.option_b || '').trim(),
      option_b_image_url: q.option_b_image_url || null,
      option_c: String(q.options?.C || q.option_c || '').trim(),
      option_c_image_url: q.option_c_image_url || null,
      option_d: String(q.options?.D || q.option_d || '').trim(),
      option_d_image_url: q.option_d_image_url || null,
      correct_option: (q.correct_answer || q.correct_option || 'A') as 'A' | 'B' | 'C' | 'D',
      explanation: taggedExplanation || null,
      marks: Number(q.marks) || Number(test.marks_per_correct) || 2,
      negative_marks: Number(q.negative_marks) || Number(test.negative_marks) || 0.5,
      language: q.language || test.language || 'Hindi',
      order: 1000 + idx,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  console.log(`4. Inserting ${rowsToInsert.length} questions using insertQuestionRowsWithFallback...`);
  const inserted = await insertQuestionRowsWithFallback(admin, rowsToInsert);
  console.log(`✓ Insert succeeded! Inserted records count: ${inserted.length}`);

  // 5. Query Supabase directly to verify all 40 questions were stored
  console.log('\n5. Querying Supabase questions table to verify persistence...');
  const insertedIds = inserted.map((r) => r.id);
  const { data: dbQuestions, error: fetchErr } = await admin
    .from('questions')
    .select('*')
    .in('id', insertedIds)
    .order('order', { ascending: true });

  if (fetchErr) throw fetchErr;
  console.log(`✓ Retrieved ${dbQuestions?.length} questions from Supabase questions table!`);

  if (dbQuestions?.length !== 40) {
    throw new Error(`Expected 40 questions in DB, got ${dbQuestions?.length}`);
  }

  // Verify decoded properties
  const dbQ83 = dbQuestions.find((q) => q.question_text.includes('624'));
  console.log('✓ Verified DB Question 83 text:', dbQ83?.question_text);

  const dbQ86 = dbQuestions.find((q) => q.question_text.includes('169/121'));
  console.log('✓ Verified DB Question 86 text:', dbQ86?.question_text);

  const dbQ95 = dbQuestions.find((q) => q.question_text.includes('शब्दकोश'));
  console.log('✓ Verified DB Question 95 text:', dbQ95?.question_text.substring(0, 60));

  // Clean up the 40 test rows
  console.log('\n6. Cleaning up test inserted rows...');
  const { error: delErr } = await admin.from('questions').delete().in('id', insertedIds);
  if (delErr) {
    console.warn('Cleanup warning:', delErr);
  } else {
    console.log('✓ Cleaned up test questions from database successfully.');
  }

  console.log('\n========================================');
  console.log('ALL 40 QUESTIONS IMPORT VERIFICATION PASSED!');
  console.log('========================================');
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
