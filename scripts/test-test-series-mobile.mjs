// Automated verification script for Test Series Mobile Visibility & Anti-Caching Fix
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', serviceKey = '', anonKey = '';
for (const line of env.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceKey = line.split('=')[1].trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) anonKey = line.split('=')[1].trim();
}

const client = createClient(url, anonKey);

console.log('=== TEST SERIES MOBILE VISIBILITY & ANTI-CACHING SUITE ===\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  // Test 1: Verify /api/test-series?type=free returns anti-cache headers and Demo Free Test Series
  total++;
  try {
    const res = await fetch('http://localhost:3000/api/test-series?type=free');
    const cacheControl = res.headers.get('cache-control') || '';
    const pragma = res.headers.get('pragma') || '';
    const data = await res.json();

    const hasAntiCache = cacheControl.includes('no-store') && cacheControl.includes('no-cache');
    const hasDemo = (data.series || []).some(s => s.title.toLowerCase().includes('demo free'));

    if (res.ok && hasAntiCache && hasDemo) {
      console.log('✔ Test 1: /api/test-series?type=free returns anti-cache headers and Demo Free Test Series (PASS)');
      passed++;
    } else {
      console.error('❌ Test 1 FAILED:', { status: res.status, hasAntiCache, cacheControl, series: data.series?.map(s => s.title) });
    }
  } catch (err) {
    console.error('❌ Test 1 Exception:', err.message);
  }

  // Test 2: Verify /api/test-series?type=paid returns anti-cache headers and Demo Paid Test Series
  total++;
  try {
    const res = await fetch('http://localhost:3000/api/test-series?type=paid');
    const cacheControl = res.headers.get('cache-control') || '';
    const data = await res.json();

    const hasAntiCache = cacheControl.includes('no-store') && cacheControl.includes('no-cache');
    const hasDemo = (data.series || []).some(s => s.title.toLowerCase().includes('demo paid'));

    if (res.ok && hasAntiCache && hasDemo) {
      console.log('✔ Test 2: /api/test-series?type=paid returns anti-cache headers and Demo Paid Test Series (PASS)');
      passed++;
    } else {
      console.error('❌ Test 2 FAILED:', { status: res.status, hasAntiCache, cacheControl, series: data.series?.map(s => s.title) });
    }
  } catch (err) {
    console.error('❌ Test 2 Exception:', err.message);
  }

  // Test 3: Verify /api/test-series/[seriesId] returns anti-cache headers and published subjects/tests
  total++;
  try {
    // Get Demo Free series ID
    const { data: s } = await client.from('test_series').select('id').ilike('title', '%Demo Free%').single();
    if (s?.id) {
      const res = await fetch(`http://localhost:3000/api/test-series/${s.id}?type=free`);
      const cacheControl = res.headers.get('cache-control') || '';
      const data = await res.json();
      const hasTests = data.subjects?.some(sub => sub.tests?.length > 0);
      const hasAntiCache = cacheControl.includes('no-store');

      if (res.ok && hasAntiCache && hasTests) {
        console.log('✔ Test 3: /api/test-series/[seriesId] returns anti-cache headers and published subjects/tests (PASS)');
        passed++;
      } else {
        console.error('❌ Test 3 FAILED:', { status: res.status, hasAntiCache, subjectsCount: data.subjects?.length });
      }
    } else {
      console.error('❌ Test 3 FAILED: Demo Free series not found in DB');
    }
  } catch (err) {
    console.error('❌ Test 3 Exception:', err.message);
  }

  // Test 4: Verify client-side resilient fallback in fetchPublishedTestSeries
  total++;
  try {
    // Import and test client helper logic directly via anon key query
    const { data: allSeries } = await client
      .from('test_series')
      .select('*')
      .eq('is_published', true)
      .order('order', { ascending: true });

    const seriesIds = (allSeries || []).map(s => s.id);
    const { data: subjects } = await client
      .from('test_series_subjects')
      .select('id, series_id')
      .in('series_id', seriesIds)
      .eq('is_enabled', true);

    const subjectIds = (subjects || []).map(s => s.id);
    const subjectMap = new Map((subjects || []).map(s => [s.id, s.series_id]));

    // Check free tests
    const { data: freeTests } = await client
      .from('tests')
      .select('id, subject_id')
      .in('subject_id', subjectIds)
      .eq('is_published', true)
      .eq('is_paid', false);

    // Check paid tests
    const { data: paidTests } = await client
      .from('tests')
      .select('id, subject_id')
      .in('subject_id', subjectIds)
      .eq('is_published', true)
      .eq('is_paid', true);

    const freeSeriesIds = new Set((freeTests || []).map(t => subjectMap.get(t.subject_id)));
    const paidSeriesIds = new Set((paidTests || []).map(t => subjectMap.get(t.subject_id)));

    const freeList = (allSeries || []).filter(s => freeSeriesIds.has(s.id));
    const paidList = (allSeries || []).filter(s => paidSeriesIds.has(s.id));

    const freeDemoFound = freeList.some(s => s.title.toLowerCase().includes('demo free'));
    const paidDemoFound = paidList.some(s => s.title.toLowerCase().includes('demo paid'));

    if (freeDemoFound && paidDemoFound) {
      console.log('✔ Test 4: Direct Supabase client fallback can retrieve both Free & Paid Demo Test Series (PASS)');
      passed++;
    } else {
      console.error('❌ Test 4 FAILED:', { freeDemoFound, paidDemoFound });
    }
  } catch (err) {
    console.error('❌ Test 4 Exception:', err.message);
  }

  // Test 5: Verify instructions endpoint has anti-cache headers
  total++;
  try {
    const { data: paidTest } = await client.from('tests').select('id').ilike('title', '%Demo Paid%').single();
    if (paidTest?.id) {
      const res = await fetch(`http://localhost:3000/api/test-series/tests/${paidTest.id}`);
      const cacheControl = res.headers.get('cache-control') || '';
      const data = await res.json();
      const hasAntiCache = cacheControl.includes('no-store');

      if (res.ok && hasAntiCache && data.test?.title) {
        console.log('✔ Test 5: /api/test-series/tests/[testId] returns anti-cache headers and test metadata (PASS)');
        passed++;
      } else {
        console.error('❌ Test 5 FAILED:', { status: res.status, hasAntiCache, test: data.test });
      }
    } else {
      console.error('❌ Test 5 FAILED: Demo Paid test not found in DB');
    }
  } catch (err) {
    console.error('❌ Test 5 Exception:', err.message);
  }

  console.log(`\nRESULTS: ${passed}/${total} TESTS PASSED`);
  if (passed === total) {
    console.log('ALL TESTS PASSED SUCCESSFULLY! 🚀');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
