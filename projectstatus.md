# Project Structure

```text
Education-Course/
├── android/                     # Android Capacitor application
├── ios/                         # iOS Capacitor application
├── public/                      # Public static assets
├── src/
│   ├── app/                     # Next.js pages, layouts, and API routes
│   │   ├── about/
│   │   ├── admin/               # Course, homepage, and test series administration
│   │   │   └── test-series/     # Central test series hub & [seriesId] 4-tab manager
│   │   ├── api/                 # Contact, course download, payment, and test series APIs
│   │   ├── contact/
│   │   ├── courses/
│   │   ├── dashboard/
│   │   ├── login/
│   │   ├── profile/
│   │   ├── signup/
│   │   ├── test-series/         # Student test series catalog, detail, instructions, & attempt
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── shared/              # Shared course, navigation, footer, and home UI
│   │   └── ui/                  # Reusable UI components
│   ├── lib/                     # Supabase client configuration & test series helpers
│   └── types/                   # TypeScript type definitions
├── supabase/                    # Database schema and migrations
├── .env.local                   # Local environment settings
├── capacitor.config.ts          # Capacitor configuration
├── next.config.ts               # Next.js configuration
├── package.json                 # Project dependencies and scripts
└── README.md
```

## Latest Production Status & Updates (Phase 27)

- **Smart Question Import System for Test Series:**
  - Added smart bulk question import alongside existing manual question creation (`+ Add Question` and `📥 Import Questions`).
  - Completely additive: zero changes or breaks to manual creation, test series, subjects, tests, attempts, timer, scoring, solution review, payments, or courses.
  - Supported formats: PDF (text and scanned OCR fallback), Word DOCX, Excel XLSX & CSV (flexible column mapping), and Images JPG/JPEG/PNG with Tesseract OCR (English & Hindi).
  - Subject auto-detection and matching against existing series subjects, duplicate detection against database and within upload batch, and comprehensive preview/review modal before database insert.
  - Viewport-safe responsive design (`max-h-[92vh]`, internal scroll, sticky footer) fully functional at 100%, 90%, 80%, 75% zoom and mobile/tablets.
  - Validation & Bug Fixes: Fixed React hook order in `ImportQuestionsModal` where `useMemo` hooks were positioned after an early return; `npx tsc --noEmit` code 0, `npm run build` code 0 across all 40 routes, automated tests passed.

## Phase 26 — Comprehensive System Verification & GitHub Sync

## Phase 25 — Add Question & Test Series Modals Viewport Responsiveness Fix

## Phase 24 — Edit Test Series Details Modal Viewport Responsiveness Fix

- **Edit Test Series Details Modal Viewport Responsiveness Fix:**
  - Standardized viewport-safe flex layout (`max-h-[90vh]`, fixed header, `overflow-y-auto min-h-0` body, `shrink-0` footer) in both `src/app/admin/test-series/[seriesId]/page.tsx` and `src/app/admin/test-series/page.tsx`.
  - Fully eliminates cutoff issues at 100% desktop browser zoom, laptop screens, and mobile viewports while preserving all visual styling, fields, and 80% zoom usability.
  - Zero database, API, question, subject, or student attempt flow modifications.

## Phase 23 — Test-Specific Subject & Question Flow Scoping

- **Test-Specific Subject & Question Flow Scoping:**
  1. **Strict Hierarchy Established:** `TEST SERIES -> TEST -> SUBJECTS INCLUDED IN THAT TEST -> QUESTIONS OF THAT TEST + SUBJECT`.
  2. **Scoped Questions & Subjects:**
     - Questions strictly bounded to `test_id = test.id` AND `subject_id = subject.id`.
     - Tests configure which subjects are included (`subject_ids` and fallback `<!--subjects:[...]-->` in instructions).
     - On student attempt screen (`/test-series/tests/[testId]/attempt`), subject tabs show ONLY the subjects configured for that specific test.
     - Questions are grouped strictly by `question.subject_id === subject.id` without synthetic slicing.
     - Confirmed Test A + Computer questions never appear in Test B + Computer.
  3. **Admin Management Flow:**
     - Admin selects Test Series → creates/selects a Test → selects included subjects (Section 4 with question count indicators).
     - Tab 4 (Questions) displays active test context with subject-wise question counts.
     - Question modal explicitly displays scoped Test and Subject with pre-selection from active filter.
     - Questions are stored, loaded, edited, and deleted strictly within test scope.
  4. **Student Experience Alignment:**
     - Series detail pages (`/test-series/[seriesId]` and `/test-series/paid/[seriesId]`) display tests belonging to the series with included subject badges, questions, marks, and duration.
     - Student clicks "Attempt" → Agree & Continue (`/test-series/tests/[testId]/instructions`) → Timed Attempt Interface.
     - Question counter displays `Question {index + 1} of {questionCount}` with active subject badge.
     - Right-side question palette lists each configured subject with exact question count and interactive question status buttons.
- **Verification:**
  - `npx tsc --noEmit`: Code 0 (clean).
  - `npm run build`: Code 0 (clean, 40 routes).
  - Multi-Test Isolation & Subject Scoping Test (`scripts/test-hierarchy-verification.mjs`): Passed.
  - Live Endpoint Probe: Free, Paid, and attempt endpoints verified with HTTP 200.

## Last Updated

2026-09-22
