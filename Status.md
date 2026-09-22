# Education-Course Project Status

## Current Phase

Phase 25 — Add Question & Test Series Modals Viewport Responsiveness Fix

- **Problem Statement:**
  - At 100% normal desktop browser zoom, the "Add Question" modal was too tall and its bottom fields and action buttons (Cancel and Add Question / Save Changes) were not accessible or cut off within the viewport.
  - At 75% browser zoom it was forced to fit, but it required a proper viewport-safe flex structure at 100% zoom.
- **Root Cause & Layout Fix:**
  - The "Add Question" modal overlay previously had `p-4 overflow-y-auto` while its container was `w-full max-w-2xl p-6 my-8` without vertical viewport boundaries or internal scroll segregation.
  - Restructured the "Add Question" modal (and related modals) in `src/app/admin/test-series/[seriesId]/page.tsx` with standard viewport-safe flex architecture:
    - **Modal Overlay:** `fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden`
    - **Modal Container:** `bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl`
    - **Modal Header:** `flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900` with series/test breadcrumbs and dedicated close `✕` button.
    - **Form & Scrollable Body:** Form with `flex flex-col flex-1 min-h-0 overflow-hidden` containing a dedicated scrollable body `flex-1 overflow-y-auto min-h-0 p-6 space-y-4`. All fields (Test/Subject scope indicator, Subject dropdown, Question Text, 4 Options A-D, Correct Option pills, Explanation, Marks, Negative Marks, Language) are fully accessible via smooth internal scrolling.
    - **Fixed Modal Footer:** `flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs` keeping Cancel and Add Question / Save Changes buttons permanently visible and accessible at 100% zoom.
- **Constraints Maintained:**
  - Zero database, API, question data structure, subject, payment, auth, or student flow changes.
  - No font downsizing, field removals, or `transform: scale()` workarounds.
  - Preserved existing visual design system, dark/light modes, and multi-test scoping.

## Validation Results

- **TypeScript Typecheck:** `npx tsc --noEmit` exited with code 0 (clean).
- **Production Build:** `npm run build` completed successfully (40 routes compiled).
- **Responsive Viewports:** Fully usable at 100% desktop zoom, 75% zoom, 80% zoom, laptop viewports, and mobile viewports.

---

## Phase 24 — Edit Test Series Details Modal Viewport Responsiveness Fix

- **Problem Statement:**
  - The "Edit Test Series Details" modal worked at 80% browser zoom, but at 100% desktop browser zoom (and smaller laptop viewports), the modal was too tall, overflowing the viewport and cutting off the bottom form controls and Cancel / Save Changes buttons.
- **Root Cause & Layout Fix:**
  - The modal container previously lacked an explicit viewport height restriction and internal scrolling structure, allowing its vertical height to exceed the viewport at 100% zoom.
  - Implemented standard viewport-safe flex modal architecture across both `src/app/admin/test-series/[seriesId]/page.tsx` and `src/app/admin/test-series/page.tsx`:
    - **Modal Overlay:** `fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden`
    - **Modal Container:** `bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl`
    - **Modal Header:** `flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900`
    - **Modal Form & Scrollable Body:** `flex flex-col flex-1 min-h-0 overflow-hidden` with body `flex-1 overflow-y-auto min-h-0 p-6 space-y-4` ensuring Series Title, Description, Series Type (Free/Paid), Thumbnail Image, Display Order, and Published are reachable via internal scrolling.
    - **Modal Footer:** `flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs` with Cancel and Save Changes buttons permanently visible and accessible.
- **Constraints Maintained:**
  - No database, API, question, subject, payment, auth, or student flow changes.
  - No font downsizing or field removal.
  - Preserved existing visual design system and dark/light modes.

## Validation Results

- **TypeScript Typecheck:** `npx tsc --noEmit` exited with code 0 (clean).
- **Production Build:** `npm run build` completed successfully (40 routes compiled).
- **Responsive Viewports:** Fully usable at 100% desktop zoom, 80% zoom, laptop viewports, and mobile viewports.

---

## Phase 23 — Test-Specific Subject + Question Flow Scoping & Verification

- **Root Cause Analysis & Architecture Redesign:**
  1. **Strict Hierarchy Established:**
     ```text
     TEST SERIES
         ↓
     TEST
         ↓
     SUBJECTS INCLUDED IN THAT TEST
         ↓
     QUESTIONS OF THAT TEST + SUBJECT
     ```
  2. **Scoped Questions & Subjects:**
     - **Issue:** In multi-subject tests, question sets risked being loaded globally by subject id or sliced evenly with synthetic array ranges. If tests A and B shared a subject name (e.g. Computer), questions risked bleeding across tests, and subjects with zero questions were excluded from the attempt screen tabs.
     - **Fix:**
       - All questions remain strictly bounded to `test_id = test.id` AND `subject_id = subject.id`.
       - Tests configure which subjects are included (`subject_ids` column and fallback `<!--subjects:[...]-->` encoded in `tests.instructions`).
       - On the student attempt screen (`/test-series/tests/[testId]/attempt`), subject tabs show ONLY the subjects configured for that specific test.
       - Questions are grouped strictly by `question.subject_id === subject.id` without artificial slicing.
       - Questions for Test A + Computer never appear in Test B + Computer.
  3. **Admin Management Flow:**
     - Admin selects Test Series → creates/selects a Test → selects included subjects (Section 4 with question count indicators).
     - Tab 4 (Questions) displays active test context with subject-wise question counts: `Active Test: [Title] • [Total Q] Questions • [Sub1]: count | [Sub2]: count`.
     - Question modal explicitly displays the scoped Test and Subject:
       `Test: [selected test] | Subject: [selected subject]`.
     - When a subject filter is active in Tab 4, "+ Add Question" automatically pre-selects that subject.
     - Questions are edited and deleted strictly within that test scope without affecting other tests.
  4. **Student Experience Alignment:**
     - Series detail pages (`/test-series/[seriesId]` and `/test-series/paid/[seriesId]`) display tests belonging to the series with included subject badges, questions, marks, and duration.
     - Student clicks "Attempt" → Agree & Continue (`/test-series/tests/[testId]/instructions`) → Timed Attempt Interface.
     - Question counter displays `Question {index + 1} of {questionCount}` with active subject badge.
     - Right-side question palette lists each configured subject with exact question count and interactive question status buttons.
     - Solution review cleans any internal metadata tags.

## Validation Results

- **TypeScript Typecheck:** `npx tsc --noEmit` exited with code 0 (clean).
- **Production Build:** `npm run build` completed successfully (40 routes compiled).
- **Multi-Test Isolation & Subject Scoping Test (`scripts/test-hierarchy-verification.mjs`):**
  - Created Series `UP Police Computer Operator 2026` with 3 subjects: Computer, General Awareness, Mental Reasoning.
  - Test A (`Computer Operator 20 Sep 2026`) with 3 subjects (Computer, General Awareness, Mental Reasoning): verified 4 questions (2 Computer, 1 GK, 1 Reasoning).
  - Test B (`Computer Operator 13 Sep 2026`) with 2 subjects (Computer, General Awareness): verified 3 questions (2 Computer, 1 GK, 0 Reasoning).
  - Confirmed 0 questions from Test A leaked into Test B.
  - Confirmed Test B contains strictly 2 subjects and 0 Mental Reasoning questions.
- **Live Localhost API Verification:**
  - `GET /api/test-series/{seriesId}`: HTTP 200 with test cards and exact subject mapping.
  - Rendered public routes `/test-series`, `/test-series/{seriesId}`, `/test-series/tests/{testId}/instructions`, and `/admin/test-series/{seriesId}` returning HTTP 200.

## Last Updated

2026-09-22
