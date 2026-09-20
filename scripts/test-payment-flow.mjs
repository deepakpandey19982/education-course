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

async function runTests() {
  console.log('=== Starting Payment Flow & Reconciliation Tests ===\n');

  // 1. Get admin user and session token
  const adminUser = (await admin.auth.admin.listUsers()).data.users.find(u => u.email === adminEmail);
  if (!adminUser) throw new Error('Admin user not found');

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
  if (!adminToken) throw new Error('Failed to get admin session token');

  console.log('✓ Acquired admin auth token');

  const BASE_URL = 'http://localhost:3000';

  // TEST 1: Payment verify with invalid signature (Security check)
  console.log('\nTest 1: Payment verify with invalid signature');
  const res1 = await fetch(`${BASE_URL}/api/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      razorpay_order_id: 'order_TeEsE5JVj1pTCO',
      razorpay_payment_id: 'pay_fake_123',
      razorpay_signature: 'fake_signature_hex_12345',
    }),
  });
  const data1 = await res1.json();
  console.log(`Status: ${res1.status}, Response:`, data1);
  if (res1.status === 400 && data1.error === 'Invalid payment signature') {
    console.log('✓ PASS: Invalid signature rejected with 400 (Security intact)');
  } else {
    throw new Error('FAIL: Fake signature was not rejected properly');
  }

  // TEST 2: Payment verify / auto-reconcile real paid live order (order_TeEsE5JVj1pTCO)
  console.log('\nTest 2: Reconciling real live order order_TeEsE5JVj1pTCO');
  const res2 = await fetch(`${BASE_URL}/api/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      orderId: 'order_TeEsE5JVj1pTCO',
    }),
  });
  const data2 = await res2.json();
  console.log(`Status: ${res2.status}, Response:`, data2);
  if (res2.status === 200 && data2.success && data2.order?.status === 'paid') {
    console.log('✓ PASS: Live Razorpay order verified and marked as PAID in database!');
  } else {
    throw new Error('FAIL: Live order verification failed: ' + JSON.stringify(data2));
  }

  // TEST 3: Check admin stats endpoint
  console.log('\nTest 3: Fetching /api/admin/stats');
  const res3 = await fetch(`${BASE_URL}/api/admin/stats`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
    },
  });
  const stats = await res3.json();
  console.log(`Status: ${res3.status}, Stats:`, stats);
  if (res3.status === 200 && stats.totalSales >= 1 && stats.totalRevenue >= 1 && stats.systemStatus.razorpay === 'ACTIVE') {
    console.log('✓ PASS: Admin stats accurately reflects live sales, revenue, and active Razorpay status!');
  } else {
    throw new Error('FAIL: Admin stats incorrect: ' + JSON.stringify(stats));
  }

  // TEST 4: Check purchased courses query for the paying user
  console.log('\nTest 4: Checking purchased courses for user in dashboard query');
  const { data: purchasedCourses, error: pError } = await admin
    .from('orders')
    .select('id, payment_id, status, courses (*)')
    .eq('user_id', adminUser.id)
    .eq('status', 'paid');

  console.log('Purchased courses count:', purchasedCourses?.length);
  if (!pError && purchasedCourses && purchasedCourses.length > 0) {
    console.log('Purchased course title:', purchasedCourses[0].courses?.title);
    console.log('✓ PASS: Purchased course is now actively enrolled and available to user!');
  } else {
    throw new Error('FAIL: No purchased courses found');
  }

  console.log('\n=== ALL PAYMENT VERIFICATION & ADMIN REVENUE TESTS PASSED! ===');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
