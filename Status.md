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

- **Fixed Dashboard Profile Picture Display:**
  - Resolved issue where My Learning Dashboard only showed default initial "D" instead of user's uploaded avatar.
  - Updated `src/app/dashboard/page.tsx` profile card to check `profile.avatar_url`, resolving it via `resolveStorageUrl()`.
  - Implemented responsive circular image container with `onError` fallback to the user's initial letter or "D".
  - Verified dashboard updates immediately after navigation from Account Settings without requiring second upload.

- **Fixed Course Thumbnail Upload / Edit ("Invalid storage destination"):**
  - Identified the root cause of "Invalid storage destination" when saving or editing courses: `src/app/api/storage/upload/route.ts` whitelisted only `['banners', 'options', 'avatars', 'site-assets']`, rejecting `courses` folder uploads with HTTP 400.
  - Added `'courses'`, `'test-series'`, `'subjects'`, `'thumbnails'`, `'series'`, `'tests'`, and `'pdfs'` to `ALLOWED_FOLDERS`.
  - Added regex safety checks (`/^[a-zA-Z0-9_-]+$/`) to prevent path traversal while providing descriptive error messages for invalid destinations or unsupported file types.
  - Preserved security rules: only authenticated admins can upload to non-avatar folders; regular users can only upload to `'avatars'`.
  - Updated `src/components/shared/CourseForm.tsx` to resolve existing course thumbnails via `resolveStorageUrl()` in the preview and wrap thumbnail uploads with clear, informative error handling.
  - Maintained behavior: if no new thumbnail is selected while editing an existing course, the existing thumbnail remains untouched; if removed, it updates to `null`; if changed or new, it uploads and saves the secure 10-year signed URL.
  - Updated `src/app/admin/test-series/_components/TestSeriesAdminManager.tsx` to route test series and subject asset uploads through `uploadSiteAsset()` rather than attempting direct uploads to the nonexistent `site-assets` bucket.
- **Improved Homepage Vertical Spacing and Margins:**
  - Resolved excessive whitespace above and below the homepage banner slider and across homepage sections.
  - Reduced top padding between sticky navbar and banner from `pt-24` (96px) to compact responsive `pt-4 sm:pt-6` (16px–24px).
  - Encapsulated `HomeQuickOptions` so it returns `null` cleanly when no options exist, eliminating the empty `py-12` (96px) gap before Featured Courses.
  - Standardized all section padding across Featured Courses, Explore by Category, Why Choose Us, About Us, Contact Us, and CTA to `py-10 sm:py-12 lg:py-14` (40px–56px, reduced from `py-20` / 80px).
  - Reduced section header bottom margins from `mb-16` (64px) to `mb-8 sm:mb-10` (32px–40px) with tighter title-to-subtitle margins (`mb-3`).
- **Implemented Dynamic Homepage Feature Grid (Task 10):**
  - Added compact, modern Feature Grid section placed directly above "Featured Courses" matching the reference design.
  - Implemented 3-column layout on mobile (`grid-cols-3`) and responsive multi-column layout on tablet/desktop (`sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5`).
  - Rendered ONLY image/icon and centered title per card without extraneous text, price, or buttons.
  - Built dedicated Admin management panel at `/admin/feature-grid` allowing administrators to view, add, edit, reorder, enable/disable, upload images, preview, and delete feature grid items.
  - Added "Feature Grid" navigation shortcuts in Admin Dashboard Quick Actions and the Admin Header navigation bar.
  - Reused existing `home_options` Supabase table and storage bucket (`course-pdfs` with `features/` folder) with idempotent migration `20260920_feature_grid_setup.sql`.
  - Seeded 10 default educational feature items (Paid Courses, Free Courses, Free Test Series, Paid Test Series, Paid PDFs, Free PDFs, E-Book & PYQs, Timetable, Syllabus, Quiz) with high-resolution vector SVG icons.
  - Enhanced `/courses` page with `access=free` and `access=paid` filtering, enabling direct navigation from Feature Grid items to filtered course lists.

## Files Updated

- [src/components/shared/HomeFeatureGrid.tsx](src/components/shared/HomeFeatureGrid.tsx)
- [src/lib/feature-grid-presets.ts](src/lib/feature-grid-presets.ts)
- [src/app/admin/feature-grid/page.tsx](src/app/admin/feature-grid/page.tsx)
- [src/app/admin/layout.tsx](src/app/admin/layout.tsx)
- [src/app/admin/page.tsx](src/app/admin/page.tsx)
- [src/app/page.tsx](src/app/page.tsx)
- [src/app/courses/page.tsx](src/app/courses/page.tsx)
- [src/app/api/storage/upload/route.ts](src/app/api/storage/upload/route.ts)
- [supabase/migrations/20260920_feature_grid_setup.sql](supabase/migrations/20260920_feature_grid_setup.sql)
- [Status.md](Status.md)

## Validation Results

- TypeScript check passed via `npx tsc --noEmit` (exit code 0, 0 errors)
- Production build passed via `npm run build` (42/42 pages compiled cleanly)
- Feature Grid verified: rendered directly above Featured Courses with 3-column mobile layout and 10 dynamic items.
- Admin Feature Grid management verified: CRUD, reordering, status toggling, destination routing presets, and storage upload tested.
- Course access filtering verified: `/courses?access=free` and `/courses?access=paid` filter correctly.
- Homepage vertical layout verified: top banner gap reduced, empty quick-options gap removed, section vertical rhythm standardized to `py-10 sm:py-12 lg:py-14`.
- Course thumbnail upload verified: `course-pdfs` storage bucket with `courses/...` paths successfully uploads and generates 10-year signed URLs.
- Dashboard profile avatar verified: displays uploaded profile image with safe fallback to initial letter/"D" on load/error.
- Banner images verified: existing banners updated with signed URLs, returning HTTP 200 image/png.
- Test series questions verified: `POST /api/tests/85c59437-7003-44e0-8df5-714da6b29b19/attempt` returns HTTP 200 with 5 questions and test metadata.
- Storage upload verified: `/api/storage/upload` handles avatars, courses, features, and banners with 10-year signed URLs.
- Profile crop and save flow verified: modal closes, Account Settings stays open, avatar updates and persists on reload.
- Button text contrast verified: white text on all blue buttons in both light and dark themes.

## Remaining Bugs / Blockers

- None.

## Next Task

- None pending. Ready for verification and git push.

## Last Updated

2026-09-20
