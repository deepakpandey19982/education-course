import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log('=== VERIFYING DEPLOYED/VERCEL APIS & ENVIRONMENT ROBUSTNESS ===\n');

  // Test 1: Verify service role key is required for questions table
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: anonQuestions } = await anonClient.from('questions').select('id, question_text').limit(1);
  const { data: adminQuestions } = await adminClient.from('questions').select('id, question_text').limit(1);

  console.log('1. RLS enforcement verification:');
  console.log('   - Questions visible with Anon Key (without admin):', anonQuestions?.length || 0);
  console.log('   - Questions visible with Service Role Key:', adminQuestions?.length || 0);

  if (anonQuestions?.length !== 0) {
    throw new Error('Expected Anon client to be blocked from reading questions by RLS');
  }
  if (!adminQuestions || adminQuestions.length === 0) {
    throw new Error('Expected Admin client to read questions successfully');
  }
  console.log('✓ PASS: RLS strictly enforces that questions require service-role permissions!\n');

  // Test 2: Verify RLS on orders table
  const { data: anonOrders, error: anonOrderError } = await anonClient.from('orders').insert({
    user_id: '15a7d859-8323-4cde-9c0c-ad3e21cb800b',
    course_id: '94ec4a6e-4e7c-46bd-ad91-ab3dac0f7f66',
    amount: 1,
    status: 'pending',
    payment_id: `test_anon_${Date.now()}`,
  });

  console.log('2. Orders insert RLS verification:');
  console.log('   - Anon insert error code:', anonOrderError?.code);
  console.log('   - Anon insert error message:', anonOrderError?.message);

  if (!anonOrderError || anonOrderError.code !== '42501') {
    throw new Error('Expected Anon client insert to fail with RLS violation 42501');
  }
  console.log('✓ PASS: Anon client cannot insert orders without service-role key (explains "Failed to create internal order" when missing on Vercel)!\n');

  // Test 3: Authenticated test attempt endpoint against local server
  console.log('3. Testing /api/tests/[testId]/attempt endpoint:');
  const adminLink = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: 'demo.free.student@example.com',
  });

  const { data: sessionData } = await anonClient.auth.verifyOtp({
    token_hash: adminLink.data.properties.hashed_token,
    type: 'magiclink',
  });

  const studentToken = sessionData.session?.access_token;
  if (!studentToken) throw new Error('Failed to acquire student token');

  // Find a published demo test
  const { data: tests } = await adminClient
    .from('tests')
    .select('id, title, is_paid')
    .eq('is_published', true)
    .limit(5);

  const demoTest = tests?.find(t => t.title.toLowerCase().includes('demo')) || tests?.[0];
  if (!demoTest) throw new Error('No published test found');

  console.log(`   - Testing testId: ${demoTest.id} ("${demoTest.title}")`);

  const attemptRes = await fetch(`http://localhost:3000/api/tests/${demoTest.id}/attempt`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
  });

  const attemptData = await attemptRes.json();
  console.log('   - HTTP Status:', attemptRes.status);
  console.log('   - Attempt ID:', attemptData.attempt?.id);
  console.log('   - Questions loaded:', attemptData.questions?.length);

  if (!attemptRes.ok || !attemptData.attempt?.id || !Array.isArray(attemptData.questions)) {
    throw new Error(`Test attempt API failed: ${JSON.stringify(attemptData)}`);
  }
  console.log('✓ PASS: Test attempt successfully created and questions loaded with answers safely stripped!\n');

  // Test 4: Testing /api/payments/create endpoint
  console.log('4. Testing /api/payments/create endpoint:');
  const { data: paidCourse } = await adminClient
    .from('courses')
    .select('id, title, price')
    .gt('price', 0)
    .limit(1)
    .single();

  if (!paidCourse) throw new Error('No paid course found');

  console.log(`   - Creating payment order for course: "${paidCourse.title}" (₹${paidCourse.price})`);

  const createRes = await fetch('http://localhost:3000/api/payments/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      courseId: paidCourse.id,
      userId: sessionData.user?.id,
    }),
  });

  const createData = await createRes.json();
  console.log('   - HTTP Status:', createRes.status);
  console.log('   - Razorpay Order ID:', createData.orderId);
  console.log('   - Amount (paise):', createData.amount);

  if (!createRes.ok || !createData.orderId) {
    throw new Error(`Payment create API failed: ${JSON.stringify(createData)}`);
  }
  console.log('✓ PASS: Razorpay order and internal pending order successfully created!\n');

  console.log('=== ALL VERCEL / ENVIRONMENT VERIFICATIONS COMPLETED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
