# Education-Course Project Status

## Current Phase

Phase 16 — Android Mobile Data-Source & API Root Cause Resolution (Admin Dashboard live metrics, Free & Paid Test Series, and API endpoint routing).

- **Root Cause Analysis:**
  1. **Capacitor Mobile Origin Isolation:** On Android/Capacitor, the web app runs in an Android WebView with origin `http://localhost` (or `capacitor://localhost`).
  2. **Failed Relative Calls to Localhost:** Any relative API calls like `fetch('/api/admin/stats')`, `fetch('/api/admin/users')`, or `fetch('/api/test-series')` resolve relative to the local origin (`http://localhost/api/...`), meaning the Android device attempted to connect to port 80/3000 on its own mobile loopback interface rather than the workstation dev server.
  3. **Silent Zeroing on Network Failure:** When the network request failed (`ERR_CONNECTION_REFUSED`), the Admin Dashboard caught the exception and retained the initial `useState` zeroes (`totalRevenue: 0`, `activeCourses: 0`, `totalStudents: 0`, `totalSales: 0`). Similarly, test series fetching failed to reach endpoints.
  4. **Cleartext Traffic Block:** Android Pie (API 28+) blocks unencrypted HTTP traffic by default, preventing devices on the local Wi-Fi network from reaching `http://<host-ip>:3000` during development and testing unless cleartext traffic is explicitly permitted.

- **Fixes Applied:**
  1. **Centralized API Base Resolver (`src/lib/api-config.ts`):**
     - Resolves the proper API endpoint base across environments (`NEXT_PUBLIC_API_URL`, mobile origin detection, workstation Wi-Fi IP fallback `http://10.29.110.224:3000`, and emulator fallback).
     - Accurate `isCapacitorNative()` check ensuring desktop `localhost:3000` is never misidentified.
  2. **Dual-Resilient Admin Stats Fetcher (`src/lib/admin-stats-client.ts`):**
     - First queries the API route `/api/admin/stats` using `getApiUrl()`.
     - If unreachable or fails on mobile, automatically executes direct queries against live Supabase tables (`orders`, `courses`, `profiles`) using the authenticated admin session token, returning the exact live metrics without hardcoding.
  3. **Dual-Resilient Admin Users Management (`src/app/admin/users/page.tsx`):**
     - Integrated `getApiUrl` and added direct Supabase table query fallback for user list and detailed user views.
  4. **Mobile API Route Resolution Across All Features:**
     - `src/lib/test-series-client.ts`: Updated `testSeriesFetch`, `fetchPublishedTestSeries`, and `fetchSeriesDetail` to resolve URLs via `getApiUrl`.
     - `src/app/test-series/tests/[testId]/instructions/page.tsx`: Updated test info fetching to use `getApiUrl`.
     - `src/lib/course-download.ts`: Updated PDF download endpoint resolution to use `getApiUrl`.
     - `src/app/courses/[id]/CourseDetailsClient.tsx`: Updated Razorpay order creation and verification endpoints to use `getApiUrl`.
     - `src/app/dashboard/page.tsx`: Updated payment reconciliation endpoint to use `getApiUrl`.
     - `src/lib/supabase.ts`: Updated `/api/storage/sign` and `/api/storage/upload` endpoints to use `getApiUrl`.
  5. **Android Configuration & Permissions:**
     - `android/app/src/main/AndroidManifest.xml`: Added `android:usesCleartextTraffic="true"` to `<application>` to permit local HTTP development traffic.
     - `capacitor.config.ts`: Configured `server: { androidScheme: 'https', cleartext: true }`.
     - Synced Capacitor Android assets via `npx cap sync android`.

## Files Updated

- [src/lib/api-config.ts](src/lib/api-config.ts) [NEW]
- [src/lib/admin-stats-client.ts](src/lib/admin-stats-client.ts) [NEW]
- [scripts/test-mobile-data-source.mjs](scripts/test-mobile-data-source.mjs) [NEW]
- [src/app/admin/page.tsx](src/app/admin/page.tsx)
- [src/app/admin/users/page.tsx](src/app/admin/users/page.tsx)
- [src/lib/test-series-client.ts](src/lib/test-series-client.ts)
- [src/lib/course-download.ts](src/lib/course-download.ts)
- [src/lib/supabase.ts](src/lib/supabase.ts)
- [src/app/courses/[id]/CourseDetailsClient.tsx](src/app/courses/[id]/CourseDetailsClient.tsx)
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)
- [src/app/test-series/tests/[testId]/instructions/page.tsx](src/app/test-series/tests/[testId]/instructions/page.tsx)
- [capacitor.config.ts](capacitor.config.ts)
- [android/app/src/main/AndroidManifest.xml](android/app/src/main/AndroidManifest.xml)
- [Status.md](Status.md)

## Validation Results

- **Automated Mobile Data-Source Verification (`scripts/test-mobile-data-source.mjs`):**
  - Authenticated as Admin via mobile client configuration.
  - Direct live database queries confirmed:
    - Total Revenue: ₹1.00
    - Active Courses: 7
    - Total Students: 3
    - Total Sales: 1
  - Published Test Series confirmed: 12 accessible (including Demo Free Test Series & Demo Paid Test Series).
  - All mobile queries succeeded with 100% live database values (PASS).
- **Admin Stats & User Management Suite (`scripts/test-admin-features.mjs`):**
  - All 5 tests passed (anti-caching headers, role enforcement 403, user list, download tracking, user details).
- **Test Series Mobile Suite (`scripts/test-test-series-mobile.mjs`):**
  - 5/5 tests passed (Free & Paid series APIs, detail APIs, Supabase fallback, instructions).
- **TypeScript Verification:** `npx tsc --noEmit` exited with code 0 (no type errors).
- **Production Build:** `npm run build` exited with code 0 (all 42 routes compiled successfully).
- **Capacitor Sync:** `npx cap sync android` exited with code 0.

## Remaining Bugs / Blockers

- None.

## Last Updated

2026-09-20
