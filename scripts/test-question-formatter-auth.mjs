import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local
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
const studentEmail = 'demo.free.student@example.com';
const REAL_PDF_PATH = 'C:\\Users\\deepa\\Downloads\\UP Police Practice Set in Hindi PDF Download By Disha Publication (sscstudy.com).pdf';
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('=== TESTING QUESTION FORMATTER AUTHENTICATION & POLLING ===\n');

  // 1. Acquire Admin and Student tokens
  console.log('Step 1: Acquiring Admin and Student tokens...');
  const adminLink = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: adminEmail,
  });
  const studentLink = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: studentEmail,
  });

  const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: adminSessionData } = await anonClient.auth.verifyOtp({
    token_hash: adminLink.data.properties.hashed_token,
    type: 'magiclink',
  });
  const adminToken = adminSessionData.session?.access_token;

  const { data: studentSessionData } = await anonClient.auth.verifyOtp({
    token_hash: studentLink.data.properties.hashed_token,
    type: 'magiclink',
  });
  const studentToken = studentSessionData.session?.access_token;

  if (!adminToken) throw new Error('Could not acquire admin token');
  if (!studentToken) throw new Error('Could not acquire student token');
  console.log('✓ Acquired admin and student tokens.\n');

  // 2. Test Unauthenticated Requests
  console.log('Step 2: Testing unauthenticated requests (must return 401)...');
  const unauthCreate = await fetch(`${BASE_URL}/api/admin/question-formatter/jobs/create`, {
    method: 'POST',
  });
  const unauthCreateJson = await unauthCreate.json();
  console.log(`  Unauthenticated create status: ${unauthCreate.status}, error: "${unauthCreateJson.error}"`);
  if (unauthCreate.status !== 401 || unauthCreateJson.error !== 'Authentication required') {
    throw new Error('Unauthenticated create did not return 401 Authentication required');
  }

  const unauthPoll = await fetch(`${BASE_URL}/api/admin/question-formatter/jobs/test-job-id`);
  const unauthPollJson = await unauthPoll.json();
  console.log(`  Unauthenticated poll status: ${unauthPoll.status}, error: "${unauthPollJson.error}"`);
  if (unauthPoll.status !== 401 || unauthPollJson.error !== 'Authentication required') {
    throw new Error('Unauthenticated poll did not return 401 Authentication required');
  }
  console.log('✓ Unauthenticated requests correctly rejected with 401.\n');

  // 3. Test Student Requests (must return 403 Admin privileges required)
  console.log('Step 3: Testing non-admin student requests (must return 403)...');
  const studentCreate = await fetch(`${BASE_URL}/api/admin/question-formatter/jobs/create`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${studentToken}` },
  });
  const studentCreateJson = await studentCreate.json();
  console.log(`  Student create status: ${studentCreate.status}, error: "${studentCreateJson.error}"`);
  if (studentCreate.status !== 403 || studentCreateJson.error !== 'Admin privileges required') {
    throw new Error('Student create did not return 403 Admin privileges required');
  }

  const studentPoll = await fetch(`${BASE_URL}/api/admin/question-formatter/jobs/test-job-id`, {
    headers: { 'Authorization': `Bearer ${studentToken}` },
  });
  const studentPollJson = await studentPoll.json();
  console.log(`  Student poll status: ${studentPoll.status}, error: "${studentPollJson.error}"`);
  if (studentPoll.status !== 403 || studentPollJson.error !== 'Admin privileges required') {
    throw new Error('Student poll did not return 403 Admin privileges required');
  }
  console.log('✓ Student requests correctly rejected with 403.\n');

  // 4. Test Authenticated Admin Workflow with Real PDF via HTTP
  console.log('Step 4: Testing Authenticated Admin Job Flow with real PDF...');
  if (!fs.existsSync(REAL_PDF_PATH)) {
    throw new Error(`Real PDF not found at ${REAL_PDF_PATH}`);
  }

  const pdfBuffer = fs.readFileSync(REAL_PDF_PATH);
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, 'UP_Police_Practice_Set.pdf');
  formData.append('fromQuestion', '1');
  formData.append('toQuestion', '10');
  formData.append('defaultSubjectName', 'General Knowledge');

  console.log('  Submitting job creation request as Admin with Authorization header...');
  const createRes = await fetch(`${BASE_URL}/api/admin/question-formatter/jobs/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
    },
    body: formData,
  });

  const createData = await createRes.json();
  console.log('  Create response:', createRes.status, createData);
  if (!createRes.ok || !createData.jobId) {
    throw new Error(`Job creation failed: ${JSON.stringify(createData)}`);
  }

  const jobId = createData.jobId;
  console.log(`✓ Job created successfully: ${jobId}`);

  // 5. Test Polling with Admin Authentication (Testing both Header and Query Param)
  console.log('\nStep 5: Polling job status using authenticated admin session...');
  let pollCount = 0;
  let jobResult = null;

  while (true) {
    pollCount++;
    // Alternating between header and query param to verify both auth vectors
    const useQueryParam = pollCount % 2 === 0;
    const pollUrl = useQueryParam
      ? `${BASE_URL}/api/admin/question-formatter/jobs/${jobId}?token=${encodeURIComponent(adminToken)}`
      : `${BASE_URL}/api/admin/question-formatter/jobs/${jobId}`;

    const headers = useQueryParam ? {} : { 'Authorization': `Bearer ${adminToken}` };

    const pollRes = await fetch(pollUrl, { headers });
    const pollData = await pollRes.json();

    if (!pollRes.ok) {
      throw new Error(`Polling failed with status ${pollRes.status}: ${JSON.stringify(pollData)}`);
    }

    const job = pollData.job;
    console.log(`  [Poll #${pollCount} via ${useQueryParam ? 'query param' : 'Bearer header'}] Status: ${job.status} (${job.progressPercent}%) - ${job.message}`);

    if (job.status === 'READY_FOR_PREVIEW') {
      jobResult = job.result;
      break;
    }
    if (job.status === 'FAILED') {
      throw new Error(`Job reported FAILED: ${job.error || job.message}`);
    }

    await new Promise(r => setTimeout(r, 600));
  }

  console.log('\n✓ Job completed successfully through authenticated polling!');
  console.log(`  Questions extracted: ${jobResult.questions?.length}`);
  console.log(`  Valid count: ${jobResult.valid_questions_count}`);
  console.log(`  Needs review: ${jobResult.needs_review_count}`);
  const q1 = jobResult.questions[0];
  console.log(`  Sample Q1: "${q1.question_text.slice(0, 60)}..."`);
  console.log(`    A: ${q1.option_a}`);
  console.log(`    B: ${q1.option_b}`);
  console.log(`    C: ${q1.option_c}`);
  console.log(`    D: ${q1.option_d}`);
  console.log(`    Ans: ${q1.correct_option}`);
  console.log(`    Status: ${q1.status}`);

  if (jobResult.questions.length !== 10) {
    throw new Error(`Expected 10 questions, got ${jobResult.questions.length}`);
  }

  // 6. Test Cookie-based Polling (verifying sb-access-token cookie)
  console.log('\nStep 6: Testing cookie-based polling (cookie: sb-access-token)...');
  const cookiePollRes = await fetch(`${BASE_URL}/api/admin/question-formatter/jobs/${jobId}`, {
    headers: {
      'Cookie': `sb-access-token=${adminToken}`,
    },
  });
  const cookiePollData = await cookiePollRes.json();
  console.log(`  Cookie poll status: ${cookiePollRes.status}, Job ID: ${cookiePollData.job?.id}`);
  if (!cookiePollRes.ok || cookiePollData.job?.id !== jobId) {
    throw new Error('Cookie-based polling failed');
  }
  console.log('✓ Cookie-based polling authenticated and succeeded.');

  console.log('\n=== ALL AUTHENTICATION & POLLING TESTS PASSED 100%! ===');
}

main().catch(err => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
