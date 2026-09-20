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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const adminService = createClient(supabaseUrl, serviceRoleKey);
const mobileClient = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('=== VERIFYING MOBILE DATA SOURCE INTEGRITY ===\n');

  // Sign in as admin to simulate mobile admin session
  const adminEmail = 'deepakpandey19982@gmail.com';
  const adminLink = await adminService.auth.admin.generateLink({
    type: 'magiclink',
    email: adminEmail,
  });

  const { data: authData, error: authError } = await mobileClient.auth.verifyOtp({
    token_hash: adminLink.data.properties.hashed_token,
    type: 'magiclink',
  });

  if (authError || !authData.session) {
    console.error('Failed to authenticate admin session:', authError);
    process.exit(1);
  }

  console.log('1. Mobile client authenticated as Admin:', authData.user.email);

  // Direct Supabase queries (as executed by mobile fallback in admin-stats-client.ts)
  const [coursesRes, ordersRes, profilesRes] = await Promise.all([
    mobileClient.from('courses').select('id', { count: 'exact', head: true }).eq('is_published', true),
    mobileClient.from('orders').select('amount, status').eq('status', 'paid'),
    mobileClient.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  const activeCourses = coursesRes.count || 0;
  const totalSales = ordersRes.data?.length || 0;
  const totalRevenue = (ordersRes.data || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalStudents = profilesRes.count || 0;

  console.log('\n2. Live Supabase Metrics (Mobile Direct Query via Anon Client + Admin Auth):');
  console.log('   - Total Revenue:', `₹${totalRevenue.toFixed(2)}`);
  console.log('   - Active Courses:', activeCourses);
  console.log('   - Total Students:', totalStudents);
  console.log('   - Total Sales:', totalSales);

  // Assert expected live values
  if (totalRevenue !== 1.00) throw new Error(`Expected revenue ₹1.00, got ₹${totalRevenue}`);
  if (activeCourses !== 7) throw new Error(`Expected active courses 7, got ${activeCourses}`);
  if (totalStudents < 2) throw new Error(`Expected students >= 2, got ${totalStudents}`);
  if (totalSales !== 1) throw new Error(`Expected sales 1, got ${totalSales}`);

  console.log('\n✓ PASS: Mobile direct queries return exact live database metrics (no hardcoding)!');

  // Verify Free and Paid Test Series are directly queryable by mobile client
  const { data: freeSeries, error: seriesErr } = await mobileClient
    .from('test_series')
    .select('id, title, is_published')
    .eq('is_published', true);

  if (seriesErr) throw seriesErr;

  console.log(`\n3. Published Test Series accessible by mobile: ${freeSeries?.length || 0} found`);
  freeSeries?.forEach(s => console.log(`   - [Series] ${s.title}`));

  if (!freeSeries || freeSeries.length === 0) {
    throw new Error('Test series not accessible by mobile client');
  }

  console.log('\n=== ALL MOBILE DATA-SOURCE VERIFICATIONS PASSED ===');
  process.exit(0);
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
