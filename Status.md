# Education-Course Project Status

## Current Phase

Phase 9 — Account settings, profile media, course access, admin numeric UX, and theme updates.

## What Changed

- Fixed the Supabase password recovery issue by validating the recovery session before password updates and by exchanging the recovery code when present on reset links.
- Added and preserved the existing Forgot Password and Reset Password flow using the same Supabase Auth setup used across login/signup.
- Added a full Change Password section to the profile/account settings page with current password verification, validation, success/error states, and no unnecessary logout.
- Added profile photo management to account settings, including image validation, upload to the existing Supabase site-assets bucket, and immediate preview plus removal back to the default avatar state.
- Added a clear Back control and a close action to the Account Settings page so users can exit cleanly without breaking navigation.
- Added a password visibility toggle to the Login page while preserving the existing sign-in logic.
- Added a clear Course Access option to the admin course form with Free/Paid handling, automatic zeroing for free courses, and disabled discount/price logic for free access.
- Updated storefront course displays so free courses appear as FREE and paid courses keep existing pricing and discount output, while free access does not trigger Razorpay.
- Added consistent zero-clearing-on-focus behavior to the relevant numeric admin fields so entering numbers is smoother and values restore to 0 on blur when left empty.
- Added a dark/night mode toggle to the main navigation that persists across refreshes and applies across the app shell.
- Fixed the image upload "Bucket not found" error by ensuring the storage configuration safely falls back to the existing `course-pdfs` bucket if `site-assets` is not present, avoiding duplicate auth/storage complexities.
- Completely redesigned the Admin Homepage Banners page to feature a robust List Manager displaying existing banners and quick-links alongside previews and configuration details.
- Integrated native HTML5 drag-and-drop to easily reorder banners and quick-links, with automatic sequential saving to the database.
- Upgraded the banner and quick-link upload UI with distinct "Upload Image" inputs, showing filename and real-time previews before saving, alongside a specific "Change Image" flow for quick single-banner updates.
- Ensured seamless deletion of banners and quick-links that automatically patches `order` gaps (e.g., 1, 2, 4 becomes 1, 2, 3).
- Refined the Homepage Banner Slider to dynamically adjust its responsive height and aspect ratio for mobile devices without letterboxing or distortion on small screens.

## Files Updated

- [src/app/login/page.tsx](src/app/login/page.tsx)
- [src/app/forgot-password/page.tsx](src/app/forgot-password/page.tsx)
- [src/app/reset-password/page.tsx](src/app/reset-password/page.tsx)
- [src/app/profile/edit/page.tsx](src/app/profile/edit/page.tsx)
- [src/app/courses/[id]/CourseDetailsClient.tsx](src/app/courses/[id]/CourseDetailsClient.tsx)
- [src/components/shared/CourseForm.tsx](src/components/shared/CourseForm.tsx)
- [src/components/shared/CourseCard.tsx](src/components/shared/CourseCard.tsx)
- [src/components/shared/Navbar.tsx](src/components/shared/Navbar.tsx)
- [src/app/globals.css](src/app/globals.css)
- [src/lib/supabase.ts](src/lib/supabase.ts)
- [src/types/supabase.ts](src/types/supabase.ts)
- [src/app/admin/homepage/page.tsx](src/app/admin/homepage/page.tsx)
- [src/components/shared/HomeBannerSlider.tsx](src/components/shared/HomeBannerSlider.tsx)
- [src/lib/supabase.ts](src/lib/supabase.ts)
- [Status.md](Status.md)

## Validation Results

- TypeScript check passed via `npx tsc --noEmit`
- Production build passed via `npm run build`
- The homepage banner manager and slider components compile cleanly and handle responsive images properly.

## Remaining Bugs / Blockers

- None for the homepage banner manager system.

## Next Task

- Finish the release workflow: commit, push, and confirm the working tree is clean.

## Last Updated

2026-09-18
