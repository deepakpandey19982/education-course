import { parseQuestionFile, parseExcelOrCsv, extractQuestionsFromText, parsePdf } from '../src/lib/question-parser';
import * as XLSX from 'xlsx';

async function runComprehensiveTests() {
  console.log('=====================================================');
  console.log('COMPREHENSIVE TEST: SMART QUESTION IMPORT SYSTEM');
  console.log('=====================================================');

  const testSubjects = [
    { id: 'sub-comp', name: 'Computer' },
    { id: 'sub-gk', name: 'General Awareness' },
    { id: 'sub-reasoning', name: 'Reasoning' },
  ];

  // -----------------------------------------------------------------
  // 1. SCALING TEST: 100 Questions Import via Excel
  // -----------------------------------------------------------------
  console.log('\n[TEST 1] 100-Question Excel Scalability & Subject Mapping:');
  const headers = ['Subject', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Explanation'];
  const rows = [headers];

  for (let i = 1; i <= 100; i++) {
    const subjectName = i <= 40 ? 'Computer' : i <= 70 ? 'General Awareness' : 'Reasoning';
    rows.push([
      subjectName,
      `What is test question number ${i} for ${subjectName}?`,
      `Option Alpha for Q${i}`,
      `Option Beta for Q${i}`,
      `Option Gamma for Q${i}`,
      `Option Delta for Q${i}`,
      ['A', 'B', 'C', 'D'][(i - 1) % 4],
      `Comprehensive explanation for Q${i}.`,
    ]);
  }

  const ws100 = XLSX.utils.aoa_to_sheet(rows);
  const wb100 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb100, ws100, 'Questions');
  const buf100 = XLSX.write(wb100, { type: 'buffer', bookType: 'xlsx' });

  const result100 = await parseQuestionFile(buf100, 'exam_paper_100.xlsx', {
    seriesSubjects: testSubjects,
    defaultMarks: 1,
    defaultNegativeMarks: 0.25,
  });

  console.log(`- Questions detected: ${result100.questions_detected} / 100`);
  console.log(`- Valid questions count: ${result100.valid_questions_count}`);
  console.log(`- Needs review count: ${result100.needs_review_count}`);
  console.log(`- Detected column mapping:`, result100.detected_column_mapping);

  const compCount = result100.questions.filter((q) => q.subject_id === 'sub-comp').length;
  const gkCount = result100.questions.filter((q) => q.subject_id === 'sub-gk').length;
  const reasoningCount = result100.questions.filter((q) => q.subject_id === 'sub-reasoning').length;

  console.log(`- Subject distribution: Computer=${compCount}, GK=${gkCount}, Reasoning=${reasoningCount}`);

  if (result100.questions_detected !== 100) throw new Error('Failed 100-question detection');
  if (compCount !== 40 || gkCount !== 30 || reasoningCount !== 30) {
    throw new Error('Failed subject distribution matching for 100 questions');
  }
  console.log('✅ TEST 1 PASSED: 100 questions cleanly parsed and mapped to subjects!');

  // -----------------------------------------------------------------
  // 2. CSV IMPORT TEST: Tolerant Column Names & Hindi Text
  // -----------------------------------------------------------------
  console.log('\n[TEST 2] CSV Format with Hindi and Varied Column Names:');
  const csvContent = `topic,q,opt_a,opt_b,opt_c,opt_d,ans,solution
Computer,कंप्यूटर का जनक किसे कहा जाता है?,चार्ल्स बैबेज,एलन ट्यूरिंग,बिल गेट्स,स्टीव जॉब्स,A,चार्ल्स बैबेज को कंप्यूटर का पिता कहा जाता है।
General Awareness,उत्तर प्रदेश की राजधानी क्या है?,प्रयागराज,लखनऊ,वाराणसी,कानपुर,B,लखनऊ उत्तर प्रदेश की राजधानी है।
`;

  const csvBuf = Buffer.from(csvContent, 'utf-8');
  const resultCsv = await parseQuestionFile(csvBuf, 'hindi_questions.csv', {
    seriesSubjects: testSubjects,
  });

  console.log(`- CSV Questions detected: ${resultCsv.questions_detected}`);
  console.log(`- Valid questions count: ${resultCsv.valid_questions_count}`);
  console.log(`- Q1 Text: ${resultCsv.questions[0].question_text}`);
  console.log(`- Q1 Option A: ${resultCsv.questions[0].option_a}`);
  console.log(`- Q1 Answer: ${resultCsv.questions[0].correct_option}`);
  console.log(`- Q1 Subject: ${resultCsv.questions[0].subject_name}`);

  if (resultCsv.questions_detected !== 2 || resultCsv.valid_questions_count !== 2) {
    throw new Error('CSV parsing failed for Hindi questions');
  }
  console.log('✅ TEST 2 PASSED: CSV with varied column names and Hindi characters passed!');

  // -----------------------------------------------------------------
  // 3. TEXT & PDF QUESTION EXTRACTION TEST:
  // Formats: Q1., 1), A., A), Ans: B, Answer: B, Hindi क-घ options
  // -----------------------------------------------------------------
  console.log('\n[TEST 3] Formats, Variations & Hindi Option Numbering:');
  const variedText = `
Subject: Reasoning

Q1. यदि A = 1, B = 2, तो C = ?
(A) 2
(B) 3
(C) 4
(D) 5
Answer: B
Explanation: C वर्णमाला का तीसरा अक्षर है।

2) फाइंड द ऑड वन आउट:
क. सेब
ख. केला
ग. गाजर
घ. अंगूर
उत्तर: C
व्याख्या: गाजर एक सब्जी है जबकि अन्य सभी फल हैं।

Q. 3 What is the primary function of an operating system?
A. Manage computer hardware and software resources
B. Compile source code
C. Design graphic user interface
D. Connect to internet only
Ans - A
`;

  const textBuf = Buffer.from(variedText, 'utf-8');
  const resultVaried = await parseQuestionFile(textBuf, 'varied_formats.txt', {
    seriesSubjects: testSubjects,
  });

  console.log(`- Varied Questions detected: ${resultVaried.questions_detected}`);
  console.log(`- Valid questions count: ${resultVaried.valid_questions_count}`);

  if (resultVaried.questions_detected !== 3 || resultVaried.valid_questions_count !== 3) {
    throw new Error('Varied format text extraction failed');
  }
  if (resultVaried.questions[1].option_a !== 'सेब' || resultVaried.questions[1].correct_option !== 'C') {
    throw new Error('Hindi options क-घ extraction failed');
  }
  console.log('✅ TEST 3 PASSED: All formatting variations & Hindi options succeeded!');

  // -----------------------------------------------------------------
  // 4. VALIDATION & NEEDS REVIEW TEST: Missing Fields Detection
  // -----------------------------------------------------------------
  console.log('\n[TEST 4] Validation & Needs Review Handling:');
  const incompleteText = `
Q1. Valid complete question
A. Opt 1
B. Opt 2
C. Opt 3
D. Opt 4
Answer: A

Q2. Question with missing Option D and Missing Answer
A. Opt 1
B. Opt 2
C. Opt 3

Q3.
A. Alpha
B. Beta
C. Gamma
D. Delta
Answer: C
`;

  const incBuf = Buffer.from(incompleteText, 'utf-8');
  const resultInc = await parseQuestionFile(incBuf, 'incomplete.txt', {
    seriesSubjects: testSubjects,
    defaultSubjectId: 'sub-comp',
  });

  console.log(`- Total detected: ${resultInc.questions_detected}`);
  console.log(`- Valid: ${resultInc.valid_questions_count}`);
  console.log(`- Needs Review: ${resultInc.needs_review_count}`);

  const q2 = resultInc.questions[1];
  console.log(`- Q2 Issues:`, q2.validation_issues);

  if (resultInc.valid_questions_count !== 1) {
    throw new Error('Expected exactly 1 valid question in incomplete set');
  }
  if (resultInc.needs_review_count !== 2) {
    throw new Error('Expected 2 questions flagged as Needs Review');
  }
  if (!q2.validation_issues.includes('Missing Option D') || !q2.validation_issues.includes('Missing Correct Answer')) {
    throw new Error('Failed to correctly identify missing Option D and missing Answer in Q2');
  }
  console.log('✅ TEST 4 PASSED: Missing fields properly flagged with Needs Review!');

  // -----------------------------------------------------------------
  // 5. DUPLICATE DETECTION TEST
  // -----------------------------------------------------------------
  console.log('\n[TEST 5] Duplicate Detection (Database & Intra-Batch):');
  const existingDatabaseQuestions = [
    { question_text: 'What is the full form of HTML?' },
  ];

  const dupText = `
Q1. What is the full form of HTML?
A. Hyper Text Markup Language
B. High Text Markup Language
C. Hyper Tabular Multi Language
D. None of the above
Answer: A

Q2. What is the full form of HTML?
A. Hyper Text Markup Language
B. High Text Markup Language
C. Hyper Tabular Multi Language
D. None of the above
Answer: A
`;

  const dupBuf = Buffer.from(dupText, 'utf-8');
  const resultDup = await parseQuestionFile(dupBuf, 'duplicate_test.txt', {
    seriesSubjects: testSubjects,
    existingQuestions: existingDatabaseQuestions,
    defaultSubjectId: 'sub-comp',
  });

  console.log(`- Duplicate count: ${resultDup.duplicate_count}`);
  console.log(`- Q1 is duplicate: ${resultDup.questions[0].is_duplicate} (DB duplicate)`);
  console.log(`- Q2 is duplicate: ${resultDup.questions[1].is_duplicate} (Intra-batch duplicate)`);

  if (resultDup.duplicate_count !== 2) {
    throw new Error('Duplicate detection failed');
  }
  console.log('✅ TEST 5 PASSED: Both existing DB duplicates and intra-batch duplicates detected!');

  // -----------------------------------------------------------------
  // 6. SYNTHETIC PDF EXTRACTION TEST
  // -----------------------------------------------------------------
  console.log('\n[TEST 6] PDF Document Text Parsing:');
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 12 Tf
50 750 Td
(Q1. Which protocol is used to browse websites?) Tj
0 -20 Td
(A. HTTP) Tj
0 -20 Td
(B. FTP) Tj
0 -20 Td
(C. SMTP) Tj
0 -20 Td
(D. SNMP) Tj
0 -20 Td
(Answer: A) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000494 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
576
%%EOF`;

  const pdfBuf = Buffer.from(pdfString);
  const pdfParsed = await parsePdf(pdfBuf, { defaultMarks: 1 });
  console.log(`- PDF Pages processed: ${pdfParsed.pagesProcessed}`);
  console.log(`- PDF Questions detected: ${pdfParsed.questions.length}`);
  console.log(`- PDF Parsing method: ${pdfParsed.parsingMethod}`);

  if (pdfParsed.questions.length !== 1 || pdfParsed.questions[0].correct_option !== 'A') {
    throw new Error('PDF parsing failed');
  }
  console.log('✅ TEST 6 PASSED: PDF parsing succeeded!');

  console.log('\n=====================================================');
  console.log('🎉 ALL 6 COMPREHENSIVE IMPORT TESTS PASSED PERFECTLY!');
  console.log('=====================================================');
}

runComprehensiveTests().catch((err) => {
  console.error('Comprehensive test failed:', err);
  process.exit(1);
});
