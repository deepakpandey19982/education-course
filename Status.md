# Education-Course Project Status

## Current Phase

Phase 14 — Admin Dashboard Android Cache Fix & Admin User Management Panel with PDF Download Tracking.

- **Feature 1: Admin Dashboard Stats on Android/Mobile (`src/app/api/admin/stats/route.ts`, `src/app/admin/page.tsx`):**
  - **Diagnosed Root Cause:**
    - Android WebView / Chromium aggressively caches GET requests when `Cache-Control` is absent or permissive.
    - On mobile / Capacitor, backgrounding and resuming the app does not unmount React components, so the standard `useEffect` did not trigger re-fetching when returning to the dashboard.
  - **Fixes Applied:**
    - Added rigorous anti-caching HTTP response headers in `/api/admin/stats`: `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`.
    - Added `cache: 'no-store'` and dynamic timestamp query parameter `?_t=${Date.now()}` on client fetch requests to defeat client/proxy caching.
    - Registered `document.addEventListener('visibilitychange')` and `window.addEventListener('focus')` handlers to automatically re-fetch current stats whenever the user resumes or focuses the app on Android/mobile.
    - Added a clean manual "Refresh Stats" button in the Admin header with an animated spinning state.
    - Added a quick action card directly linking to `👥 Manage Users` (`/admin/users`).

- **Feature 2: Admin User Management (`/admin/users`, `/api/admin/users`):**
  - Added dedicated Users management section to Admin Panel navigation (`src/app/admin/layout.tsx`).
  - Added `/api/admin/users` endpoint:
    - Strictly protected by admin session authorization (`role === 'admin'`). Non-admins receive HTTP 403 Forbidden.
    - Lists all registered users with avatar, name, email, role, joined date, total purchased courses count, and total PDF downloads count.
    - Supports user drill-down (`?userId=...`) returning detailed purchased courses (course name, purchase date, amount paid, status) and PDF download history (PDF name, download date/time, access type FREE/PAID, linked order).
  - Built responsive Admin Users page (`src/app/admin/users/page.tsx`):
    - Search by name or email with live filtering.
    - Displays user stats cards (Total Registered Users, Total Course Purchases, Total PDF Downloads).
    - Responsive desktop table and mobile cards with role badges (Admin / Student) and avatars.
    - Comprehensive User Details modal showing Profile, Purchased Courses list (with amount, date, status badges), and PDF Download History list (with access type tags, timestamps, and order references).
    - Clean empty states when users have no purchases or downloads yet.
    - Fully styled for both Dark and Light themes with high-contrast text.

- **PDF Download Tracking (`supabase/migrations/20260920_course_downloads.sql`, `src/lib/download-tracker.ts`, `src/app/api/courses/download/route.ts`):**
  - Differentiated Course Purchases from Course PDF Downloads.
  - Created migration `20260920_course_downloads.sql` defining `public.course_downloads` table with RLS.
  - Implemented dual-resilient download tracking in `src/lib/download-tracker.ts`:
    - Records verified downloads into `public.course_downloads`.
    - Synchronizes download event logs into `site_settings` fallback store (`download_log_...`), guaranteeing immediate persistence without manual SQL execution.
  - Integrated into `/api/courses/download/route.ts` immediately upon successful verification and signed-URL creation. Unauthorized or failed attempts are never logged as successful downloads.

## Files Updated

- [supabase/migrations/20260920_course_downloads.sql](supabase/migrations/20260920_course_downloads.sql)
- [src/lib/download-tracker.ts](src/lib/download-tracker.ts)
- [src/app/api/courses/download/route.ts](src/app/api/courses/download/route.ts)
- [src/app/api/admin/stats/route.ts](src/app/api/admin/stats/route.ts)
- [src/app/admin/page.tsx](src/app/admin/page.tsx)
- [src/app/admin/layout.tsx](src/app/admin/layout.tsx)
- [src/app/api/admin/users/route.ts](src/app/api/admin/users/route.ts)
- [src/app/admin/users/page.tsx](src/app/admin/users/page.tsx)
- [scripts/test-admin-features.mjs](scripts/test-admin-features.mjs)
- [Status.md](Status.md)

## Validation Results

- **Automated Test Suite (`scripts/test-admin-features.mjs`):**
  - Test 1: Admin Stats anti-cache headers (`Cache-Control: no-store, no-cache, ...`) (PASS).
  - Test 2: Admin Users API security check (unauthorized/non-admin blocked with HTTP 403) (PASS).
  - Test 3: Admin Users API returns user list with purchases and downloads counts (PASS).
  - Test 4: Course PDF download tracking records FREE & PAID downloads (PASS).
  - Test 5: Detailed user drill-down returns profile, purchased courses, and download history (PASS).
- **TypeScript check:** `npx tsc --noEmit` passed with 0 errors (exit code 0).
- **Production build:** `npm run build` passed cleanly (exit code 0, 42/42 routes compiled).

## Remaining Bugs / Blockers

- None.

## Last Updated

2026-09-20
