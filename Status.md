# Education-Course Project Status

## Current Phase

Phase 15 — Mobile Visibility & Anti-Caching Fix for Free & Paid Test Series Demo Items.

- **Free & Paid Test Series Mobile Visibility Fix:**
  - **Diagnosed Root Cause:**
    1. `/api/test-series/route.ts` previously executed an unbatched sequential N+1 query loop (up to 25 roundtrips to Supabase per request), causing connection timeouts / HTTP 500 errors (`Could not load test series`) on mobile network requests.
    2. Missing `Cache-Control: no-store` headers on `/api/test-series`, `/api/test-series/[seriesId]`, and `/api/test-series/tests/[testId]` caused Android WebView and mobile browsers to aggressively cache earlier empty responses (`{ series: [] }`), perpetually hiding published demo series on mobile devices.
    3. `src/app/test-series/page.tsx` and `src/app/test-series/paid/page.tsx` lacked anti-caching fetch directives (`cache: 'no-store'`, dynamic timestamp `?_t=...`) and lacked app lifecycle listeners (`visibilitychange` / `focus`) when returning to the app on mobile.
    4. Client pages lacked a resilient fallback to direct client-side `supabase` queries if the local Next.js API route was unreachable in Capacitor / Android WebView.
    5. Missing dark mode classes on `PaidTestSeriesDetailPage` and the `Message` component caused low-contrast/invisible text on mobile devices with system dark mode enabled.
  - **Fixes Applied:**
    - Replaced the sequential 25-query loop in `/api/test-series/route.ts` with a high-performance 3-query batched lookup.
    - Added rigorous anti-caching headers (`Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`) across all test series API routes (`/api/test-series`, `/api/test-series/[seriesId]`, `/api/test-series/tests/[testId]`).
    - Created `src/lib/test-series-client.ts` with `fetchPublishedTestSeries('free' | 'paid')` and `fetchSeriesDetail()` featuring anti-cache query tokens, `cache: 'no-store'`, and an automatic resilient fallback to direct client-side `supabase` queries.
    - Added `visibilitychange` and `focus` event listeners to `TestSeriesPage` and `PaidTestSeriesPage` so returning to the app on Android automatically loads the current demo items.
    - Added a clean "Refresh" button on both Free and Paid Test Series headers.
    - Added comprehensive Dark and Light mode contrast styling to `PaidTestSeriesDetailPage` and the shared `Message` component.
    - Added `testSeriesFetch` authenticated fetch helper in `src/lib/test-series-client.ts` for test attempt and submission flows.

## Files Updated

- [src/app/api/test-series/route.ts](src/app/api/test-series/route.ts)
- [src/app/api/test-series/[seriesId]/route.ts](src/app/api/test-series/[seriesId]/route.ts)
- [src/app/api/test-series/tests/[testId]/route.ts](src/app/api/test-series/tests/[testId]/route.ts)
- [src/lib/test-series-client.ts](src/lib/test-series-client.ts)
- [src/app/test-series/page.tsx](src/app/test-series/page.tsx)
- [src/app/test-series/paid/page.tsx](src/app/test-series/paid/page.tsx)
- [src/app/test-series/[seriesId]/page.tsx](src/app/test-series/[seriesId]/page.tsx)
- [src/app/test-series/paid/[seriesId]/page.tsx](src/app/test-series/paid/[seriesId]/page.tsx)
- [src/app/test-series/tests/[testId]/instructions/page.tsx](src/app/test-series/tests/[testId]/instructions/page.tsx)
- [scripts/test-test-series-mobile.mjs](scripts/test-test-series-mobile.mjs)
- [Status.md](Status.md)

## Validation Results

- **Automated Test Suite (`scripts/test-test-series-mobile.mjs`):**
  - Test 1: `/api/test-series?type=free` returns anti-cache headers and Demo Free Test Series (PASS).
  - Test 2: `/api/test-series?type=paid` returns anti-cache headers and Demo Paid Test Series (PASS).
  - Test 3: `/api/test-series/[seriesId]` returns anti-cache headers and published subjects/tests (PASS).
  - Test 4: Direct Supabase client fallback can retrieve both Free & Paid Demo Test Series (PASS).
  - Test 5: `/api/test-series/tests/[testId]` returns anti-cache headers and test metadata (PASS).
- **TypeScript check:** `npx tsc --noEmit` passed with 0 errors (exit code 0).
- **Production build:** `npm run build` passed cleanly (exit code 0, 42/42 routes compiled).

## Remaining Bugs / Blockers

- None.

## Last Updated

2026-09-20
