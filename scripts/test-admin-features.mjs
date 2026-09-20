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
const freeCourseId = '94ec4a6e-4e7c-46bd-ad91-ab3dac0f7f66'; // SBI Bank manager (price: 0)

async function runTests() {
  console.log('=== Starting Admin Stats & User Management Tests ===\n');

  // 1. Get tokens for Admin and Student
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

  const anonClient2 = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: studentSessionData } = await anonClient2.auth.verifyOtp({
    token_hash: studentLink.data.properties.hashed_token,
    type: 'magiclink',
  });
  const studentToken = studentSessionData.session?.access_token;

  if (!adminToken || !studentToken) {
    throw new Error('Failed to acquire auth tokens');
  }

  console.log('✓ Acquired admin and student tokens\n');

  const BASE_URL = 'http://localhost:3000';

  // TEST 1: Feature 1 - Admin stats anti-caching headers test
  console.log('Test 1: Admin stats anti-caching headers and fresh metrics');
  const statsRes = await fetch(`${BASE_URL}/api/admin/stats?_t=${Date.now()}`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
    },
  });
  const cacheHeader = statsRes.headers.get('cache-control');
  const pragmaHeader = statsRes.headers.get('pragma');
  console.log('Cache-Control header:', cacheHeader);
  console.log('Pragma header:', pragmaHeader);
  if (cacheHeader?.includes('no-store') && cacheHeader?.includes('no-cache')) {
    console.log('✓ PASS: Admin stats explicitly forbids caching for Android WebView\n');
  } else {
    throw new Error('FAIL: Cache-Control missing no-store/no-cache: ' + cacheHeader);
  }

  // TEST 2: Feature 2 - Security: Student cannot access /api/admin/users
  console.log('Test 2: Security check - Non-admin student accessing /api/admin/users');
  const nonAdminRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: {
      'Authorization': `Bearer ${studentToken}`,
    },
  });
  console.log('Non-admin access status:', nonAdminRes.status);
  if (nonAdminRes.status === 403) {
    console.log('✓ PASS: Non-admin correctly rejected with 403 Forbidden\n');
  } else {
    throw new Error('FAIL: Expected 403 Forbidden for non-admin, got: ' + nonAdminRes.status);
  }

  // TEST 3: Feature 2 - Admin fetching all registered users
  console.log('Test 3: Admin fetching user list from /api/admin/users');
  const usersRes = await fetch(`${BASE_URL}/api/admin/users?_t=${Date.now()}`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
    },
  });
  const usersData = await usersRes.json();
  console.log('Total users returned:', usersData.total);
  console.log('Users sample:', usersData.users?.map(u => ({
    name: u.name,
    email: u.email,
    role: u.role,
    purchases: u.total_purchased_courses,
    downloads: u.total_downloads
  })));
  if (usersRes.status === 200 && usersData.users?.length >= 3) {
    console.log('✓ PASS: Admin users list successfully fetched with real user accounts\n');
  } else {
    throw new Error('FAIL: Users list failed: ' + JSON.stringify(usersData));
  }

  // TEST 4: Feature 2 - PDF Download Tracking Integration
  console.log('Test 4: Trigger verified course PDF download and verify tracking');
  const dlRes = await fetch(`${BASE_URL}/api/courses/download?courseId=${freeCourseId}`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Accept': 'application/json',
    },
  });
  const dlData = await dlRes.json();
  console.log('Download API response:', { success: dlData.success, fileName: dlData.fileName });
  if (!dlRes.ok || !dlData.downloadUrl) {
    throw new Error('Download API failed: ' + JSON.stringify(dlData));
  }
  console.log('✓ PASS: PDF download request succeeded');

  // TEST 5: Feature 2 - Check User Detailed View
  console.log('\nTest 5: Fetching detailed user view for admin user');
  const adminUserId = adminSessionData.user.id;
  const detailRes = await fetch(`${BASE_URL}/api/admin/users?userId=${adminUserId}&_t=${Date.now()}`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
    },
  });
  const detailData = await detailRes.json();
  console.log('Profile:', detailData.profile);
  console.log('Purchased courses count:', detailData.purchased_courses?.length);
  console.log('Download history count:', detailData.download_history?.length);
  if (detailData.download_history?.length > 0) {
    console.log('Download history sample:', detailData.download_history[0]);
  }
  if (detailRes.status === 200 && detailData.profile && detailData.download_history?.length > 0) {
    console.log('✓ PASS: Detailed user view returned profile, purchased courses, and verified download events!\n');
  } else {
    throw new Error('FAIL: Detail view validation failed: ' + JSON.stringify(detailData));
  }

  console.log('=== ALL ADMIN STATS & USER MANAGEMENT TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
