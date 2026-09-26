import fs from 'fs';
import { parseQuestionFile } from '../src/lib/question-parser';

const REAL_PDF_PATH =
  'C:\\Users\\deepa\\Downloads\\UP Police Practice Set in Hindi PDF Download By Disha Publication (sscstudy.com).pdf';

async function runComprehensiveRangeTests() {
  console.log('=== RUNNING COMPREHENSIVE QUESTION RANGE TEST SUITE ===\n');

  if (!fs.existsSync(REAL_PDF_PATH)) {
    throw new Error(`Real PDF not found at ${REAL_PDF_PATH}`);
  }
  const buf = fs.readFileSync(REAL_PDF_PATH);
  console.log(`Loaded test PDF: ${(buf.length / (1024 * 1024)).toFixed(2)} MB`);

  let passed = 0;
  let total = 0;

  function assert(desc: string, cond: boolean, details?: any) {
    total++;
    if (cond) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`, details ? details : '');
      process.exitCode = 1;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Range 1 -> 60
  // -------------------------------------------------------------
  console.log('\n--- Case 1: Range 1 -> 60 ---');
  const res1 = await parseQuestionFile(buf, 'sample.pdf', { fromQuestion: 1, toQuestion: 60 });
  assert('Res1 success is true', res1.success === true);
  assert('Res1 question count is exactly 60', res1.questions.length === 60);
  assert('Res1 first question is 1', res1.questions[0]?.question_number === 1);
  assert('Res1 last question is 60', res1.questions[res1.questions.length - 1]?.question_number === 60);
  assert('Res1 is_range_complete is true', res1.is_range_complete === true);

  // -------------------------------------------------------------
  // Test 2: Range 6 -> 8
  // -------------------------------------------------------------
  console.log('\n--- Case 2: Range 6 -> 8 ---');
  const res2 = await parseQuestionFile(buf, 'sample.pdf', { fromQuestion: 6, toQuestion: 8 });
  assert('Res2 success is true', res2.success === true);
  assert('Res2 count is exactly 3', res2.questions.length === 3);
  const qNums2 = res2.questions.map((q) => q.question_number);
  assert('Res2 question numbers are [6, 7, 8]', JSON.stringify(qNums2) === JSON.stringify([6, 7, 8]));
  assert('Res2 does NOT include question 1-5 from page 6', !qNums2.includes(1) && !qNums2.includes(5));

  // -------------------------------------------------------------
  // Test 3: Range 101 -> 200
  // -------------------------------------------------------------
  console.log('\n--- Case 3: Range 101 -> 200 ---');
  const res3 = await parseQuestionFile(buf, 'sample.pdf', { fromQuestion: 101, toQuestion: 200 });
  console.log('Res 3 actual count:', res3.questions.length, 'first:', res3.questions[0]?.question_number, 'last:', res3.questions[res3.questions.length - 1]?.question_number);
  assert('Res3 success is true', res3.success === true);
  assert('Res3 extracted questions in 101-160 range', res3.questions.length === 60);
  assert('Res3 first question is 101', res3.questions[0]?.question_number === 101);
  assert('Res3 last question is 160', res3.questions[res3.questions.length - 1]?.question_number === 160);
  assert('Res3 has missing question warning for 161..200', (res3.warnings?.length || 0) > 0);

  // -------------------------------------------------------------
  // Test 4: Range with no matching questions (e.g. 999 -> 1050)
  // -------------------------------------------------------------
  console.log('\n--- Case 4: Range with no matching questions (999 -> 1050) ---');
  const res4 = await parseQuestionFile(buf, 'sample.pdf', { fromQuestion: 999, toQuestion: 1050 });
  assert('Res4 success is false', res4.success === false);
  assert(
    'Res4 returns "No questions found in the selected question-number range."',
    res4.error === 'No questions found in the selected question-number range.',
    res4.error
  );

  // -------------------------------------------------------------
  // Test 5: From > To (60 -> 10)
  // -------------------------------------------------------------
  console.log('\n--- Case 5: From > To (60 -> 10) ---');
  const res5 = await parseQuestionFile(buf, 'sample.pdf', { fromQuestion: 60, toQuestion: 10 });
  assert('Res5 success is false', res5.success === false);
  assert(
    'Res5 returns "From Question Number must be less than or equal to To Question Number."',
    res5.error === 'From Question Number must be less than or equal to To Question Number.',
    res5.error
  );

  // -------------------------------------------------------------
  // Test 6: Text/Document where question numbering starts from other than 1 (e.g. 101 -> 105)
  // -------------------------------------------------------------
  console.log('\n--- Case 6: Non-1 starting questions (101 -> 105) ---');
  const res6 = await parseQuestionFile(buf, 'sample.pdf', { fromQuestion: 101, toQuestion: 105 });
  assert('Res6 success is true', res6.success === true);
  assert('Res6 count is 5', res6.questions.length === 5);
  const qNums6 = res6.questions.map((q) => q.question_number);
  assert('Res6 question numbers are [101, 102, 103, 104, 105]', JSON.stringify(qNums6) === JSON.stringify([101, 102, 103, 104, 105]));

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed}/${total} assertions passed.`);
  console.log(`========================================\n`);

  if (passed !== total) {
    throw new Error(`Some assertions failed: ${total - passed} failures`);
  }
}

runComprehensiveRangeTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
