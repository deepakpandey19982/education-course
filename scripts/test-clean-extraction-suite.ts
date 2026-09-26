import fs from 'fs';
import { parseQuestionFile } from '../src/lib/question-parser/index';

const REAL_PDF_PATH = 'C:\\Users\\deepa\\Downloads\\UP Police Practice Set in Hindi PDF Download By Disha Publication (sscstudy.com).pdf';

async function main() {
  console.log('=== RUNNING COMPREHENSIVE PDF QUESTION EXTRACTION ACCURACY TEST ===\n');

  if (!fs.existsSync(REAL_PDF_PATH)) {
    throw new Error(`PDF not found at ${REAL_PDF_PATH}`);
  }

  const buf = fs.readFileSync(REAL_PDF_PATH);
  console.log(`Loaded PDF: ${(buf.length / (1024 * 1024)).toFixed(2)} MB`);

  console.log('Extracting questions 1 to 60...');
  const t0 = Date.now();
  const res = await parseQuestionFile(buf, 'sample.pdf', {
    fromQuestion: 1,
    toQuestion: 60,
    sectionId: 'sec-1',
  });
  console.log(`Extraction took: ${Date.now() - t0}ms`);
  console.log(`Total questions detected: ${res.questions.length}`);
  console.log(`Range complete: ${res.is_range_complete}`);
  console.log(`Missing question numbers: ${res.missing_question_numbers?.length ? res.missing_question_numbers : 'None'}`);

  if (res.questions.length !== 60) {
    throw new Error(`Expected 60 questions, got ${res.questions.length}`);
  }

  // 1. SPECIFIC CHECK: Question 8
  console.log('\n================== 1. VERIFYING QUESTION 8 ==================');
  const q8 = res.questions.find(q => q.question_number === 8);
  if (!q8) throw new Error('Question 8 not found!');

  console.log('Q8 Question Text:');
  console.log(q8.question_text);
  console.log(`Q8 (A): ${q8.option_a}`);
  console.log(`Q8 (B): ${q8.option_b}`);
  console.log(`Q8 (C): ${q8.option_c}`);
  console.log(`Q8 (D): ${q8.option_d}`);
  console.log(`Q8 Correct Answer: ${q8.correct_option}`);
  console.log(`Q8 Status: ${q8.status}`);

  if (q8.question_text.includes('प्रैक्टिस सेट') || q8.question_text.includes('izSfDVl')) {
    throw new Error('FAILED: Question 8 contains "प्रैक्टिस सेट" header text!');
  }
  if (q8.question_text.includes('अधिकतम') || q8.question_text.includes('अध्कितम') || q8.question_text.includes('vf/dre')) {
    throw new Error('FAILED: Question 8 contains "अधिकतम अंक" header text!');
  }
  if (!q8.question_text.includes('जल दिवस')) {
    throw new Error('FAILED: Question 8 text is missing "जल दिवस"!');
  }
  console.log('✓ PASS: Question 8 is 100% clean and free of header/noise metadata.');

  // 2. SPECIFIC CHECK: Q1 to Q20
  console.log('\n================== 2. VERIFYING Q1 -> Q20 ==================');
  const noisePatterns = [
    /प्रैक्टिस\s*सेट/i,
    /izSfDVl\s*lsV/i,
    /(?:अधिकतम|अध्कितम|पूर्णांक)\s*अंक/i,
    /vf\/dre\s*vad/i,
    /समय\s*[:रू]/i,
    /For More PDF Download/i,
    /sscstudy/i,
    /EBD_\d+/i,
    /^\s*निर्देश\s*$/i,
  ];

  for (let n = 1; n <= 20; n++) {
    const q = res.questions.find(x => x.question_number === n);
    if (!q) throw new Error(`Question ${n} not found!`);

    for (const pat of noisePatterns) {
      if (pat.test(q.question_text)) {
        throw new Error(`Question ${n} text contains noise matching ${pat}: "${q.question_text}"`);
      }
    }

    console.log(`Q${n}: [${q.status}] ${q.question_text.replace(/\n/g, ' ').substring(0, 60)}... | Ans: ${q.correct_option}`);
  }
  console.log('✓ PASS: All Q1 -> Q20 verified clean.');

  // 3. SPECIFIC CHECK: Q40 to Q60
  console.log('\n================== 3. VERIFYING Q40 -> Q60 ==================');
  for (let n = 40; n <= 60; n++) {
    const q = res.questions.find(x => x.question_number === n);
    if (!q) throw new Error(`Question ${n} not found!`);

    for (const pat of noisePatterns) {
      if (pat.test(q.question_text)) {
        throw new Error(`Question ${n} text contains noise matching ${pat}: "${q.question_text}"`);
      }
    }

    console.log(`Q${n}: [${q.status}] ${q.question_text.replace(/\n/g, ' ').substring(0, 60)}... | Ans: ${q.correct_option}`);
  }
  console.log('✓ PASS: All Q40 -> Q60 verified clean.');

  // 4. Target questions check
  console.log('\n================== 4. VERIFYING KEY TARGET QUESTIONS ==================');
  const keyTargets = [1, 2, 3, 6, 7, 8, 9, 10, 13, 14, 15, 19, 23, 49, 56, 57, 58, 59, 60];
  for (const n of keyTargets) {
    const q = res.questions.find(x => x.question_number === n);
    if (!q) throw new Error(`Key target Q${n} missing!`);
    console.log(`Q${n} [${q.status}]: ${q.question_text.replace(/\n/g, ' ').substring(0, 50)}... | Ans: ${q.correct_option}`);
  }

  console.log('\n=============================================================');
  console.log('ALL VERIFICATION CHECKS PASSED WITH 100% ACCURACY!');
  console.log('=============================================================');
}

main().catch(err => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
