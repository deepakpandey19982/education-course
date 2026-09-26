import { parseQuestionFile, extractQuestionsWithRangeFromText } from '../src/lib/question-parser';

async function testPdfRangeImport() {
  console.log('================================================================');
  console.log('TEST SUITE: CREATE TEST SERIES FROM PDF BY QUESTION NUMBER RANGE');
  console.log('================================================================');

  // Construct a synthetic question bank containing 1 to 20 and 101 to 115
  const sampleBank = `
Exam Question Bank 2026
Subject: General Knowledge

Q1. Which planet is known as the Red Planet?
A. Venus
B. Mars
C. Jupiter
D. Saturn
Answer: B
Explanation: Mars appears red because of iron oxide on its surface.

Q. 2 What is the largest ocean on Earth?
(A) Atlantic Ocean
(B) Indian Ocean
(C) Arctic Ocean
(D) Pacific Ocean
Answer: D

Question 3: Who painted the Mona Lisa?
A. Vincent van Gogh
B. Pablo Picasso
C. Leonardo da Vinci
D. Michelangelo
Ans: C

Question No. 4: What is the boiling point of water at standard pressure?
A. 90°C
B. 100°C
C. 120°C
D. 80°C
Answer: B

5. Which element has the chemical symbol 'O'?
(A) Gold
(B) Osmium
(C) Oxygen
(D) Silver
Answer: C

Que. 6 What is the capital of Japan?
A. Seoul
B. Beijing
C. Tokyo
D. Bangkok
Ans: C

7) Which gas do plants absorb during photosynthesis?
A. Oxygen
B. Carbon Dioxide
C. Nitrogen
D. Hydrogen
Answer: B

8. How many continents are there on Earth?
(A) 5
(B) 6
(C) 7
(D) 8
Answer: C

Q9. In which year did India gain independence?
A. 1942
B. 1947
C. 1950
D. 1952
Ans: B

Q10. What is the national flower of India?
A. Rose
B. Lotus
C. Marigold
D. Sunflower
Answer: B

Page 12 of 400 -- Document Header

Subject: Computer Knowledge

Question 101: What does CPU stand for?
A. Central Processing Unit
B. Central Performance Unit
C. Computer Personal Unit
D. Central Power Unit
Answer: A
Explanation: CPU is the primary component that executes instructions.

Question No. 102 - Which memory is volatile?
A. ROM
B. RAM
C. Flash Drive
D. Hard Disk
Ans: B

Q. 103: In binary, what is 1 + 1?
(A) 2
(B) 10
(C) 11
(D) 0
Answer: B

104. What is the main page of a website called?
A. Front Page
B. Home Page
C. First Page
D. Landing Site
Answer: B

प्रश्न 105: कंप्यूटर का 'मस्तिष्क' किसे कहा जाता है?
(A) रैम (RAM)
(B) सीपीयू (CPU)
(C) हार्ड डिस्क (Hard Disk)
(D) मॉनिटर (Monitor)
उत्तर: B
व्याख्या: सीपीयू को कंप्यूटर का दिमाग कहा जाता है।

Q106. What protocol is used to securely transfer web pages?
A. HTTP
B. HTTPS
C. FTP
D. SMTP
Answer: B

107) Which company developed the Android operating system?
A. Apple
B. Microsoft
C. Google
D. IBM
Answer: C

108. What does URL stand for?
A. Uniform Resource Locator
B. Universal Radio Link
C. United Resource Line
D. Unique Resource Link
Answer: A

Q.109 Which key is used to refresh a web page in Windows?
A. F1
B. F5
C. F11
D. F12
Answer: B

110. Which device connects a local network to the internet?
A. Router
B. Monitor
C. Keyboard
D. Mouse
Answer: A

Q111. What is an IPv4 address size?
A. 16 bits
B. 32 bits
C. 64 bits
D. 128 bits
Answer: B

112. Question with incomplete options
A. Only Option A
Answer: A
`;

  // -------------------------------------------------------------
  // TEST 1: Range 1 to 5
  // -------------------------------------------------------------
  console.log('\n[TEST 1] Testing Range 1 → 5:');
  const res1to5 = extractQuestionsWithRangeFromText(sampleBank, {
    fromQuestion: 1,
    toQuestion: 5,
  });

  console.log(`- Requested: ${res1to5.requested_range?.from} → ${res1to5.requested_range?.to}`);
  console.log(`- Total requested: ${res1to5.total_requested}`);
  console.log(`- Questions found: ${res1to5.questions.length}`);
  console.log(`- Found numbers:`, res1to5.found_question_numbers);
  console.log(`- Missing numbers:`, res1to5.missing_question_numbers);
  console.log(`- Range complete:`, res1to5.is_range_complete);

  if (res1to5.questions.length !== 5) {
    throw new Error(`Expected exactly 5 questions for range 1-5, got ${res1to5.questions.length}`);
  }
  if (!res1to5.is_range_complete) {
    throw new Error('Range 1-5 should be complete with 0 missing questions');
  }
  console.log('✅ TEST 1 PASSED: Exactly 5 questions extracted for range 1 → 5!');

  // -------------------------------------------------------------
  // TEST 2: Range 1 to 10
  // -------------------------------------------------------------
  console.log('\n[TEST 2] Testing Range 1 → 10:');
  const res1to10 = extractQuestionsWithRangeFromText(sampleBank, {
    fromQuestion: 1,
    toQuestion: 10,
  });

  console.log(`- Questions found: ${res1to10.questions.length}`);
  console.log(`- Found numbers:`, res1to10.found_question_numbers);
  if (res1to10.questions.length !== 10 || !res1to10.is_range_complete) {
    throw new Error(`Expected 10 complete questions for range 1-10, got ${res1to10.questions.length}`);
  }
  console.log('✅ TEST 2 PASSED: Exactly 10 questions extracted for range 1 → 10!');

  // -------------------------------------------------------------
  // TEST 3: Range 101 to 110 (Verifying question numbers, not pages)
  // -------------------------------------------------------------
  console.log('\n[TEST 3] Testing Range 101 → 110 (Non-page, question number source of truth):');
  const res101to110 = extractQuestionsWithRangeFromText(sampleBank, {
    fromQuestion: 101,
    toQuestion: 110,
  });

  console.log(`- Questions found: ${res101to110.questions.length}`);
  console.log(`- Found numbers:`, res101to110.found_question_numbers);
  console.log(`- Q101 Question:`, res101to110.questions[0].question_text);
  console.log(`- Q105 Hindi Question:`, res101to110.questions[4].question_text);
  console.log(`- Q105 Correct Option:`, res101to110.questions[4].correct_option);

  if (res101to110.questions.length !== 10) {
    throw new Error(`Expected 10 questions for range 101-110, got ${res101to110.questions.length}`);
  }
  if (res101to110.questions[0].question_number !== 101) {
    throw new Error(`First question must be 101, got ${res101to110.questions[0].question_number}`);
  }
  if (res101to110.questions[9].question_number !== 110) {
    throw new Error(`Last question must be 110, got ${res101to110.questions[9].question_number}`);
  }
  console.log('✅ TEST 3 PASSED: Range 101 → 110 found exactly by Question Number!');

  // -------------------------------------------------------------
  // TEST 4: Missing Questions Range Validation (Refuse silent partials)
  // -------------------------------------------------------------
  console.log('\n[TEST 4] Testing Missing Range (101 → 120 where 113-120 are missing):');
  const resMissing = extractQuestionsWithRangeFromText(sampleBank, {
    fromQuestion: 101,
    toQuestion: 120,
  });

  console.log(`- Requested range: 101 → 120 (Expected 20 questions)`);
  console.log(`- Found questions: ${resMissing.questions.length}`);
  console.log(`- Is range complete: ${resMissing.is_range_complete}`);
  console.log(`- Missing questions:`, resMissing.missing_question_numbers);

  if (resMissing.is_range_complete) {
    throw new Error('Range 101-120 should be flagged incomplete!');
  }
  if (!resMissing.missing_question_numbers.includes(120) || !resMissing.missing_question_numbers.includes(115)) {
    throw new Error('Missing numbers list must contain missing question numbers (115, 120)');
  }
  console.log('✅ TEST 4 PASSED: Missing questions properly detected and flagged!');

  // -------------------------------------------------------------
  // TEST 5: parseQuestionFile with Range and Subject options (Text / Fallback)
  // -------------------------------------------------------------
  console.log('\n[TEST 5] Testing parseQuestionFile end-to-end with range (Text):');
  const buf = Buffer.from(sampleBank, 'utf-8');
  const parseRes = await parseQuestionFile(buf, 'QuestionBank.txt', {
    fromQuestion: 1,
    toQuestion: 5,
    defaultSubjectName: 'General Knowledge',
  });

  console.log(`- Parse success: ${parseRes.success}`);
  console.log(`- Questions detected: ${parseRes.questions_detected}`);
  console.log(`- Valid questions: ${parseRes.valid_questions_count}`);
  console.log(`- Requested range:`, parseRes.requested_range);
  console.log(`- Total requested: ${parseRes.total_requested}`);
  console.log(`- Is complete: ${parseRes.is_range_complete}`);

  if (parseRes.questions_detected !== 5 || !parseRes.is_range_complete) {
    throw new Error('parseQuestionFile failed to extract range 1-5');
  }
  console.log('✅ TEST 5 PASSED: parseQuestionFile returned complete range info!');

  // -------------------------------------------------------------
  // TEST 6: Real Synthetic PDF Document Text Parsing with Range
  // -------------------------------------------------------------
  console.log('\n[TEST 6] Real Synthetic PDF Document Parsing with Question Range:');
  const pdfContent = `%PDF-1.4
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
<< /Length 380 >>
stream
BT
/F1 12 Tf
50 750 Td
(Q1. Which planet is closest to the Sun?) Tj
0 -20 Td
(A. Venus) Tj
0 -20 Td
(B. Mercury) Tj
0 -20 Td
(C. Mars) Tj
0 -20 Td
(D. Earth) Tj
0 -20 Td
(Answer: B) Tj
0 -30 Td
(Q2. What is the chemical formula for table salt?) Tj
0 -20 Td
(A. NaCl) Tj
0 -20 Td
(B. KCl) Tj
0 -20 Td
(C. H2O) Tj
0 -20 Td
(D. CO2) Tj
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
0000000674 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
756
%%EOF`;

  const pdfBuf = Buffer.from(pdfContent);
  const pdfParseRes = await parseQuestionFile(pdfBuf, 'Sample_Questions.pdf', {
    fromQuestion: 1,
    toQuestion: 2,
    defaultSubjectName: 'Science',
  });

  console.log(`- PDF Parse success: ${pdfParseRes.success}`);
  console.log(`- PDF Questions detected: ${pdfParseRes.questions_detected}`);
  console.log(`- PDF Method: ${pdfParseRes.parsing_method}`);
  console.log(`- PDF Range:`, pdfParseRes.requested_range);
  console.log(`- PDF Is Complete: ${pdfParseRes.is_range_complete}`);
  console.log(`- Q1 Answer: ${pdfParseRes.questions[0]?.correct_option}`);
  console.log(`- Q2 Answer: ${pdfParseRes.questions[1]?.correct_option}`);

  if (pdfParseRes.questions_detected !== 2 || !pdfParseRes.is_range_complete) {
    throw new Error('PDF range parsing failed on synthetic PDF');
  }
  console.log('✅ TEST 6 PASSED: Real PDF parsing with question range succeeded!');

  console.log('\n================================================================');
  console.log('🎉 ALL PDF QUESTION RANGE TESTS PASSED WITH 100% ACCURACY!');
  console.log('================================================================');

}

testPdfRangeImport().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
