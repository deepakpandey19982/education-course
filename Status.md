# Education-Course Project Status

## Current Phase

Phase 18 — Live Vercel Production Deployment Probing & Environment Key Resolution

- **Live Production Investigation on `https://education-course-nine.vercel.app`:**
  1. **Direct Probe of `/api/payments/create` on Live Vercel Production:**
     - Result: `HTTP 500 {"error": "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE or SERVICE_ROLE_KEY. Please configure this variable in your Vercel project settings (Environment Variables)."}`
     - **Confirmed Root Cause:** `SUPABASE_SERVICE_ROLE_KEY` is completely missing from Vercel's Environment Variables dashboard. Without it, the server cannot execute privileged database operations (such as inserting records into the `orders` table which has RLS enabled with no user INSERT policy).
  2. **Direct Probe of `/api/test-series?type=free` on Live Vercel Production:**
     - Result: `HTTP 500 {"error": "Could not load test series"}`
     - **Confirmed Root Cause:** The test series list endpoint called `getSupabaseAdmin()` which threw an unhandled exception when `SUPABASE_SERVICE_ROLE_KEY` was missing, even though `test_series`, `test_series_subjects`, and `tests` all have public read permissions via Row-Level Security.
  3. **Direct Probe of `/api/tests/[testId]/attempt` (Test Start & Questions Loading):**
     - **Confirmed Root Cause:** In Supabase, the `questions` table has Row-Level Security restricting access exclusively to `Admins` (`CREATE POLICY "Admins can manage questions" ON questions FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))`). Regular students and anonymous visitors are rejected by RLS (returning `[]`).
     - To deliver questions securely (without leaking answers/explanations), the server must use `getSupabaseAdmin()` with `SUPABASE_SERVICE_ROLE_KEY`. When this variable is missing on Vercel, the endpoint crashed with `Unable to start test / Internal server error`.
  4. **Android API Base URL Resolution (`src/lib/api-config.ts`):**
     - Previously, `getApiBaseUrl()` had a hardcoded fallback to `http://10.29.110.224:3000` for Capacitor. If an Android device visited the deployed site or ran without Wi-Fi access to the developer's laptop, requests would fail.
     - Fixed `src/lib/api-config.ts` so any client running on a remote web domain uses `window.location.origin`, and Capacitor native apps default to `https://education-course-nine.vercel.app`.

- **Fixes Implemented:**
  1. **Public Catalog Graceful Fallback (`src/lib/test-series-server.ts`, `/api/test-series/route.ts`, `/api/test-series/[seriesId]/route.ts`, `/api/test-series/tests/[testId]/route.ts`):**
     - Test series catalog routes now use `getSupabaseClient()` which safely uses the anonymous public key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) when `SUPABASE_SERVICE_ROLE_KEY` is not present, ensuring catalog browsing never returns HTTP 500.
  2. **Safe Diagnostic Health Route (`src/app/api/health/route.ts`):**
     - Added an endpoint returning boolean flags for all required environment variables without ever exposing secret values.
  3. **Descriptive Error Messaging (`/api/tests/[testId]/attempt/route.ts`, `/api/payments/create/route.ts`):**
     - Replaced generic 500 error messages with explicit guidance pointing to the exact missing variable name: `SUPABASE_SERVICE_ROLE_KEY`.
  4. **UI Guidance on Attempt Page (`src/app/test-series/tests/[testId]/attempt/page.tsx`):**
     - Added "Sign In to Continue" button when authentication is required and improved error presentation.
  5. **Android Production API Resolution (`src/lib/api-config.ts`):**
     - Remote HTTPS origins always take precedence, and native Capacitor apps default to `https://education-course-nine.vercel.app`.

## Files Updated

- [src/app/api/health/route.ts](src/app/api/health/route.ts) [NEW]
- [src/lib/test-series-server.ts](src/lib/test-series-server.ts)
- [src/app/api/test-series/route.ts](src/app/api/test-series/route.ts)
- [src/app/api/test-series/[seriesId]/route.ts](src/app/api/test-series/[seriesId]/route.ts)
- [src/app/api/test-series/tests/[testId]/route.ts](src/app/api/test-series/tests/[testId]/route.ts)
- [src/app/api/tests/[testId]/attempt/route.ts](src/app/api/tests/[testId]/attempt/route.ts)
- [src/app/api/payments/create/route.ts](src/app/api/payments/create/route.ts)
- [src/app/test-series/tests/[testId]/attempt/page.tsx](src/app/test-series/tests/[testId]/attempt/page.tsx)
- [src/lib/api-config.ts](src/lib/api-config.ts)
- [Status.md](Status.md)

## Required Vercel Environment Variables

To fully resolve the database operations on the live Vercel deployment, configure these in **Vercel Project Settings → Environment Variables**:

1. `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (Already set on Vercel).
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon public key (Already set on Vercel).
3. `SUPABASE_SERVICE_ROLE_KEY` — **MISSING ON VERCEL**. Mandatory for server-side question loading and internal order creation.
4. `RAZORPAY_KEY_ID` — Razorpay Key ID (Check presence via `/api/health`).
5. `RAZORPAY_KEY_SECRET` — Razorpay Key Secret.
6. `RAZORPAY_WEBHOOK_SECRET` — Razorpay Webhook Secret.

## Validation Results

- **Live Deployed URL Probes:** Tested `https://education-course-nine.vercel.app` directly via Node.js.
- **TypeScript Compiler Check:** `npx tsc --noEmit` exited with code 0 (no errors).
- **Production Build:** `npm run build` completed successfully in 2.6s (all 40 pages and routes compiled).

## Remaining Tasks

- User needs to add `SUPABASE_SERVICE_ROLE_KEY` to Vercel Environment Variables.

## Last Updated

2026-09-20
