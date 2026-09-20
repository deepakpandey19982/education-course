# Education-Course Project Status

## Current Phase

Phase 20 — Dynamic Screen Orientation (Landscape Test Panel / Portrait Site), CORS Validation, and Vercel Environment Alignment

- **Key Implementations:**
  1. **Dynamic Android/Mobile Screen Orientation (`src/lib/orientation.ts`, `src/app/test-series/tests/[testId]/attempt/page.tsx`):**
     - Installed official `@capacitor/screen-orientation@8.0.1` compatible with Capacitor 8 and executed `npx cap sync`.
     - Built `lockTestLandscape()` and `restorePortrait()` in `src/lib/orientation.ts` supporting both native Capacitor Android/iOS and Web Screen Orientation API with graceful fallbacks.
     - Wired lifecycle into `src/app/test-series/tests/[testId]/attempt/page.tsx`:
       - Automatically locks to landscape when the test attempt screen is active.
       - Cleanly restores to portrait when test finishes, when user submits, when back button is pressed, on unmount, or on error.
       - All normal pages (home, courses, dashboard, profile, admin, instructions) remain in portrait.
     - Redesigned test interface layout using `grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[minmax(0,1fr)_320px]` with flexible heights (`min-h-0`) so questions, timer, options, and palette are fully usable without clipping on landscape mobile screens.
  2. **Strict CORS Origin Validation (`src/middleware.ts`, `next.config.ts`):**
     - Removed static wildcard CORS from `next.config.ts` to prevent browser rejection of credentialed requests (`Access-Control-Allow-Credentials: true` cannot be combined with wildcard `*`).
     - Configured `src/middleware.ts` to strictly validate incoming origins (`capacitor://localhost`, `http://localhost`, `https://localhost`, `http://localhost:3000`, `*.vercel.app`) and dynamically reflect the exact calling origin.
  3. **Service-Role Key Alias Expansion (`src/lib/test-series-server.ts`, `src/app/api/health/route.ts`):**
     - Added support for all common aliases: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE`, `SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SECRET`, `SERVICE_KEY`, `SUPABASE_ADMIN_KEY`.
  4. **Homepage Course Card Navigation:**
     - Verified `courseId={course.id}` passed to `CourseCard` on homepage with Next.js `<Link href="/courses/[id]">` wrapper for instant mobile and desktop navigation.

## Files Updated

- [package.json](package.json) — Installed `@capacitor/screen-orientation@8.0.1`.
- [src/lib/orientation.ts](src/lib/orientation.ts) [NEW] — Dynamic orientation management controller.
- [src/middleware.ts](src/middleware.ts) — Refined CORS origin validation without wildcard credentials.
- [next.config.ts](next.config.ts) — Removed static conflicting CORS headers.
- [src/app/test-series/tests/[testId]/attempt/page.tsx](src/app/test-series/tests/[testId]/attempt/page.tsx) — Dynamic orientation lifecycle and landscape layout.
- [src/lib/test-series-server.ts](src/lib/test-series-server.ts) — Expanded service role aliases.
- [src/app/api/health/route.ts](src/app/api/health/route.ts) — Expanded service role aliases.
- [Status.md](Status.md)

## Required Vercel Environment Variables

To allow server-side operations (`orders` insertion and test `questions` retrieval) to succeed on the live Vercel deployment, configure this in **Vercel Project Settings → Environment Variables**:

- **`SUPABASE_SERVICE_ROLE_KEY`** (or `SUPABASE_SERVICE_KEY`) — Secret key from Supabase Dashboard → Settings → API → `service_role`.

*Note: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` are already verified active in Vercel via `/api/health`.*

## Validation Results

- **TypeScript Compiler Check:** `npx tsc --noEmit` exited with code 0 (no errors).
- **Production Build:** `npm run build` completed successfully in 4.4s (all 40 pages and routes compiled).
- **Capacitor Sync:** `npx cap sync` completed with 1 plugin (`@capacitor/screen-orientation@8.0.1`) synced to Android and iOS.

## Last Updated

2026-09-20
