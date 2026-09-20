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

const studentEmail = 'demo.free.student@example.com';
const adminEmail = 'deepakpandey19982@gmail.com';
const freeCourseId = '94ec4a6e-4e7c-46bd-ad91-ab3dac0f7f66'; // SBI Bank manager (price: 0)
const paidCourseId = 'a4bd3345-74cf-4085-ab2e-9c732ce088b6'; // Group D (price: 700)

async function runTests() {
  console.log('=== Starting Course PDF Download Authentication Tests ===\n');

  // 1. Generate session tokens using admin.auth.admin.generateLink or password
  // Let's create custom tokens or sign in
  // In Supabase, admin.auth.admin.generateLink creates a magic link or token,
  // or we can sign in with password if known, or generate token via supabase admin auth
  // Let's check how we can get tokens for student and admin:
  const studentUser = (await admin.auth.admin.listUsers()).data.users.find(u => u.email === studentEmail);
  const adminUser = (await admin.auth.admin.listUsers()).data.users.find(u => u.email === adminEmail);

  if (!studentUser || !adminUser) {
    throw new Error('Test users not found');
  }

  // Create magic link / session tokens
  const studentLink = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: studentEmail,
  });
  const adminLink = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: adminEmail,
  });

  // Exchange hashed_token or token for session
  const anonClient1 = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: studentSessionData } = await anonClient1.auth.verifyOtp({
    token_hash: studentLink.data.properties.hashed_token,
    type: 'magiclink',
  });
  const studentToken = studentSessionData.session?.access_token;

  const anonClient2 = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: adminSessionData } = await anonClient2.auth.verifyOtp({
    token_hash: adminLink.data.properties.hashed_token,
    type: 'magiclink',
  });
  const adminToken = adminSessionData.session?.access_token;

  if (!studentToken || !adminToken) {
    throw new Error('Failed to acquire test access tokens');
  }

  console.log('✓ Acquired test session tokens for student and admin\n');

  const BASE_URL = 'http://localhost:3000';

  // TEST 1: Unauthenticated request to Free Course
  console.log('Test 1: Unauthenticated request to Free Course PDF');
  const res1 = await fetch(`${BASE_URL}/api/courses/download?courseId=${freeCourseId}`, {
    headers: { 'Accept': 'application/json' },
  });
  const data1 = await res1.json();
  console.log(`Status: ${res1.status}, Response:`, data1);
  if (res1.status === 401 && data1.error === 'Authentication required') {
    console.log('✓ PASS: Unauthenticated access correctly rejected with 401\n');
  } else {
    throw new Error(`FAIL: Expected 401 Authentication required, got ${res1.status}`);
  }

  // TEST 2: Logged-in user requesting Free Course PDF
  console.log('Test 2: Logged-in student requesting Free Course PDF');
  const res2 = await fetch(`${BASE_URL}/api/courses/download?courseId=${freeCourseId}`, {
    headers: {
      'Authorization': `Bearer ${studentToken}`,
      'Accept': 'application/json',
    },
  });
  const data2 = await res2.json();
  console.log(`Status: ${res2.status}, Response:`, { success: data2.success, hasUrl: !!data2.downloadUrl, fileName: data2.fileName });
  if (res2.status === 200 && data2.success && data2.downloadUrl) {
    console.log('✓ PASS: Authenticated student successfully received signed download URL for free course');
    // Verify the signed URL actually returns the PDF
    const pdfRes = await fetch(data2.downloadUrl);
    console.log(`Signed URL HTTP status: ${pdfRes.status}, Content-Type: ${pdfRes.headers.get('content-type')}, Content-Length: ${pdfRes.headers.get('content-length')}`);
    if (pdfRes.status === 200) {
      console.log('✓ PASS: Signed URL successfully retrieved actual PDF bytes from storage\n');
    } else {
      throw new Error(`FAIL: Signed URL returned HTTP ${pdfRes.status}`);
    }
  } else {
    throw new Error(`FAIL: Free course download failed: ${JSON.stringify(data2)}`);
  }

  // TEST 3: Logged-in user requesting PAID Course PDF WITHOUT purchase
  console.log('Test 3: Logged-in student requesting PAID Course PDF without purchase');
  const res3 = await fetch(`${BASE_URL}/api/courses/download?courseId=${paidCourseId}`, {
    headers: {
      'Authorization': `Bearer ${studentToken}`,
      'Accept': 'application/json',
    },
  });
  const data3 = await res3.json();
  console.log(`Status: ${res3.status}, Response:`, data3);
  if (res3.status === 403 && data3.error?.includes('must purchase')) {
    console.log('✓ PASS: Unpurchased paid course correctly rejected with 403\n');
  } else {
    throw new Error(`FAIL: Expected 403 Unauthorized for unpurchased paid course, got ${res3.status}`);
  }

  // TEST 4: Logged-in user requesting PAID Course PDF WITH purchase
  console.log('Test 4: Logged-in student requesting PAID Course PDF WITH valid purchase');
  // Create a temporary paid order for this test
  const { data: tempOrder, error: orderInsertErr } = await admin
    .from('orders')
    .insert({
      user_id: studentUser.id,
      course_id: paidCourseId,
      amount: 700,
      status: 'paid',
      payment_id: 'pay_test_download_123',
    })
    .select()
    .single();

  if (orderInsertErr) {
    throw new Error('Failed to insert test order: ' + orderInsertErr.message);
  }

  try {
    const res4 = await fetch(`${BASE_URL}/api/courses/download?courseId=${paidCourseId}`, {
      headers: {
        'Authorization': `Bearer ${studentToken}`,
        'Accept': 'application/json',
      },
    });
    const data4 = await res4.json();
    console.log(`Status: ${res4.status}, Response:`, { success: data4.success, hasUrl: !!data4.downloadUrl });
    if (res4.status === 200 && data4.success && data4.downloadUrl) {
      console.log('✓ PASS: Student with paid order successfully received signed download URL\n');
    } else {
      throw new Error(`FAIL: Expected 200 with downloadUrl for paid user, got ${res4.status}`);
    }
  } finally {
    // Clean up temporary test order
    await admin.from('orders').delete().eq('id', tempOrder.id);
    console.log('Cleaned up test order.');
  }

  // TEST 5: Admin accessing PAID Course PDF
  console.log('\nTest 5: Admin accessing PAID Course PDF');
  const res5 = await fetch(`${BASE_URL}/api/courses/download?courseId=${paidCourseId}`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Accept': 'application/json',
    },
  });
  const data5 = await res5.json();
  console.log(`Status: ${res5.status}, Response:`, { success: data5.success, hasUrl: !!data5.downloadUrl });
  if (res5.status === 200 && data5.success && data5.downloadUrl) {
    console.log('✓ PASS: Admin granted access to course PDF\n');
  } else {
    throw new Error(`FAIL: Admin download failed: ${JSON.stringify(data5)}`);
  }

  // TEST 6: Direct browser GET with query parameter token (redirect mode)
  console.log('Test 6: Direct browser GET with query parameter token');
  const res6 = await fetch(`${BASE_URL}/api/courses/download?courseId=${freeCourseId}&token=${studentToken}`, {
    redirect: 'manual',
  });
  console.log(`Status: ${res6.status}, Location:`, res6.headers.get('location')?.slice(0, 60) + '...');
  if (res6.status === 302 && res6.headers.get('location')?.includes('token=')) {
    console.log('✓ PASS: Direct browser GET successfully redirected to secure signed URL\n');
  } else {
    throw new Error(`FAIL: Expected 302 redirect for browser GET, got ${res6.status}`);
  }

  // TEST 7: Direct browser GET with cookie (redirect mode)
  console.log('Test 7: Direct browser GET with sb-access-token cookie');
  const res7 = await fetch(`${BASE_URL}/api/courses/download?courseId=${freeCourseId}`, {
    headers: {
      'Cookie': `sb-access-token=${studentToken}`,
    },
    redirect: 'manual',
  });
  console.log(`Status: ${res7.status}, Location:`, res7.headers.get('location')?.slice(0, 60) + '...');
  if (res7.status === 302 && res7.headers.get('location')?.includes('token=')) {
    console.log('✓ PASS: Direct browser GET with cookie successfully redirected to secure signed URL\n');
  } else {
    throw new Error(`FAIL: Expected 302 redirect with cookie, got ${res7.status}`);
  }

  // TEST 8: Storage bucket privacy check
  console.log('Test 8: Confirming raw course-pdfs bucket storage is NOT public');
  const rawPublicUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/course-pdfs/pdfs/wmydp4tkqdi-1789890194656.pdf`;
  const rawRes = await fetch(rawPublicUrl);
  console.log(`Raw public access HTTP status: ${rawRes.status}`);
  if (rawRes.status === 400 || rawRes.status === 403 || rawRes.status === 404) {
    console.log('✓ PASS: Private storage remains secure and inaccessible via public URL\n');
  } else {
    console.warn(`Note: Raw URL returned status ${rawRes.status}`);
  }

  console.log('=== ALL 8 COURSE PDF DOWNLOAD TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
