# Education-Course Project Status

## Current Phase

Phase 12 — Course PDF Download Authentication and Access Verification Fix.

## What Changed

- **Course PDF Download Authentication Fix (`src/app/api/courses/download/route.ts`, `src/lib/test-series-server.ts`, `src/lib/supabase.ts`):**
  - **Diagnosed Root Cause:**
    - The client-side Supabase client (`@supabase/supabase-js`) persists authentication tokens in browser `localStorage`, not in HTTP cookies.
    - Previous PDF download triggers performed direct full-page navigations (`window.location.href = /api/courses/download?courseId=...`), which sent no `Authorization` header and contained no session cookies, causing the `@supabase/ssr` cookie parser to fail with `{"error": "Authentication required"}` (HTTP 401).
    - Furthermore, `/api/courses/download` was hard-coded to require a paid entry in the `orders` table, which erroneously blocked all free courses (`price === 0`).
  - **Server-Side Authentication Enhancement (`src/lib/test-series-server.ts`):**
    - Enhanced `getRequestUser(request)` to check multiple authentication vectors:
      1. `Authorization: Bearer <token>` HTTP header.
      2. `token` or `access_token` query parameter from the request URL.
      3. `sb-access-token` cookie directly.
      4. `@supabase/ssr` structured cookies via `cookieStore`.
    - If a valid token is provided via any of these channels, the server verifies it against Supabase Auth.
  - **Client-Side Cookie Synchronization (`src/lib/supabase.ts`):**
    - Added `onAuthStateChange` listener in `getSupabase()` to keep `sb-access-token` cookie synchronized across login, session refresh, and logout events.
    - Synchronized existing `localStorage` sessions on initial load so server-side routes can recognize browser sessions.
  - **Access & Payment Verification Logic (`src/app/api/courses/download/route.ts`):**
    - Authenticates the user via `getRequestUser(req)`. Unauthenticated requests return HTTP 401 `{"error": "Authentication required"}`.
    - Checks course details from the `courses` table:
      - **Free Courses (`price === 0`):** Authenticated users are granted access without requiring a paid order row.
      - **Paid Courses (`price > 0`):** Checks `orders` for `status === 'paid'` matching `user_id` and `course_id`. Unpurchased paid requests return HTTP 403 `{"error": "Unauthorized: You must purchase the course before downloading."}`.
      - **Admins:** Users with `profiles.role === 'admin'` are granted access to all course PDFs for inspection/management.
    - Fetches the private storage file path from `course_files` and generates a secure signed URL (15-minute expiry) from the private `course-pdfs` bucket.
    - Supports both JSON response format (`{ success: true, downloadUrl, fileName }`) for programmatic API requests and 302 redirects for direct browser navigation.
    - Implemented both `GET` and `POST` handlers.
  - **Frontend Authenticated Download Helper & UI (`src/lib/course-download.ts`, `CourseDetailsClient.tsx`, `src/app/dashboard/page.tsx`):**
    - Created `downloadCoursePdf(courseId)` helper in `src/lib/course-download.ts` that retrieves the user's active access token, makes an authenticated `fetch()` request, checks JSON responses, and securely opens/downloads the signed PDF.
    - Updated `src/app/courses/[id]/CourseDetailsClient.tsx` and `src/app/dashboard/page.tsx` with loading states ("Preparing PDF...") while generating signed URLs.

## Files Updated

- [src/lib/test-series-server.ts](src/lib/test-series-server.ts)
- [src/lib/supabase.ts](src/lib/supabase.ts)
- [src/lib/course-download.ts](src/lib/course-download.ts)
- [src/app/api/courses/download/route.ts](src/app/api/courses/download/route.ts)
- [src/app/courses/[id]/CourseDetailsClient.tsx](src/app/courses/[id]/CourseDetailsClient.tsx)
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)
- [scripts/test-course-download.mjs](scripts/test-course-download.mjs)
- [Status.md](Status.md)

## Validation Results

- **Automated Test Suite (`scripts/test-course-download.mjs`):**
  - Test 1 (Unauthenticated access to Free Course): HTTP 401 `{"error":"Authentication required"}` (PASS).
  - Test 2 (Logged-in student requesting Free Course PDF): HTTP 200, valid signed URL returned, downloaded 439,699 bytes of PDF (PASS).
  - Test 3 (Logged-in student requesting Paid Course without purchase): HTTP 403 `{"error":"Unauthorized: You must purchase the course before downloading."}` (PASS).
  - Test 4 (Logged-in student requesting Paid Course with purchase): HTTP 200, valid signed URL returned (PASS).
  - Test 5 (Admin accessing Paid Course): HTTP 200, access granted (PASS).
  - Test 6 (Direct browser GET with query param token): HTTP 302 redirecting to secure signed URL (PASS).
  - Test 7 (Direct browser GET with session cookie): HTTP 302 redirecting to secure signed URL (PASS).
  - Test 8 (Private storage check): Raw public bucket access rejected (HTTP 400), confirming private storage remains secure (PASS).
- **TypeScript check:** `npx tsc --noEmit` passed with 0 errors (exit code 0).
- **Production build:** `npm run build` passed cleanly (exit code 0, 41/41 routes compiled).

## Remaining Bugs / Blockers

- None.

## Last Updated

2026-09-20
