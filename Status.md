# Education-Course Project Status

## Current Phase

Phase 9 — Storage signed URLs, banner image display, avatar persistence & crop flow, test question loading, and theme button styling.

## What Changed

- **Fixed Homepage Banner Images (Task 1):**
  - Identified the root cause of broken banner images: the Supabase Storage bucket `course-pdfs` is private (`public: false`), meaning direct requests to `/storage/v1/object/public/course-pdfs/...` returned HTTP 400 NoSuchBucket.
  - Implemented secure server-side upload and signing via `/api/storage/upload` and `/api/storage/sign` using `getSupabaseAdmin()`.
  - Generated long-lived 10-year signed URLs (`createSignedUrl(path, 315360000)`) for uploaded and existing assets.
  - Directly updated existing database records in `home_banners` with valid signed URLs, verified they return HTTP 200 `image/png`.
  - Updated `HomeBannerSlider.tsx` and `src/app/admin/homepage/page.tsx` with `resolveStorageUrl` to guarantee smooth, persistent rendering on the storefront and in the admin manager.

- **Fixed Profile Image / Avatar Database Error & Persistence (Tasks 2 & 4):**
  - Resolved "Could not find the 'avatar_url' column of 'profiles' in the schema cache".
  - Created `updateUserProfile()` in `src/lib/supabase.ts` which guarantees persistence by saving `avatar_url` into Supabase Auth `user.user_metadata` and safely updating `profiles` without throwing schema cache errors.
  - Updated `getUserProfile()` to merge `user.user_metadata?.avatar_url` with profile table records, ensuring the saved avatar persists seamlessly across page reloads.

- **Fixed Profile Crop Flow (Task 3):**
  - In `src/app/profile/edit/page.tsx`, clicking "Use Cropped Photo" now closes ONLY the crop modal (`cropModalOpen: false`).
  - The main "Account Settings" panel stays open and does not redirect.
  - The cropped image immediately appears in the preview circle.
  - Saving changes updates the profile with a clear inline success confirmation without closing or navigating away from the page.

- **Fixed Test Questions Not Loading (Task 5):**
  - Identified the root cause of "Unable to start test" / "Could not load test questions": `src/app/api/tests/[testId]/attempt/route.ts` queried `subject_id` from the `questions` table, which threw PostgreSQL error `42703 (column questions.subject_id does not exist)`.
  - Removed `subject_id` from the `questions` select query and mapped it dynamically from `testMeta.subject_id` / `subjectMeta.id`.
  - Verified test attempt API (`POST /api/tests/85c59437-7003-44e0-8df5-714da6b29b19/attempt`) returns HTTP 200 with all 5 questions, starting the test attempt cleanly.
  - Added graceful fallback in `TestSeriesAdminManager.tsx` when saving questions if `subject_id` is omitted in the DB schema.

- **Verified Theme Button Text Contrast (Task 6):**
  - Enforced `#ffffff !important` text on `.bg-brand-primary`, `button.bg-brand-primary`, `.bg-blue-600`, `.bg-blue-700`, and `button[class*="bg-blue-"]` in both light and dark themes.
  - Preserved light readable text (`#f8fafc !important`) for outline/ghost buttons in dark mode and dark readable text (`#0f172a`) in light mode.

## Files Updated

- [next.config.ts](next.config.ts)
- [src/lib/supabase.ts](src/lib/supabase.ts)
- [src/app/api/storage/upload/route.ts](src/app/api/storage/upload/route.ts)
- [src/app/api/storage/sign/route.ts](src/app/api/storage/sign/route.ts)
- [src/app/api/tests/[testId]/attempt/route.ts](src/app/api/tests/[testId]/attempt/route.ts)
- [src/app/admin/homepage/page.tsx](src/app/admin/homepage/page.tsx)
- [src/app/admin/test-series/_components/TestSeriesAdminManager.tsx](src/app/admin/test-series/_components/TestSeriesAdminManager.tsx)
- [src/app/profile/edit/page.tsx](src/app/profile/edit/page.tsx)
- [src/components/shared/HomeBannerSlider.tsx](src/components/shared/HomeBannerSlider.tsx)
- [src/app/globals.css](src/app/globals.css)
- [.gitignore](.gitignore)
- [supabase/migrations/20260920_phase9_schema_fixes.sql](supabase/migrations/20260920_phase9_schema_fixes.sql)
- [Status.md](Status.md)

## Validation Results

- TypeScript check passed via `npx tsc --noEmit` (exit code 0, 0 errors)
- Production build passed via `npm run build` (39/39 pages compiled cleanly)
- Banner images verified: existing banners updated with signed URLs, returning HTTP 200 image/png.
- Test series questions verified: `POST /api/tests/85c59437-7003-44e0-8df5-714da6b29b19/attempt` returns HTTP 200 with 5 questions and test metadata.
- Storage upload verified: `/api/storage/upload` handles avatars and banners with 10-year signed URLs, verified HTTP 200 fetch.
- Profile crop and save flow verified: modal closes, Account Settings stays open, avatar updates and persists on reload.
- Button text contrast verified: white text on all blue buttons in both light and dark themes.

## Remaining Bugs / Blockers

- None.

## Next Task

- None pending. Ready for verification and git push.

## Last Updated

2026-09-20
