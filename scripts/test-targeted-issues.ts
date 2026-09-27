import fs from 'fs';
import '../src/lib/question-parser/pdf-parser';
import { parseQuestionFile } from '../src/lib/question-parser';

const REAL_PDF_PATH =
  'C:\\Users\\deepa\\Downloads\\UP Police Practice Set in Hindi PDF Download By Disha Publication (sscstudy.com).pdf';

async function main() {
  const buf = fs.readFileSync(REAL_PDF_PATH);

  console.log('Testing range 75 to 125...');
  const res = await parseQuestionFile(buf, 'sample.pdf', {
    fromQuestion: 75,
    toQuestion: 125,
    sectionId: 'sec-1',
  });

  console.log(`Found ${res.questions.length} questions in range 75-125.`);

  const targets = [83, 93, 94, 100, 104, 107, 114, 115];
  for (const n of targets) {
    const q = res.questions.find((x) => x.question_number === n);
    console.log(`\n================== QUESTION ${n} ==================`);
    if (!q) {
      console.log('NOT FOUND!');
    } else {
      console.log(`Status: ${q.status}`);
      console.log(`Issues:`, q.validation_issues);
      console.log(`Has Question Diagram/Image: ${Boolean(q.question_image_url)}`);
      if (q.question_image_url) {
        console.log(`Question Image prefix: ${q.question_image_url.slice(0, 30)}... (length: ${q.question_image_url.length})`);
      }
      console.log(`Text:\n${q.question_text}`);
      if (n === 83) {
        console.log('Q83 chars:');
        for (let i = 0; i < q.question_text.length; i++) {
          console.log(`[${i}] ${q.question_text[i]} U+${q.question_text.charCodeAt(i).toString(16).padStart(4, '0')}`);
        }
      }
      console.log(`(A): [text: "${q.option_a}"] [img: ${Boolean(q.option_a_image_url)}]`);
      console.log(`(B): [text: "${q.option_b}"] [img: ${Boolean(q.option_b_image_url)}]`);
      console.log(`(C): [text: "${q.option_c}"] [img: ${Boolean(q.option_c_image_url)}]`);
      console.log(`(D): [text: "${q.option_d}"] [img: ${Boolean(q.option_d_image_url)}]`);
      console.log(`Answer: ${q.correct_option}`);
    }
  }
}

main().catch(console.error);
