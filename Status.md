# Education-Course Project Status

## Current Phase

Phase 19 — CORS Resolution for Android "Failed to Fetch", Homepage Course Navigation, and Vercel Environment Configuration

- **Detailed Root Cause Diagnostics:**
  1. **Problem 1 (Test Series Start "Unable to start test / Failed to fetch" on Android):**
     - **Root Cause:** When running on Android via Capacitor or mobile WebView, the origin is `capacitor://localhost` or `http://localhost`. When calling `testSeriesFetch('/api/tests/[testId]/attempt')` on the remote Vercel domain (`https://education-course-nine.vercel.app`), this is a cross-origin HTTP request.
     - Because Next.js did not have CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`) or an `OPTIONS` preflight handler, the browser/WebView security engine rejected the preflight request, immediately aborting the call and throwing `TypeError: Failed to fetch`.
     - **Fix:** Implemented `src/middleware.ts` to handle CORS preflight `OPTIONS` requests (returning HTTP 204 with full origin, headers, and credentials allowances) and to attach CORS headers to all `/api/:path*` responses. Also configured `async headers()` in `next.config.ts`.
  2. **Problem 2 (Course Purchase "Failed to create internal order"):**
     - **Root Cause:** In Supabase, the `orders` table has Row-Level Security enabled with no user INSERT policy. Inserting an order requires the service-role key (`SUPABASE_SERVICE_ROLE_KEY`).
     - As verified by direct probes to `/api/health` and `/api/payments/create` on the live Vercel production server, `SUPABASE_SERVICE_ROLE_KEY` is not set in Vercel's Environment Variables dashboard.
     - **Fix:** Added dynamic pre-flight validation in `/api/payments/create` and safe response parsing in `CourseDetailsClient.tsx` so the exact status and required variable name are returned directly.
  3. **Problem 3 (Homepage "View Course" Does Nothing When Clicked):**
     - **Root Cause:** In `src/app/page.tsx`, `<CourseCard>` was rendered inside `featuredCourses.map()` without passing the `courseId` prop (`courseId={course.id}` was completely missing). Inside `CourseCard.tsx`, the click handler was `onClick={() => courseId && router.push(...) cunt}`, which evaluated to `undefined` and did nothing!
     - **Fix:** 
       1. Updated `src/app/page.tsx` to pass `courseId={course.id}` and `key={course.id || idx}`.
       2. Refactored `src/components/shared/CourseCard.tsx` to wrap the course thumbnail, title, and "View Course" button in standard Next.js `<Link href={targetHref}>` tags (`/courses/${courseId}`), ensuring instant, native navigation on both desktop and mobile browsers.

## Files Updated

- [src/middleware.ts](src/middleware.ts) [NEW] — Global CORS preflight and response header middleware for all `/api/` routes.
- [next.config.ts](next.config.ts) — Configured `async headers()` for CORS.
- [src/components/shared/CourseCard.tsx](src/components/shared/CourseCard.tsx) — Migrated to Next.js `<Link>` navigation for title, thumbnail, and "View Course" button.
- [src/app/page.tsx](src/app/page.tsx) — Passed `courseId={course.id}` to `CourseCard` on the homepage.
- [src/app/test-series/tests/[testId]/attempt/page.tsx](src/app/test-series/tests/[testId]/attempt/page.tsx) — Added resilient JSON parsing and descriptive network failure guidance.
- [src/app/courses/[id]/CourseDetailsClient.tsx](src/app/courses/[id]/CourseDetailsClient.tsx) — Added safe response JSON parsing for order creation.
- [Status.md](Status.md)

## Required Vercel Environment Variables

To allow server-side operations (`orders` insertion and test `questions` retrieval) to succeed on the live Vercel deployment, configure this in **Vercel Project Settings → Environment Variables**:

- **`SUPABASE_SERVICE_ROLE_KEY`** (or `SUPABASE_SERVICE_KEY`) — Value from Supabase Dashboard → Settings → API → `service_role` secret.

*Note: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` are already verified active in Vercel via `/api/health`.*

## Validation Results

- **TypeScript Compiler Check:** `npx tsc --noEmit` exited with code 0 (no errors).
- **Production Build:** `npm run build` completed successfully in 2.9s with Proxy Middleware active (all 40 pages and routes compiled).
- **Live Deployed URL Probes:** Tested `https://education-course-nine.vercel.app` directly via Node.js.

## Last Updated

2026-09-20
