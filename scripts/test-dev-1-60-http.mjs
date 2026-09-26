import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const adminEmail = 'deepakpandey19982@gmail.com';
const REAL_PDF_PATH = 'C:\\Users\\deepa\\Downloads\\UP Police Practice Set in Hindi PDF Download By Disha Publication (sscstudy.com).pdf';
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('=== TESTING REAL DEV SERVER HTTP PDF UPLOAD & EXTRACTION (1 -> 60) ===\n');

  console.log('Acquiring admin auth session...');
  const adminLink = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: adminEmail,
  });
  const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: adminSessionData } = await anonClient.auth.verifyOtp({
    token_hash: adminLink.data.properties.hashed_token,
    type: 'magiclink',
  });
  const adminToken = adminSessionData.session?.access_token;
  if (!adminToken) throw new Error('Could not acquire admin token');
  console.log('✓ Admin authenticated.');

  console.log(`Reading PDF from: ${REAL_PDF_PATH}`);
  const pdfBuffer = fs.readFileSync(REAL_PDF_PATH);
  console.log(`File size: ${(pdfBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, 'UP_Police_Practice_Set.pdf');
  formData.append('fromQuestion', '1');
  formData.append('toQuestion', '60');
  formData.append('defaultSubjectName', 'General Knowledge');

  console.log('\nSending POST to /api/admin/question-formatter/jobs/create (Range 1 -> 60)...');
  const createRes = await fetch(`${BASE_URL}/api/admin/question-formatter/jobs/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
    body: formData,
  });

  const createData = await createRes.json();
  console.log(`Create HTTP response status: ${createRes.status}`);
  console.log(`Response payload:`, createData);

  if (!createRes.ok || !createData.jobId) {
    throw new Error(`Job creation failed: ${JSON.stringify(createData)}`);
  }

  const jobId = createData.jobId;
  console.log(`\nJob created successfully with ID: ${jobId}`);
  console.log('Polling job progress...');

  let pollCount = 0;
  while (true) {
    pollCount++;
    const pollRes = await fetch(`${BASE_URL}/api/admin/question-formatter/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pollData = await pollRes.json();
    if (!pollRes.ok) {
      throw new Error(`Polling failed with status ${pollRes.status}: ${JSON.stringify(pollData)}`);
    }

    const job = pollData.job;
    console.log(`[Poll #${pollCount}] Status: ${job.status} (${job.progressPercent}%) - ${job.message}`);

    if (job.status === 'READY_FOR_PREVIEW') {
      console.log('\n=============================================');
      console.log('✓ SUCCESS: PDF PARSING COMPLETED SUCCESSFULLY!');
      console.log('=============================================');
      const res = job.result;
      console.log(`Total questions detected: ${res.questions?.length}`);
      console.log(`Valid count: ${res.valid_questions_count}`);
      console.log(`Needs review count: ${res.needs_review_count}`);
      console.log(`Duplicate count: ${res.duplicate_questions_count}`);
      console.log(`Invalid count: ${res.invalid_questions_count}`);
      console.log(`Range complete: ${res.is_range_complete}`);
      console.log(`Missing numbers: ${res.missing_question_numbers?.length ? res.missing_question_numbers : 'None'}`);

      // Inspect first question and Q49
      const q1 = res.questions.find(q => q.question_number === 1);
      if (q1) {
        console.log('\n--- Question 1 Sample ---');
        console.log(`Text: ${q1.question_text.substring(0, 100)}`);
        console.log(`(A): ${q1.option_a}`);
        console.log(`(B): ${q1.option_b}`);
        console.log(`(C): ${q1.option_c}`);
        console.log(`(D): ${q1.option_d}`);
        console.log(`Answer: ${q1.correct_option}`);
        console.log(`Status: ${q1.status}`);
      }

      const q49 = res.questions.find(q => q.question_number === 49);
      if (q49) {
        console.log('\n--- Question 49 Sample ---');
        console.log(`Text: ${q49.question_text.substring(0, 100)}`);
        console.log(`(A): ${q49.option_a}`);
        console.log(`(B): ${q49.option_b}`);
        console.log(`(C): ${q49.option_c}`);
        console.log(`(D): ${q49.option_d}`);
        console.log(`Answer: ${q49.correct_option}`);
        console.log(`Status: ${q49.status}`);
      }
      break;
    }

    if (job.status === 'FAILED') {
      console.error('\n❌ JOB REPORTED FAILED:');
      console.error(`Error: ${job.error}`);
      console.error(`Message: ${job.message}`);
      throw new Error(`Job execution failed: ${job.error || job.message}`);
    }

    await new Promise(r => setTimeout(r, 800));
  }
}

main().catch(err => {
  console.error('\nFAILED TEST:', err);
  process.exit(1);
});
