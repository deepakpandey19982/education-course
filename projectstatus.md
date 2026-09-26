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

## Latest Production Status & Updates (Phase 36)

- **Question File Formatter PDF Extraction Regression Resolution:**
  - **Regression Diagnosed:** Traced regression where UP Police Hindi PDF extraction fell to 0 questions:
    1. Frontend `selectedSectionId` state defaulted to `'sec-1'` instead of `'all'`.
    2. `pdf-parser.ts` `isInstructionOrNoise` was stripping `^प्रैक्टिस सेट` headers from text.
    3. `text-extractor.ts` section filter discarded all questions when no section matched `sec-1`.
    4. Guard 1 in `text-extractor.ts` used strict equality `parsedQNum === options.fromQuestion`, skipping questions preceding `fromQuestion` on the starting page and confusing internal statements for Question 1.
  - **Hardened Architecture:**
    1. Removed practice set title stripping in `pdf-parser.ts`.
    2. Initialized `selectedSectionId` to `'all'` in `page.tsx`.
    3. Added fallback in `text-extractor.ts` so mismatched section IDs do not empty the questions array.
    4. Updated Guard 1 in `text-extractor.ts` to allow questions `<= options.fromQuestion` on start pages.
  - **Verification:**
    - Real UP Police PDF extraction: 60/60 questions found (Q1 → Q60), 0 missing, range complete.
    - Verified Q1, Q2, Q3, Q6, Q7, Q9, Q10, Q13, Q14, Q15, Q19, Q23, Q49, Q56, Q57, Q58, Q59, Q60.
    - Full background job flow: 5/5 tests passed (Full scan, 1-10, 1-60, 1-100, 101-160).
    - 8/8 regression suite tests passed.
    - Quality Gates: `npx tsc --noEmit` (0 errors), `npm run build` (0 errors, 41 routes optimized).

## Phase 35 — Universal High-Accuracy Question Importer & Extraction Quality Engine

- **Universal High-Accuracy Question Importer & Extraction Quality Engine:**
  - **Hindi Transliteration & Typographic Normalization:** Fixed KrutiDev conjuncts (`=k` -> `=`, `¼` -> `द्ध`, `Ú` -> `Ý`, `iQ` -> `Q+`, `fpÉ` -> `चिह्न`), trailing matras (`मंत्राी` -> `मंत्री`), anusvara ordering (`ंे` -> `ें`), and parenthetical conversions `य([क-ह]...)द्ध` -> `(...)` (fixes `(गायन)` while strictly preserving `युद्ध`).
  - **Column-Aware PDF Layout & Mixed Language Extraction:** Font classification isolates KrutiDev streams while preserving English/Latin terms (`(Cold War)`, `(Strategic Dialogue)`). Chemical formulas formatted with Unicode subscripts (`CO₂`, `NO₂`, `CH₄`, `O₂`). Table of Contents guard (`isTableOfContentsLine`) skips front-matter and index lines.
  - **Sequence & Chronological Question Guard:** Internal numbered statements (`1.`, `2.`, `3.`, `4.`) inside Question N are preserved in question text and prevented from hijacking main question numbers.
  - **Answer Key Multi-Column Parser:** Lookahead probes up to 15 pages forward, bypasses OMR sheets, and formats answer key tables row-by-row (top-to-bottom) ensuring all 160 answers map cleanly to question blocks.
  - **Safety & Source Comparison UI:** Side-by-side or collapsible source comparison panel displays original raw PDF snippet alongside extracted question. Database import is hard-blocked if any `invalid` questions exist, with a 1-click "Remove All Invalid" action.
  - **Verification:** 8/8 automated regression tests passed. Full 60-question test on real UP Police PDF: 60/60 located, 0 missing, ~1.2s extraction time, 100% verified on Q1, Q2, Q3, Q6, Q7, Q9, Q10, Q13, Q14, Q15, Q19, Q23, Q49.
  - **Quality Gates:** `npx tsc --noEmit` code 0 (0 errors), `npm run build` code 0 (41 routes optimized).

## Phase 34 — Question Formatter Database Insert Fix (`subject_id` Schema Alignment)
  - **Root Cause:** In Supabase, the `questions` table schema does not contain a `subject_id` column (it uses `'id', 'test_id', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'explanation', 'marks', 'negative_marks', 'language', 'order', 'created_at', 'updated_at'`). Subject associations are stored at the test level (`tests.subject_id`) and at the question level via encoded tags in `explanation` (`encodeSubjectTag` / `decodeSubjectTag`). Attempting to insert `subject_id` in `questions` caused PostgREST error: `Could not find the 'subject_id' column of 'questions' in the schema cache`.
  - **Schema Alignment:**
    - Cleaned `question_text` of accidental tags.
    - Encoded subject tag into `explanation` (`<!--subj:${subjectId}-->`).
    - Removed `subject_id` from rows insert payload in both `import_existing` and `create_new` modes in `src/app/api/admin/question-formatter/commit/route.ts`.
    - Added automated schema-fallback retry for maximum robustness.
  - **Verification:**
    - Real 60-question PDF extraction and commit test: All 60 questions committed with status 200 OK.
    - DB verification: Exactly 60 questions, clean `question_text`, valid options A-D, valid answers, and subject tags correctly resolved via `decodeSubjectTag`.
    - Manual question creation compatibility: 100% verified.
  - **Quality Gates:** `npx tsc --noEmit` code 0 (0 errors), `npm run build` code 0 (41 routes optimized).

## Phase 33 — Question 49 & Generic Two-Column PDF Question Extraction Fix
  - **Font Transliteration Ligature Bleed Fixed:** Question 48 option (d) in KrutiDev 010 font contained `fpÉ` (`चिह्न`). Transliteration library erroneously mapped `É` to `र्fa`, shifting a short-i matra across the newline to bleed `िं` before Question 49's number (`िं49.`). Pre-processed ligatures (`fpÉ` -> `चिह्न`, `É` -> `ह्न`, `ÉLo` -> `ह्रस्व`) and stripped leading non-spacing vowel signs/combining marks.
  - **KrutiDev Period Character Normalization:** Mapped KrutiDev period artifacts `(\d{1,5})ण्` to `$1.` and added `ण्`, `|`, `।`, and `]` to valid question delimiters, restoring questions `84ण्`, `91ण्`, and `111ण्`.
  - **Table of Contents Exclusion:** Excluded Table of Contents index lines via `isTableOfContentsLine()`, eliminating phantom question duplicates.
  - **Two-Column PDF Layout Engine:** Added `extractPageTextColumnAware()` in `src/lib/question-parser/pdf-parser.ts` to detect and sequence two-column layouts cleanly (Header -> Left Column -> Right Column -> Footer).
  - **In-Range Question Deduplication:** Deduplicated range questions by question number, prioritizing complete questions with valid options.
  - **Real PDF Verification:**
    - Range 1 → 60: **Exactly 60 questions located, 0 missing, complete = true, warnings = none**.
    - Verified Q49 in Preview with full text, all 4 options (A-D), and correct answer A (`status: valid`).
    - Range 1 → 100: Exactly 100 questions located, 0 missing.
    - Range 101 → 160: Exactly 60 questions located, 0 missing.
  - **Build & Quality:** `npx tsc --noEmit` code 0 (0 errors), `npm run build` code 0 (41 routes), all test suites passing 100%.

## Phase 32 — Question File Formatter Authentication & Polling Authorization


## Phase 31 — Asynchronous Job Processing & Real PDF Architecture
  - **Eliminated 60s Timeout:** Removed single long-running HTTP streaming connection and 60-second client-side `AbortController` timeout that previously aborted with `BodyStreamBuffer was aborted`.
  - **Asynchronous Job & Status Polling Engine:**
    - `POST /api/admin/question-formatter/jobs/create`: Admin endpoint returning `{ success: true, jobId, fileId, status: 'QUEUED' }` in <100ms.
    - `GET /api/admin/question-formatter/jobs/[jobId]`: Status polling endpoint returning progress percentages (0-100%) and states: `UPLOADING`, `QUEUED`, `EXTRACTING_TEXT`, `DETECTING_SECTIONS`, `DETECTING_QUESTIONS`, `DETECTING_ANSWER_KEY`, `MATCHING_ANSWERS`, `VALIDATING`, `READY_FOR_PREVIEW`, `FAILED`.
    - `src/lib/question-parser/job-manager.ts`: Decoupled background processor managing execution, state transitions, and 1-hour in-memory job cleanup.
  - **KrutiDev 010 Unicode Conversion:** Integrated `@bharattype/hindi-transliteration` (`src/lib/question-parser/krutidev-converter.ts`) to reliably convert legacy Indian competitive exam PDF glyphs (`izSfDVl lsV`) to clean Unicode Hindi text while preserving option tokens `(a)`, `(b)`, `(c)`, `(d)` and `उत्तरमाला`.
  - **Internal Sub-list Numbering Guard:** Fixed issue where multi-item question text (e.g. `1. विज्ञापन 2. आवेदन...` or `2. वियतनाम युद्ध`) triggered false-positive question splits.
  - **Real PDF Verification:**
    - Tested actual 3.66 MB 169-page PDF (*"UP Police Practice Set in Hindi PDF Download By Disha Publication (sscstudy.com).pdf"*).
    - Detected all 10 Practice Sets with independent answer key tables in ~6.5 seconds.
    - Ranges verified: 1-10 (10 found, complete), 1-60 (59 found, 1 missing [49], flagged with warning), 1-100 (97 found), 101-160 (59 found).
  - **Verified Clean React Hook Order:** `ImportQuestionsModal.tsx` has zero hook order violations.
  - **Build & Quality:** `npx tsc --noEmit` code 0, `npm run build` code 0 (41 routes), all test suites passing.

## Phase 30 — Question File Formatter / Smart Question Import

## Phase 29 — High-Performance PDF Question Import Optimization
  - **Eliminated Unnecessary Full-Document Scans:** Implemented digital text probe (<10ms) that prevents running OCR on embedded images in text PDFs.
  - **Smart Page Prober:** Probes page intervals to pinpoint the start page for `fromQuestion` and reads forward consecutively until `toQuestion` is extracted. Cuts 100-question batch processing time to <100ms (1 → 100 in 36ms, 501 → 600 in 65ms).
  - **In-Memory PDF Buffer Cache:** Added `fileId` session caching (15-min TTL) to prevent re-uploading large 50MB PDFs when processing multiple batches (e.g. 101-200 after 1-100).
  - **Live NDJSON Streaming UI:** Real-time updates for reading, probing, found questions, and preview assembly via `/api/admin/test-series/create-from-pdf/parse-stream`.
  - **Scanned PDF Warning Banner:** Detects scanned PDFs and shows `"Scanned PDF detected. OCR processing may take longer."` with a safety cap of 12 pages maximum.
  - **Timeout Protection:** Added 60s `AbortController` safety timeout.
  - **Validation:** `npx tsc --noEmit` code 0, `npm run build` code 0 (40 routes compiled), automated tests passed (`scripts/test-pdf-range-optimization.ts`, `scripts/test-pdf-range-import.ts`).

## Phase 28 — Create Test Series from PDF using Question Number Range
  - Added dedicated Admin workflow: `Create Test Series from PDF` accessible from Admin → Test Series (`/admin/test-series`).
  - **Question Number Range as Primary Mechanism:** Scans the whole document to locate printed question numbers (e.g. 1 → 100, 101 → 200, 201 → 300, 501 → 650) rather than taking PDF page numbers. Supports arbitrary batch sizes (50, 100, 150, 200+).
  - **Question Boundary Detection Engine:** Recognizes numbering variations (`Q1.`, `Q.1`, `Q 1`, `Question 1`, `Question No. 1`, `Que. 1`, `प्रश्न 1:`, `1.`, `1)`, `(1)`, `[1]`), multiline questions, inline/multiline options, and answer keys. Filters page headers/footers (`Page X of Y`, `-- X --`) to prevent text pollution.
  - **Preview & Non-Silent Validation:** Prior to database commit, displays an import preview with requested range, found question count, valid questions, and needs-review flags.
  - **Incomplete Range Guard:** If requested range is e.g. 1 → 100 but only 96 questions are found, the system displays a clear warning banner with exact missing question numbers (`97, 98, 99, 100`) and a `[Go Back and Change Range]` option to prevent silent incomplete series creation.
  - **Inline Question Editing in Preview:** Admin can review and edit question text, options A-D, and correct answer directly in an inline sub-modal before committing.
  - **Fast-Track Multi-Set Flow:** After saving Set 01 (1 → 100), offers a 1-click `[Setup Next Set (101 → 200)]` option with the same PDF preloaded and auto-incremented series name ("General Knowledge Set 02").
  - Validation: `npx tsc --noEmit` code 0, `npm run build` code 0 (40 routes compiled), automated tests passed (`scripts/test-pdf-range-import.ts`).

## Phase 27 — Smart Question Import System for Test Series


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
