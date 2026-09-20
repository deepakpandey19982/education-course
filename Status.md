# Education-Course Project Status

## Current Phase

Phase 21 — Production Same-Origin Relative API Routing, Web Orientation Safety, and Vercel Environment Alignment

- **Root Cause Analysis & Fixes:**
  1. **Test Series Questions ("Failed to fetch" / "Network request failed"):**
     - **Root Cause:** In `src/lib/api-config.ts`, `getApiUrl(path)` was prepending absolute URLs (`getApiBaseUrl() + path`) for web browser requests. On mobile browsers accessing via different aliases/preview domains or with credentials (`credentials: 'include'`), calling an absolute URL triggered cross-origin checks and preflight failures, causing Chrome to reject the request with `TypeError: Failed to fetch`.
     - **Fix:** Refactored `getApiUrl(path)` in `src/lib/api-config.ts` so that all standard web browsers (`!isCapacitorNative()`) always use same-origin relative URLs (`/api/...`). This completely eliminates CORS preflights, domain mismatches, and network errors.
  2. **Payment Creation ("Failed to create internal order"):**
     - **Root Cause:** The `orders` table in Supabase has Row Level Security (RLS) enabled with only a `SELECT` policy for normal students and no `INSERT` policy for non-admin students. Order creation in `/api/payments/create` must run via `getSupabaseAdmin()` with service-role privileges. In Vercel Production, `SUPABASE_SERVICE_ROLE_KEY` is not yet configured (verified via live probe to `/api/health`), causing the server route to return HTTP 500.
     - **Fix:** Expanded alias resolution for `SUPABASE_SERVICE_ROLE_KEY` and updated client error handlers to present clear, descriptive diagnostics.
  3. **Homepage "View Course" Navigation:**
     - **Root Cause:** In `src/app/page.tsx`, `courseId` was not passed as a prop to `<CourseCard>`. The button onClick checked `if (courseId)`, which was `undefined`.
     - **Fix:** Passed `courseId={course.id}` and wrapped the thumbnail, title, and button in standard Next.js `<Link href={targetHref}>` tags.
  4. **Orientation Safety:**
     - **Root Cause:** Calling `screen.orientation.lock()` on desktop or mobile Chrome without fullscreen was throwing `NotSupportedError` warnings in console.
     - **Fix:** Added graceful silent handling for web browsers in `src/lib/orientation.ts` so web test attempts never fail or produce noisy logs, while native Capacitor Android apps lock to landscape and restore to portrait using `@capacitor/screen-orientation`.

## Required Action in Vercel Dashboard

To enable live order creation and test question retrieval to bypass database RLS on the deployed Vercel site:
1. Go to **Vercel Dashboard → Project Settings → Environment Variables**.
2. Add:
   - **Key:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** `[Your service_role key from Supabase Dashboard → Settings → API]`
   - **Environment:** Select **Production**, **Preview**, and **Development**.
3. Trigger a redeployment.

## Validation Results

- **TypeScript Typecheck:** `npx tsc --noEmit` exited with code 0 (clean).
- **Production Build:** `npm run build` completed successfully (40 routes compiled).
- **Capacitor Sync:** Synced `@capacitor/screen-orientation@8.0.1` to Android and iOS.

## Last Updated

2026-09-20

