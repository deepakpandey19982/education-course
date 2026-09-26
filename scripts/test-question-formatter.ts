import { parseQuestionFile } from '../src/lib/question-parser';
import { extractQuestionsWithRangeFromText } from '../src/lib/question-parser/text-extractor';
import * as XLSX from 'xlsx';

async function runFormatterTests() {
  console.log('====================================================');
  console.log('🚀 TESTING QUESTION FILE FORMATTER & MULTI-SET PARSER');
  console.log('====================================================\n');

  // TEST 1: Multi-Set PDF/Text with Separate Answer Keys (1-(a), 2-(b)...)
  console.log('[Test 1] Multi-Practice-Set with Independent Answer Keys:');
  const multiSetDocument = `
Practice Set-1
1. What is the capital of India?
(a) Mumbai
(b) New Delhi
(c) Kolkata
(d) Chennai

2. Which planet is known as the Red Planet?
(a) Venus
(b) Mars
(c) Jupiter
(d) Saturn

3. Which gas do plants absorb during photosynthesis?
(a) Oxygen
(b) Carbon Dioxide
(c) Nitrogen
(d) Hydrogen

4. Who wrote the National Anthem of India?
(a) Rabindranath Tagore
(b) Bankim Chandra Chattopadhyay
(c) Sarojini Naidu
(d) Subhas Chandra Bose

5. What is the boiling point of water at sea level?
(a) 90°C
(b) 100°C
(c) 120°C
(d) 80°C

Answer Key
1-(b)
2-(b)
3-(b)
4-(a)
5-(b)

Practice Set-2
1. Which is the largest ocean in the world?
(a) Atlantic Ocean
(b) Indian Ocean
(c) Pacific Ocean
(d) Arctic Ocean

2. What is the national currency of Japan?
(a) Won
(b) Yuan
(c) Dollar
(d) Yen

3. How many continents are there on Earth?
(a) 5
(b) 6
(c) 7
(d) 8

4. Which is the smallest prime number?
(a) 1
(b) 2
(c) 3
(d) 5

5. What is the freezing point of water?
(a) 0°C
(b) -10°C
(c) 4°C
(d) 32°C

उत्तर कुंजी
1-(c)
2-(d)
3-(c)
4-(b)
5-(a)
`;

  // Parse overall document without section filter to test section detection
  const parseAllRes = await parseQuestionFile(Buffer.from(multiSetDocument, 'utf-8'), 'sample_sets.txt');
  console.log('  Sections detected:', parseAllRes.sections?.map(s => `${s.name} (${s.total_questions} qs)`));
  
  if (!parseAllRes.sections || parseAllRes.sections.length < 2) {
    throw new Error('Failed: Should have detected at least 2 practice sets!');
  }
  console.log('  ✓ Detected Practice Set-1 and Practice Set-2 successfully.');

  // Parse Practice Set-1 specifically
  const set1Res = await parseQuestionFile(Buffer.from(multiSetDocument, 'utf-8'), 'sample_sets.txt', {
    sectionId: parseAllRes.sections[0].id,
    fromQuestion: 1,
    toQuestion: 5,
    defaultSubjectName: 'General Knowledge',
  });

  console.log('\n  Practice Set-1 results:');
  console.log(`    Total: ${set1Res.questions_detected}, Valid: ${set1Res.valid_questions_count}, Needs Review: ${set1Res.needs_review_count}`);
  set1Res.questions.forEach((q) => {
    console.log(`    Q${q.question_number}: Answer=${q.correct_option} (Status: ${q.status}) - ${q.question_text.slice(0, 35)}...`);
  });

  if (set1Res.questions.length !== 5) throw new Error(`Expected 5 questions in Set 1, got ${set1Res.questions.length}`);
  if (set1Res.valid_questions_count !== 5) throw new Error(`Expected 5 valid questions in Set 1, got ${set1Res.valid_questions_count}`);
  if (set1Res.questions[0].correct_option !== 'B') throw new Error(`Set 1 Q1 answer should be B (New Delhi), got ${set1Res.questions[0].correct_option}`);
  if (set1Res.questions[1].correct_option !== 'B') throw new Error(`Set 1 Q2 answer should be B (Mars), got ${set1Res.questions[1].correct_option}`);
  if (set1Res.questions[3].correct_option !== 'A') throw new Error(`Set 1 Q4 answer should be A (Rabindranath Tagore), got ${set1Res.questions[3].correct_option}`);
  console.log('  ✓ Practice Set-1 answer key 1-(b)... correctly mapped.');

  // Parse Practice Set-2 specifically and verify NO cross-contamination
  const set2Res = await parseQuestionFile(Buffer.from(multiSetDocument, 'utf-8'), 'sample_sets.txt', {
    sectionId: parseAllRes.sections[1].id,
    fromQuestion: 1,
    toQuestion: 5,
    defaultSubjectName: 'General Knowledge',
  });

  console.log('\n  Practice Set-2 results:');
  console.log(`    Total: ${set2Res.questions_detected}, Valid: ${set2Res.valid_questions_count}, Needs Review: ${set2Res.needs_review_count}`);
  set2Res.questions.forEach((q) => {
    console.log(`    Q${q.question_number}: Answer=${q.correct_option} (Status: ${q.status}) - ${q.question_text.slice(0, 35)}...`);
  });

  if (set2Res.questions.length !== 5) throw new Error(`Expected 5 questions in Set 2, got ${set2Res.questions.length}`);
  if (set2Res.valid_questions_count !== 5) throw new Error(`Expected 5 valid questions in Set 2, got ${set2Res.valid_questions_count}`);
  // In Set 2: Q1 answer is C (Pacific Ocean), Q2 answer is D (Yen)
  if (set2Res.questions[0].correct_option !== 'C') throw new Error(`Set 2 Q1 answer should be C (Pacific Ocean), got ${set2Res.questions[0].correct_option}`);
  if (set2Res.questions[1].correct_option !== 'D') throw new Error(`Set 2 Q2 answer should be D (Yen), got ${set2Res.questions[1].correct_option}`);
  console.log('  ✓ Practice Set-2 answer key 1-(c), 2-(d)... correctly mapped without cross-contamination!');
  console.log('✅ Test 1 Passed!\n');

  // TEST 2: Question Range Extraction & Missing Question Warning
  console.log('[Test 2] Question Range & Missing Detection:');
  // Request range 2 to 4 from Set 1
  const rangeRes = await parseQuestionFile(Buffer.from(multiSetDocument, 'utf-8'), 'sample_sets.txt', {
    sectionId: parseAllRes.sections[0].id,
    fromQuestion: 2,
    toQuestion: 4,
  });
  console.log(`  Requested range 2-4: extracted ${rangeRes.questions.length} questions (Q${rangeRes.questions[0].question_number} to Q${rangeRes.questions[rangeRes.questions.length - 1].question_number})`);
  if (rangeRes.questions.length !== 3) throw new Error('Range 2-4 should yield 3 questions');
  if (rangeRes.questions[0].question_number !== 2 || rangeRes.questions[2].question_number !== 4) {
    throw new Error('Range boundaries did not match');
  }

  // Request range 1 to 10 when only 5 exist
  const missingRes = await parseQuestionFile(Buffer.from(multiSetDocument, 'utf-8'), 'sample_sets.txt', {
    sectionId: parseAllRes.sections[0].id,
    fromQuestion: 1,
    toQuestion: 10,
  });
  console.log(`  Requested range 1-10 (only 5 exist): found ${missingRes.questions.length}, missing numbers:`, missingRes.missing_question_numbers);
  if (!missingRes.missing_question_numbers || missingRes.missing_question_numbers.length !== 5) {
    throw new Error('Expected 5 missing question numbers (6, 7, 8, 9, 10)');
  }
  if (!missingRes.warnings || missingRes.warnings.length === 0) {
    throw new Error('Missing questions warning banner message should be generated');
  }
  console.log('  ✓ Warning generated:', missingRes.warnings[0]);
  console.log('✅ Test 2 Passed!\n');

  // TEST 3: Question Validation Statuses (Valid, Needs Review, Invalid)
  console.log('[Test 3] Question Validation Status Checks:');
  const dirtyQuestionsText = `
1. Complete valid question
A. Option 1
B. Option 2
C. Option 3
D. Option 4
Ans: A

2. Question with missing option D
A. Option 1
B. Option 2
C. Option 3
Ans: B

3. Question with missing answer
A. Option 1
B. Option 2
C. Option 3
D. Option 4

4.
A. Option 1
B. Option 2
C. Option 3
D. Option 4
Ans: C
`;

  const dirtyRes = await parseQuestionFile(Buffer.from(dirtyQuestionsText, 'utf-8'), 'dirty.txt', {
    defaultSubjectName: 'General Knowledge',
  });
  console.log(`  Detected ${dirtyRes.questions.length} questions:`);
  dirtyRes.questions.forEach((q, i) => {
    console.log(`    Q${i + 1}: Status=${q.status}, Issues=[${q.validation_issues.join('; ')}]`);
  });

  const validQs = dirtyRes.questions.filter(q => q.status === 'valid');
  const reviewQs = dirtyRes.questions.filter(q => q.status === 'needs_review');
  const invalidQs = dirtyRes.questions.filter(q => q.status === 'invalid');

  if (validQs.length !== 1) throw new Error(`Expected 1 valid question, got ${validQs.length}`);
  if (reviewQs.length !== 2) throw new Error(`Expected 2 needs_review questions, got ${reviewQs.length}`);
  if (invalidQs.length !== 1) throw new Error(`Expected 1 invalid question (empty text), got ${invalidQs.length}`);
  console.log('  ✓ Statuses properly tagged: Valid (1), Needs Review (2), Invalid (1)');
  console.log('✅ Test 3 Passed!\n');

  // TEST 4: Excel XLSX with Question Formatter Standard Format
  console.log('[Test 4] Excel Parsing with Range & Section:');
  const excelRows = [
    ['Question No', 'Question Text', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Marks', 'Negative Marks', 'Subject'],
  ];
  for (let i = 1; i <= 20; i++) {
    excelRows.push([
      `${i}`,
      `Excel Sample Question #${i} Text`,
      `Option A for ${i}`,
      `Option B for ${i}`,
      `Option C for ${i}`,
      `Option D for ${i}`,
      ['A', 'B', 'C', 'D'][(i - 1) % 4],
      '1',
      '0.25',
      i <= 10 ? 'Physics' : 'Chemistry',
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(excelRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Test extracting range 6 to 15 from Excel
  const excelRes = await parseQuestionFile(xlsxBuffer, 'test_questions.xlsx', {
    fromQuestion: 6,
    toQuestion: 15,
  });

  console.log(`  Extracted from Excel range 6-15: ${excelRes.questions.length} questions`);
  if (excelRes.questions.length !== 10) throw new Error(`Expected 10 questions from Excel, got ${excelRes.questions.length}`);
  if (excelRes.questions[0].question_number !== 6) throw new Error(`First question should be #6, got ${excelRes.questions[0].question_number}`);
  if (excelRes.questions[9].question_number !== 15) throw new Error(`Last question should be #15, got ${excelRes.questions[9].question_number}`);
  console.log('  ✓ Excel range extraction verified.');
  console.log('✅ Test 4 Passed!\n');

  console.log('====================================================');
  console.log('🎉 ALL QUESTION FILE FORMATTER TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runFormatterTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
