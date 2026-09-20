# Education-Course Project Status

## Current Phase

Phase 17 — Vercel Deployed Environment Robustness & API Configuration (Test Attempt start error and Course Purchase order creation on deployed site).

- **Diagnosed Root Causes:**
  1. **Problem 1 (Test Series Questions "Unable to start test / Internal server error"):**
     - In Supabase, Row-Level Security (RLS) restricts access to the `questions` table to `Admins only` (`CREATE POLICY "Admins can manage questions" ON questions FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))`). Regular students and anonymous visitors are completely forbidden from reading questions directly.
     - Therefore, `/api/tests/[testId]/attempt` must use a service-role Supabase client (`getSupabaseAdmin()`) to fetch test questions and safely strip answers before returning them to the student.
     - In `src/lib/test-series-server.ts`, `requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY')` threw an uncaught error if `SUPABASE_SERVICE_ROLE_KEY` was missing from Vercel's Environment Variables (or named under an alias like `SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`).
     - The catch block in `src/app/api/tests/[testId]/attempt/route.ts` swallowed the specific configuration error and returned generic `500 Internal server error`, rendering "Unable to start test / Internal server error" in the UI.
  2. **Problem 2 (Course Purchase "Failed to create internal order"):**
     - In `src/app/api/payments/create/route.ts`, `supabaseAdmin` was initialized with `process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!`.
     - When `SUPABASE_SERVICE_ROLE_KEY` was missing on Vercel, it fell back to the anon client.
     - In Supabase, the `orders` table has RLS enabled with only `SELECT` policies for users and `ALL` for admins. There is **no INSERT policy for anonymous users or non-admin students**.
     - As verified with Node.js testing, inserting an order with the anon key fails with Supabase RLS error `code: 42501` (`new row violates row-level security policy for table "orders"`).
     - The route swallowed this exact error message and returned the generic string `{ error: 'Failed to create internal order' }`.

- **Fixes Applied:**
  1. **Environment Alias Resolution (`src/lib/test-series-server.ts`):**
     - Added robust multi-alias search:
       - Service Role: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE`, `SERVICE_ROLE_KEY`.
       - Supabase URL: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`.
       - Supabase Anon Key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_KEY`.
       - Razorpay Key ID: `RAZORPAY_KEY_ID`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
       - Razorpay Key Secret: `RAZORPAY_KEY_SECRET`, `RAZORPAY_SECRET`.
     - Replaced hard-crash exceptions with descriptive, actionable configuration errors.
  2. **Payment Order Creation (`src/app/api/payments/create/route.ts`):**
     - Replaced static top-level initialization with dynamic Razorpay and Supabase Admin resolution.
     - If service role or Razorpay credentials are missing, returns explicit configuration diagnostics instead of generic failures.
     - Surfaced real database error details (`orderError.message`) instead of hiding them behind "Failed to create internal order".
  3. **Payment Verification & Webhook (`src/app/api/payments/verify/route.ts`, `webhook/route.ts`):**
     - Updated Razorpay credentials and Supabase client to use alias-aware helpers.
  4. **Test Attempt Route (`src/app/api/tests/[testId]/attempt/route.ts`):**
     - Surfaced actual error messages (`Unable to start test: ${error.message}`) in catch handler.
  5. **Client Fetch Credentials & Vercel URLs:**
     - Added `credentials: 'include'` to `testSeriesFetch` in `src/lib/test-series-client.ts` and payment requests in `CourseDetailsClient.tsx` to ensure auth cookies are preserved across all HTTPS requests on deployed Vercel domains.
     - Added `process.env.VERCEL_URL` and `process.env.NEXT_PUBLIC_VERCEL_URL` support to `src/lib/api-config.ts`.

## Files Updated

- [src/lib/test-series-server.ts](src/lib/test-series-server.ts)
- [src/app/api/payments/create/route.ts](src/app/api/payments/create/route.ts)
- [src/app/api/payments/verify/route.ts](src/app/api/payments/verify/route.ts)
- [src/app/api/payments/webhook/route.ts](src/app/api/payments/webhook/route.ts)
- [src/app/api/tests/[testId]/attempt/route.ts](src/app/api/tests/[testId]/attempt/route.ts)
- [src/app/api/contact/route.ts](src/app/api/contact/route.ts)
- [src/app/courses/[id]/CourseDetailsClient.tsx](src/app/courses/[id]/CourseDetailsClient.tsx)
- [src/lib/test-series-client.ts](src/lib/test-series-client.ts)
- [src/lib/api-config.ts](src/lib/api-config.ts)
- [scripts/test-vercel-apis.mjs](scripts/test-vercel-apis.mjs) [NEW]
- [Status.md](Status.md)

## Required Vercel Environment Variables

For the deployed Vercel site to operate correctly, ensure the following environment variables are set in **Vercel Dashboard → Project Settings → Environment Variables**:

1. `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`)
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `SUPABASE_ANON_KEY`)
3. `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_KEY`) — **Mandatory** for internal order creation and reading test questions.
4. `RAZORPAY_KEY_ID` — **Mandatory** for creating Razorpay orders.
5. `RAZORPAY_KEY_SECRET` — **Mandatory** for Razorpay order creation and HMAC verification.
6. `RAZORPAY_WEBHOOK_SECRET` — **Mandatory** for handling live webhook payment captures.

## Validation Results

- **Vercel / Deployed APIs Suite (`scripts/test-vercel-apis.mjs`):**
  - Verified RLS strictly blocks Anon from reading `questions` (0 visible) while Service Role retrieves questions (PASS).
  - Verified RLS rejects Anon order insert with code `42501` (PASS).
  - Verified `/api/tests/[testId]/attempt` successfully starts test attempt and loads 5 questions with answers stripped (HTTP 200, PASS).
  - Verified `/api/payments/create` successfully creates Razorpay live order and inserts internal pending order (HTTP 200, PASS).
- **Mobile Data-Source Suite (`scripts/test-mobile-data-source.mjs`):** PASSED.
- **Test Series Mobile Suite (`scripts/test-test-series-mobile.mjs`):** 5/5 PASSED.
- **Admin Stats & Users Suite (`scripts/test-admin-features.mjs`):** 5/5 PASSED.
- **TypeScript Check:** `npx tsc --noEmit` exited with code 0 (no type errors).
- **Production Build:** `npm run build` exited with code 0 (all 40 production routes compiled).

## Remaining Bugs / Blockers

- None.

## Last Updated

2026-09-20
