import { parseQuestionFile } from '../src/lib/question-parser';
import * as XLSX from 'xlsx';

async function runTests() {
  console.log('--- TESTING SMART QUESTION PARSER ---');

  const seriesSubjects = [
    { id: 'sub-comp-123', name: 'Computer' },
    { id: 'sub-gk-456', name: 'General Awareness' },
    { id: 'sub-reas-789', name: 'Reasoning' },
  ];

  // 1. Text Parsing Test with Subject Headers and Hindi & English
  console.log('\n[Test 1] Testing Text Question Extraction:');
  const sampleText = `
COMPUTER

Q1. CPU का पूरा नाम क्या है?
A. Central Processing Unit
B. Computer Processing Unit
C. Central Program Unit
D. Control Processing Unit
Answer: A
Explanation: CPU is the Central Processing Unit of a computer.

Q2. What does RAM stand for?
(A) Random Access Memory
(B) Read Access Memory
(C) Rapid Access Memory
(D) Real Application Module
Ans: A

GENERAL AWARENESS

3. भारत का राष्ट्रीय पशु कौन है?
A) शेर
B) बाघ
C) हाथी
D) हिरण
उत्तर: B

4. Incomplete Question Test (Missing Option D and Answer)
A. Option 1
B. Option 2
C. Option 3
`;

  const textBuffer = Buffer.from(sampleText, 'utf-8');
  const res1 = await parseQuestionFile(textBuffer, 'questions.txt', {
    seriesSubjects,
    defaultMarks: 1,
    defaultNegativeMarks: 0.25,
  });

  console.log('Result 1 Success:', res1.success);
  console.log('Questions detected:', res1.questions_detected);
  console.log('Valid count:', res1.valid_questions_count);
  console.log('Needs review count:', res1.needs_review_count);
  console.log('Detected subjects:', res1.detected_subjects);

  res1.questions.forEach((q, i) => {
    console.log(`\n  Q${i + 1}: ${q.question_text.slice(0, 40)}...`);
    console.log(`    Subject: "${q.subject_name}" (ID: ${q.subject_id})`);
    console.log(`    Answer: ${q.correct_option}, Status: ${q.status}`);
    if (q.validation_issues.length > 0) {
      console.log(`    Issues: ${q.validation_issues.join(', ')}`);
    }
  });

  if (res1.questions.length !== 4) throw new Error('Expected 4 questions detected');
  if (res1.questions[0].subject_id !== 'sub-comp-123') throw new Error('Q1 should match Computer');
  if (res1.questions[0].correct_option !== 'A') throw new Error('Q1 answer should be A');
  if (res1.questions[1].subject_id !== 'sub-comp-123') throw new Error('Q2 should match Computer');
  if (res1.questions[2].subject_id !== 'sub-gk-456') throw new Error('Q3 should match General Awareness');
  if (res1.questions[2].correct_option !== 'B') throw new Error('Q3 answer should be B');
  if (res1.questions[3].status !== 'needs_review') throw new Error('Q4 should need review');

  console.log('\n✅ Test 1 Passed!');

  // 2. Excel (XLSX) Test with 50 questions simulation
  console.log('\n[Test 2] Testing Excel Parsing with Column Mapping & 50 Questions:');
  const excelData = [
    ['Subject', 'Question Text', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Explanation'],
  ];

  for (let i = 1; i <= 50; i++) {
    const sub = i <= 20 ? 'Computer' : i <= 35 ? 'General Awareness' : 'Reasoning';
    excelData.push([
      sub,
      `What is test question number ${i}?`,
      `Choice A for Q${i}`,
      `Choice B for Q${i}`,
      `Choice C for Q${i}`,
      `Choice D for Q${i}`,
      ['A', 'B', 'C', 'D'][i % 4],
      `Explanation for question ${i}`,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const res2 = await parseQuestionFile(xlsxBuf, 'test_50_questions.xlsx', {
    seriesSubjects,
    defaultMarks: 1,
    defaultNegativeMarks: 0,
  });

  console.log('Result 2 Success:', res2.success);
  console.log('Questions detected:', res2.questions_detected);
  console.log('Valid count:', res2.valid_questions_count);
  console.log('Needs review count:', res2.needs_review_count);
  console.log('Detected mapping:', res2.detected_column_mapping);

  if (res2.questions_detected !== 50) throw new Error('Expected 50 questions from Excel');
  if (res2.valid_questions_count !== 50) throw new Error('All 50 questions should be valid');

  console.log('\n✅ Test 2 (50 Questions Excel) Passed!');

  // 3. Duplicate Detection Test
  console.log('\n[Test 3] Testing Duplicate Detection:');
  const existingQuestions = [{ id: 'exist-1', question_text: 'What is CPU?' }];

  const dupText = `
Q1. What is CPU?
A. Central Processing Unit
B. Computer Processing Unit
C. Central Program Unit
D. Control Processing Unit
Answer: A
`;
  const dupBuf = Buffer.from(dupText, 'utf-8');
  const res3 = await parseQuestionFile(dupBuf, 'dup.txt', {
    seriesSubjects,
    existingQuestions,
    defaultSubjectId: 'sub-comp-123',
  });

  console.log('Duplicate detected status:', res3.questions[0].status);
  console.log('Duplicate is_duplicate:', res3.questions[0].is_duplicate);
  console.log('Duplicate issues:', res3.questions[0].validation_issues);

  if (!res3.questions[0].is_duplicate) throw new Error('Should detect duplicate question');
  console.log('\n✅ Test 3 (Duplicate Detection) Passed!');

  console.log('\n🎉 ALL SMART PARSER ENGINE TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
