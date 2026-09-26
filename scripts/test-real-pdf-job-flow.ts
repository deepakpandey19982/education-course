import fs from 'fs';
import { createJob, getJob, executeJobInBackground } from '../src/lib/question-parser/job-manager';

const REAL_PDF_PATH = 'C:\\Users\\deepa\\Downloads\\UP Police Practice Set in Hindi PDF Download By Disha Publication (sscstudy.com).pdf';

async function runJobAndAwait(name: string, buffer: Buffer, options: any) {
  const job = createJob(name);
  console.log(`[${name}] Created job: ${job.id}`);

  // Run job asynchronously (as the API route does)
  const execPromise = executeJobInBackground(job.id, buffer, name, options);

  // Poll job status until complete
  let lastStatus = '';
  while (true) {
    const current = getJob(job.id);
    if (!current) throw new Error('Job not found in registry');

    if (current.status !== lastStatus) {
      console.log(`  -> Job status: ${current.status} (${current.progressPercent}%) - ${current.message}`);
      lastStatus = current.status;
    }

    if (current.status === 'READY_FOR_PREVIEW') {
      await execPromise;
      return current.result;
    }
    if (current.status === 'FAILED') {
      await execPromise;
      throw new Error(`Job failed: ${current.error || current.message}`);
    }

    await new Promise(r => setTimeout(r, 100));
  }
}

async function main() {
  console.log('=== TESTING REAL PDF BACKGROUND JOB PROCESSING ===\n');
  if (!fs.existsSync(REAL_PDF_PATH)) {
    throw new Error(`Real PDF not found at path: ${REAL_PDF_PATH}`);
  }

  const fileBuffer = fs.readFileSync(REAL_PDF_PATH);
  console.log(`Loaded real PDF file: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

  // 1. Initial full scan (detect all practice sets and questions)
  console.log('\n--- 1. Testing Full Scan (Section Detection) ---');
  const fullResult: any = await runJobAndAwait('FullScan.pdf', fileBuffer, {});
  console.log(`Total sections detected: ${fullResult.sections?.length || 0}`);
  fullResult.sections?.forEach((sec: any) => {
    console.log(`  - [${sec.id}] ${sec.name}: ${sec.total_questions} questions (${sec.from_question}-${sec.to_question}), AnswerKey: ${sec.has_answer_key}`);
  });

  if (!fullResult.sections || fullResult.sections.length < 10) {
    throw new Error(`Expected at least 10 sections, got ${fullResult.sections?.length}`);
  }

  const set1Id = fullResult.sections[0].id; // 'sec-1'

  // 2. Test Range 1 → 10
  console.log('\n--- 2. Testing Range 1 → 10 (Practice Set 1) ---');
  const r1_10: any = await runJobAndAwait('Range_1_10.pdf', fileBuffer, {
    sectionId: set1Id,
    fromQuestion: 1,
    toQuestion: 10,
    defaultSubjectName: 'General Knowledge',
  });
  console.log(`Found: ${r1_10.questions.length} questions`);
  console.log(`Range Info: total_requested=${r1_10.total_requested}, found=${r1_10.found_question_numbers?.length}, complete=${r1_10.is_range_complete}`);
  const q1 = r1_10.questions[0];
  console.log('Sample Q1:');
  console.log(`  Number: ${q1.question_number}`);
  console.log(`  Text: ${q1.question_text.substring(0, 80)}...`);
  console.log(`  A: ${q1.option_a}`);
  console.log(`  B: ${q1.option_b}`);
  console.log(`  C: ${q1.option_c}`);
  console.log(`  D: ${q1.option_d}`);
  console.log(`  Ans: ${q1.correct_option}`);
  console.log(`  Subject: ${q1.subject_name}`);
  console.log(`  Section: ${q1.section_name}`);
  console.log(`  Status: ${q1.status}`);

  if (r1_10.questions.length !== 10) {
    throw new Error(`Expected 10 questions for range 1-10, got ${r1_10.questions.length}`);
  }
  if (!r1_10.is_range_complete) {
    throw new Error('Expected range 1-10 to be complete');
  }

  // 3. Test Range 1 → 60
  console.log('\n--- 3. Testing Range 1 → 60 (Practice Set 1) ---');
  const r1_60: any = await runJobAndAwait('Range_1_60.pdf', fileBuffer, {
    sectionId: set1Id,
    fromQuestion: 1,
    toQuestion: 60,
    defaultSubjectName: 'UP Police Practice Set',
  });
  console.log(`Found: ${r1_60.questions.length} questions`);
  const valid1_60 = r1_60.questions.filter((q: any) => q.status === 'valid').length;
  const review1_60 = r1_60.questions.filter((q: any) => q.status === 'needs_review').length;
  console.log(`Valid: ${valid1_60}, Needs Review: ${review1_60}`);
  console.log(`Missing count: ${r1_60.missing_question_numbers?.length || 0}`, r1_60.missing_question_numbers);
  console.log(`Warnings:`, r1_60.warnings);
  if (r1_60.questions.length !== 60) {
    throw new Error(`Expected exactly 60 questions for range 1-60, got ${r1_60.questions.length}`);
  }
  if (r1_60.is_range_complete !== true) {
    throw new Error('Expected range 1-60 to be complete with 0 missing questions');
  }
  if (r1_60.missing_question_numbers?.length !== 0) {
    throw new Error(`Expected 0 missing questions, got: ${r1_60.missing_question_numbers.join(', ')}`);
  }

  // Specifically verify Question 49
  const q49 = r1_60.questions.find((q: any) => q.question_number === 49);
  if (!q49) {
    throw new Error('Question 49 was not found in parsed questions!');
  }
  console.log('\nVerified Q49 in Preview:');
  console.log(`  Number: ${q49.question_number}`);
  console.log(`  Text: ${q49.question_text}`);
  console.log(`  Option A: ${q49.option_a}`);
  console.log(`  Option B: ${q49.option_b}`);
  console.log(`  Option C: ${q49.option_c}`);
  console.log(`  Option D: ${q49.option_d}`);
  console.log(`  Correct Option: ${q49.correct_option}`);
  console.log(`  Status: ${q49.status}`);

  if (!q49.option_a || !q49.option_b || !q49.option_c || !q49.option_d) {
    throw new Error('Question 49 is missing one or more options!');
  }
  if (!q49.correct_option) {
    throw new Error('Question 49 is missing correct_option answer key match!');
  }

  // 4. Test Range 1 → 100
  console.log('\n--- 4. Testing Range 1 → 100 (Practice Set 1) ---');
  const r1_100: any = await runJobAndAwait('Range_1_100.pdf', fileBuffer, {
    sectionId: set1Id,
    fromQuestion: 1,
    toQuestion: 100,
  });
  console.log(`Found: ${r1_100.questions.length} questions`);
  const valid1_100 = r1_100.questions.filter((q: any) => q.status === 'valid').length;
  const review1_100 = r1_100.questions.filter((q: any) => q.status === 'needs_review').length;
  console.log(`Valid: ${valid1_100}, Needs Review: ${review1_100}`);
  console.log(`Missing count: ${r1_100.missing_question_numbers?.length || 0}`, r1_100.missing_question_numbers);
  if (r1_100.questions.length !== 100) {
    throw new Error(`Expected 100 questions for range 1-100, got ${r1_100.questions.length}`);
  }

  // 5. Test Range 101 → 160
  console.log('\n--- 5. Testing Range 101 → 160 (Practice Set 1) ---');
  const r101_160: any = await runJobAndAwait('Range_101_160.pdf', fileBuffer, {
    sectionId: set1Id,
    fromQuestion: 101,
    toQuestion: 160,
  });
  console.log(`Found: ${r101_160.questions.length} questions`);
  const valid101_160 = r101_160.questions.filter((q: any) => q.status === 'valid').length;
  const review101_160 = r101_160.questions.filter((q: any) => q.status === 'needs_review').length;
  console.log(`Valid: ${valid101_160}, Needs Review: ${review101_160}`);
  console.log(`Missing count: ${r101_160.missing_question_numbers?.length || 0}`, r101_160.missing_question_numbers);
  if (r101_160.questions.length !== 60) {
    throw new Error(`Expected 60 questions for range 101-160, got ${r101_160.questions.length}`);
  }

  const q101 = r101_160.questions[0];
  console.log('Sample Q101:');
  console.log(`  Number: ${q101.question_number}`);
  console.log(`  Text: ${q101.question_text.substring(0, 80)}...`);
  console.log(`  A: ${q101.option_a}`);
  console.log(`  B: ${q101.option_b}`);
  console.log(`  C: ${q101.option_c}`);
  console.log(`  D: ${q101.option_d}`);
  console.log(`  Ans: ${q101.correct_option}`);
  console.log(`  Subject: ${q101.subject_name}`);
  console.log(`  Section: ${q101.section_name}`);
  console.log(`  Status: ${q101.status}`);

  console.log('\n=== ALL REAL PDF BACKGROUND JOB TESTS PASSED SUCCESSFULLY! ===');
}

main().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
