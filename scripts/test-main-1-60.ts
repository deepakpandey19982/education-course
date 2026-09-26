import fs from 'fs';
import { parseQuestionFile } from '../src/lib/question-parser';

const REAL_PDF_PATH =
  'C:\\Users\\deepa\\Downloads\\UP Police Practice Set in Hindi PDF Download By Disha Publication (sscstudy.com).pdf';

async function main() {
  const buf = fs.readFileSync(REAL_PDF_PATH);
  console.log('Testing parseQuestionFile(1 to 60)...');
  const t0 = Date.now();
  const res = await parseQuestionFile(buf, 'sample.pdf', {
    fromQuestion: 1,
    toQuestion: 60,
    sectionId: 'sec-1',
  });
  console.log(`Execution time: ${Date.now() - t0}ms`);
  console.log(`Questions found: ${res.questions.length}`);
  console.log(`Is range complete: ${res.is_range_complete}`);
  console.log(`Missing numbers: ${res.missing_question_numbers}`);

  const targets = [1, 2, 3, 6, 7, 9, 10, 13, 14, 15, 19, 23, 49, 56, 57, 58, 59, 60];
  for (const n of targets) {
    const q = res.questions.find((x) => x.question_number === n);
    console.log(`\n================== QUESTION ${n} ==================`);
    if (!q) {
      console.log('NOT FOUND!');
    } else {
      console.log(`Status: ${q.status}`);
      console.log(`Issues:`, q.validation_issues);
      console.log(`Text:\n${q.question_text}`);
      console.log(`(A): ${q.option_a}`);
      console.log(`(B): ${q.option_b}`);
      console.log(`(C): ${q.option_c}`);
      console.log(`(D): ${q.option_d}`);
      console.log(`Answer: ${q.correct_option}`);
    }
  }
}

main().catch(console.error);
