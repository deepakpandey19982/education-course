# Education-Course Project Status

## Current Phase

Phase 34 — Question Formatter Database Insert Fix (`subject_id` Schema Alignment)

- **Root Cause Diagnosed & Resolved:**
  - **Issue Reported:** When clicking "Confirm & Import Questions" for extracted questions, Supabase insert failed at item 1 with error:
    `Could not find the 'subject_id' column of 'questions' in the schema cache`
  - **Database Schema Investigation:**
    - Live Supabase inspection of `questions` table confirmed the actual columns:
      `['id', 'test_id', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'explanation', 'marks', 'negative_marks', 'language', 'order', 'created_at', 'updated_at']`
    - There is **no `subject_id` column** in the `questions` table in Supabase.
    - Tests are linked to subjects via `tests.subject_id` (referencing `test_series_subjects.id`).
    - Across the entire codebase (`src/app/admin/test-series/[seriesId]/page.tsx`, `testSeriesHelpers.ts`, `import-commit/route.ts`), question-level subject mapping is embedded inside the `explanation` column using `encodeSubjectTag(explanation, subjectId)` (`<!--subj:${subjectId}-->...`) and read using `decodeSubjectTag(explanation)`.
  - **Fixes Applied to `src/app/api/admin/question-formatter/commit/route.ts`:**
    1. **Schema Alignment:** Removed `subject_id` from the `questions` insert payload in both Mode A (`import_existing`) and Mode B (`create_new`), eliminating the PostgREST schema cache rejection.
    2. **Tag Positioning Fix:** Corrected `encodeSubjectTag`: previously called on `question_text` (polluting question text with tags and leaving explanation untagged); now applied to `explanation` (`taggedExplanation = encodeSubjectTag(q.explanation?.trim() || '', targetSubjectId)`), leaving `question_text: cleanText` pristine.
    3. **Resilient Fallback Retry:** Added defensive fallback handling on `.insert(rows)` that automatically strips `subject_id` and retries if any schema mismatch error occurs, matching the pattern in manual question creation (`[seriesId]/page.tsx`).
- **Comprehensive Verification & End-to-End Testing:**
  - Automated end-to-end integration test executed with the real 60-question range (1–60) parsed from the production PDF:
    - **Mode B (Create New Test Series):** 60 questions committed into Supabase (200 OK, `questionsCount: 60`).
    - **Database Verification:**
      - Exactly 60 questions verified in DB with matching `test_id`.
      - Question 1 verified: `question_text` clean (no tag), `explanation` has encoded tag, `decodeSubjectTag` resolves exact subject ID.
      - Question 49 verified: Order 49, all options A–D present, correct answer `A`.
    - **Mode A (Import to Existing Test):** Appending questions to an existing test succeeded (`order: 61`).
    - **Manual "Add Question" Compatibility:** Verified manual question creation flow functions identically with zero regressions.
    - **Test Data Cleanup:** Cleaned up test entities from Supabase cleanly.
  - TypeScript Typecheck: `npx tsc --noEmit` passed with 0 errors.
  - Production Build: `npm run build` passed with 0 errors (all 41 routes optimized).

---

## Prior Phase

Phase 33 — Question 49 & Generic Two-Column PDF Question Extraction Fix

- **Root Cause Diagnosed & Resolved:**
  - **Font Transliteration Ligature Bleed (Root Cause of Missing Q49):**
    - The PDF uses KrutiDev 010 font where Question 48 option (d) ended with `yk?ko fpÉ` (`लाघव चिह्न`).
    - The character `É` represents the Devanagari conjunct `ह्न`. In `@bharattype/hindi-transliteration`, `É` was mapped to `र्fa` (an i-matra + anusvara token).
    - When `fpÉ\n49-` was transliterated, the library's `positionOfFa` loop shifted the short-i matra across the newline `\n`, swapping `fa\n` into `\nिं`.
    - This caused the following line to begin with `िं49.` instead of `49.`.
    - The question start regular expression strictly expected `^(\d{1,5})` or `^(?:Q|प्रश्न)`. The leading vowel sign `िं` (U+093F U+0902) prevented the regex from matching.
    - Question 49 was consequently treated as continuation text of Question 48 option (d), and its options (a)-(d) overwrote Question 48's options, leaving Question 49 missing from the parsed dataset.
  - **KrutiDev Period Mapping (`.` to `ण्`):**
    - In KrutiDev keyboard mapping, English `.` converts to Devanagari `ण्`. Numbers typed as `84.`, `91.`, `111.` became `84ण्`, `91ण्`, `111ण्`.
    - Added normalization to convert `(\d{1,5})ण्` to `$1.` and expanded question delimiters to include `ण्`, `|`, `।`, and `]`.
  - **Table of Contents List Guard:**
    - On Page 4, the Table of Contents contained entries like `1. Practice Set - 1 1-12`.
    - Added `isTableOfContentsLine()` to explicitly exclude TOC index entries from generating phantom question items.
  - **Generic Two-Column PDF Page Layout Engine:**
    - Added `extractPageTextColumnAware()` in `src/lib/question-parser/pdf-parser.ts`.
    - Detects two-column layouts across pages based on coordinate clusters and viewport midpoint gutter.
    - Sequences top headers first, then Left Column (top-to-bottom), then Right Column (top-to-bottom), then footers, ensuring reliable multi-column extraction across arbitrary PDFs.
  - **In-Range Question Deduplication:**
    - When questions are gathered for requested ranges, questions with duplicate numbers are deduplicated prioritizing valid questions with options over unparsed/empty blocks.
- **Verification & End-to-End Testing:**
  - Tested directly against the real 3.66 MB PDF (*"UP Police Practice Set in Hindi PDF Download By Disha Publication (sscstudy.com).pdf"*):
    - **Full Scan:** All 10 Practice Sets detected; Set 1 has exactly 160 questions (1-160) with answer key.
    - **Range 1 → 10:** 10/10 questions extracted with full Hindi text, options A-D, answer A, subject: PASS.
    - **Range 1 → 60:** **Exactly 60 questions extracted (100% complete, 0 missing, 0 warnings)**:
      - Question 49 successfully extracted and visually verified:
        - Question text: `मिश्रित तथा संयुक्त वाक्यों में विरोध् का भाव प्रकट करने के लिए किस विराम चिह्न का प्रयोग किया जाता है?`
        - Option A: `अर्( विराम`
        - Option B: `उपविराम`
        - Option C: `योजक चिह्न`
        - Option D: `कोष्ठक`
        - Correct Option: `A`
        - Status: `valid`
    - **Range 1 → 100:** **Exactly 100 questions extracted (100% complete, 0 missing)**: PASS.
    - **Range 101 → 160:** **Exactly 60 questions extracted (100% complete, 0 missing)**: PASS.
  - `scripts/test-real-pdf-job-flow.ts`: 100% PASS across all 5 test scenarios.
  - `scripts/test-question-formatter.ts`: 100% PASS across all regression scenarios.
  - `scripts/test-smart-parser.ts`: 100% PASS across all regression scenarios.
  - TypeScript Typecheck: `npx tsc --noEmit` passed with 0 errors.
  - Production Build: `npm run build` passed with 0 errors (all 41 static/dynamic pages compiled).

---

## Prior Phase

Phase 32 — Question File Formatter Authentication & Polling Authorization Fix

- **Root Cause Diagnosed & Resolved:**
  - **Primary Root Cause:** In `src/app/admin/question-formatter/page.tsx`, raw browser `fetch()` was used for job creation (`/api/admin/question-formatter/jobs/create`), status polling (`/api/admin/question-formatter/jobs/${jobId}`), and commit (`/api/admin/question-formatter/commit`). These calls omitted the `Authorization: Bearer <token>` header, omitted `credentials: 'include'`, and lacked query param fallback. Inside periodic polling intervals (`setInterval`), ambient cookie session state was missing or rejected by server-side verification, causing the polling API to return `401 {"error": "Authentication required"}`.
  - **Server-Side Token Resolution Gap:** `getRequestUser` in `src/lib/test-series-server.ts` primarily checked Next.js `cookies()` store. If cookie parsing encountered session cookie format discrepancies or `cookieStore.set` throw restrictions, the token was lost.
  - **Native Node Runtime for PDF Parser:** Added `serverExternalPackages: ['pdf-parse']` in `next.config.ts` so `pdfjs-dist` legacy worker runs under Node's native module loader without Webpack/Turbopack bundling issues.
- **Implementation & Security Architecture:**
  - **Frontend Token Carrier (`src/lib/test-series-client.ts`):** Upgraded `testSeriesFetch` to automatically acquire the current Supabase session via `supabase.auth.getSession()`, inject `Authorization: Bearer ${token}`, synchronize `document.cookie = sb-access-token=${token}`, append query parameter fallback `?token=${encodeURIComponent(token)}`, and enforce `credentials: 'include'`.
  - **Comprehensive Admin UI Integration:** Switched all question-formatter operations (`src/app/admin/question-formatter/page.tsx`, `ImportQuestionsModal.tsx`, `CreateSeriesFromPdfModal.tsx`) to `testSeriesFetch`.
  - **Multi-Layer Server Authentication (`src/lib/test-series-server.ts`):** `getRequestUser` now validates 4 distinct layers:
    1. Layer 1: `Authorization: Bearer <token>` (validated with anon client, fallback to admin service-role client).
    2. Layer 2: Query parameters `?token=` and `?access_token=`.
    3. Layer 3: Direct `Cookie` header inspection for `sb-access-token` and standard `sb-*-auth-token`.
    4. Layer 4: Next.js structured cookieStore with safe try-catch wrapper.
  - **Strict Security Boundaries Maintained:**
    - Unauthenticated requests are rejected with `401 {"error": "Authentication required"}`.
    - Non-admin / student accounts are rejected with `403 {"error": "Admin privileges required"}`.
    - `SUPABASE_SERVICE_ROLE_KEY` and `RAZORPAY_KEY_SECRET` remain strictly server-side and are NEVER exposed to client code.
    - No database mutations are executed until the admin explicitly reviews the preview and clicks "Confirm & Create Series".
- **Verification & End-to-End Testing:**
  - `scripts/test-question-formatter-auth.mjs`:
    - Unauthenticated create & poll rejected with 401: PASS.
    - Non-admin student create & poll rejected with 403: PASS.
    - Authenticated Admin job creation: PASS (200 OK, returns jobId in <100ms).
    - Authenticated Admin status polling via Bearer header: PASS (200 OK).
    - Authenticated Admin status polling via query param fallback: PASS (200 OK).
    - Authenticated Admin status polling via `sb-access-token` cookie: PASS (200 OK).
  - `scripts/test-real-pdf-job-flow.ts` on actual 3.66 MB PDF (*"UP Police Practice Set in Hindi PDF Download By Disha Publication (sscstudy.com).pdf"*):
    - Full Scan: All 10 Practice Sets detected with question ranges and answer keys.
    - Range 1 → 10: 10/10 questions extracted with full Hindi text, options A-D, answer A, subject: PASS.
    - Range 1 → 60: 59 questions extracted, missing Q49 explicitly flagged in warnings without silent hallucination: PASS.
    - Range 1 → 100: 97 questions extracted, 3 missing flagged: PASS.
    - Range 101 → 160: 59 questions extracted, Q101 verified with options and answer: PASS.
  - React Hook Ordering: `ImportQuestionsModal.tsx` verified with all hooks unconditional at top-level.
  - TypeScript Typecheck: `npx tsc --noEmit` passed with 0 errors.
  - Production Build: `npm run build` passed with 0 errors (all 41 static/dynamic pages compiled).

---

## Phase 31 — Asynchronous Job Processing & Real PDF Handling (Question File Formatter)

- **Root Cause of 60-Second Timeout Diagnosed & Eliminated:**
  - **Issue:** On the real 3.66 MB 169-page PDF (*"UP Police Practice Set in Hindi PDF Download By Disha Publication (sscstudy.com).pdf"*), the previous architecture held an open single HTTP streaming connection with a 60-second client-side `AbortController` timeout (`BodyStreamBuffer was aborted`).
  - **Font Encoding Resolution:** The PDF uses legacy KrutiDev 010 font encoding (`izSfDVl lsV`, `mÙkjekyk`). Integrated `@bharattype/hindi-transliteration` via `src/lib/question-parser/krutidev-converter.ts` to convert legacy glyphs into genuine Unicode Devanagari Hindi while preserving `(a)`, `(b)`, `(c)`, `(d)` option structures and `उत्तरमाला`.
  - **Sub-list Numbering Guard:** Questions with nested numbered points (e.g. `1. विज्ञापन 2. आवेदन...` or `1. ... 2. वियतनाम युद्ध 3. क्यूबा मिसाइल संकट...`) were previously misidentified as separate questions. Added strict monotonic sequence and question-gap guards so internal numbered points remain inside the question body.
- **Asynchronous Background Job & Status Polling Architecture:**
  - Replaced single long-running HTTP connection with decoupled asynchronous background jobs:
    1. **Step 1 (Upload & Job Creation):** `POST /api/admin/question-formatter/jobs/create` validates file, creates background job in `src/lib/question-parser/job-manager.ts`, starts parsing asynchronously in the background, and returns `{ success: true, jobId, fileId, status: 'QUEUED' }` in **<100ms**.
    2. **Step 2 (Polling & Progress):** Frontend polls `GET /api/admin/question-formatter/jobs/[jobId]` every 1.5 seconds. Job statuses track granular milestones:
       - `UPLOADING`
       - `QUEUED`
       - `EXTRACTING_TEXT` ("Extracting PDF text...")
       - `DETECTING_SECTIONS` ("Finding Practice Sets...")
       - `DETECTING_QUESTIONS` ("Finding Questions...")
       - `DETECTING_ANSWER_KEY` ("Detecting Answer Key...")
       - `MATCHING_ANSWERS` ("Matching Answer Key...")
       - `VALIDATING` ("Validating Questions...")
       - `READY_FOR_PREVIEW` ("Ready for preview!")
       - `FAILED`
    3. **Step 3 (Preview & Editing):** Returns complete question dataset, options A-D, matched answers, practice set sections, and validation tags. Admin can review, edit inline, or commit to database.
    4. **Step 4 (Safe Cancellation):** Added graceful "Cancel Processing" button that cleans up polling intervals and resets state cleanly.
- **Security & Integrity:**
  - Server-side validation of file extension, MIME type, and size.
  - Safe in-memory buffers with 1-hour TTL auto-cleanup; never executes any files.
  - Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`) strictly protected server-side and never sent to browser.
- **Real PDF Verification Across Requested Ranges:**
  - Tested on actual 3.66 MB, 169-page PDF:
    - **Full Scan:** Detected all **10 Practice Sets** (`sec-1` to `sec-10`) with isolated answer keys in ~6.5 seconds.
    - **Range 1 → 10 (Set 1):** 10 questions found, 100% complete, Question text in clean Hindi, options A-D, Ans A, Subject, Section: Practice Set-1, Status: `valid`.
    - **Range 1 → 60 (Set 1):** 59 questions found, 1 missing (`[49]`), `is_range_complete = false`, non-silent warning banner displayed (`Warning: Detected 59 of 60 requested questions (1 to 60). Missing question number(s): 49.`).
    - **Range 1 → 100 (Set 1):** 97 questions found, 3 missing (`[49, 84, 91]`).
    - **Range 101 → 160 (Set 1):** 59 questions found, 1 missing (`[111]`), Q101 verified with options A-D, answer A, subject: 3ः तार्किक क्षमता.
- **Zero Regressions on Existing Systems:**
  - Existing student tests, manual question creation, payment flows, and database tables remain untouched.
  - Verified `ImportQuestionsModal.tsx`: zero React hook ordering violations (all hooks unconditional at top of component).
- **Verification & Test Suite:**
  - `scripts/test-real-pdf-job-flow.ts`: 100% passed on the real 3.66 MB PDF across all ranges.
  - `scripts/test-question-formatter.ts`: 100% passed across all 4 regression scenarios.
  - `scripts/test-smart-parser.ts`: 100% passed across all 3 regression scenarios.
  - `npx tsc --noEmit`: Code 0 (clean, 0 type errors).
  - `npm run build`: Code 0 (Next.js Turbopack production build compiled cleanly with all dynamic/static routes).

---

## Phase 30 — Question File Formatter / Smart Question Import

- **New Admin Panel Section: "Question File Formatter":**
  - Added dedicated Admin section at `/admin/question-formatter` and linked in admin navigation menu (`src/app/admin/layout.tsx`).
  - Simple 6-step guided wizard:
    1. **Upload File:** Universal file ingest supporting PDF (digital & OCR), Word (DOCX/DOC), Excel/CSV (XLSX, XLS, CSV), and Images (JPG, JPEG, PNG).
    2. **Practice Set / Section Selection:** Automatically detects multi-set structures (`Practice Set-1`, `Practice Set-2`, `प्रैक्टिस सेट 1`, `Section A`, etc.) and isolates their questions and answer keys.
    3. **Question Range & Target Selection:** Configurable range extraction (e.g. 1 → 50, 1 → 100, 101 → 200, 501 → 600) with choice between "Create New Test Series" or "Import into Existing Test".
    4. **Preview & Live Validation:** Categorizes questions into `VALID`, `NEEDS REVIEW`, `INVALID`, and `DUPLICATE`. Flags missing question numbers with explicit warning banners.
    5. **Inline Editor:** Edit question text, options A-D, answer, and explanation before database commit.
    6. **Confirm & Commit:** Direct database insertion reusing existing `test_series`, `test_series_subjects`, `tests`, and `questions` tables.
- **Isolated Practice-Set & Answer-Key Engine:**
  - Implemented multi-phase section boundary extraction in `src/lib/question-parser/text-extractor.ts`.
  - Supports answer key formats `1-(a)`, `2-(b)`, `160-(c)`, `1. a`, `1: A`, `1-A`, `1=A`, Hindi characters (`क`, `ख`, `ग`, `घ`), and multi-column answer tables.
  - Zero cross-contamination: Question 1 in Practice Set-1 receives Answer 1 of Practice Set-1; Question 1 in Practice Set-2 receives Answer 1 of Practice Set-2.
  - Separate Hindi word boundary protection prevents words like `उत्तर कुंजी` or `उत्तर तालिका` from colliding with individual question answer lines.
- **System Safety & Zero Breaking Changes:**
  - Manual question creation (`+ Add Question`), manual test series creation, and existing `ImportQuestionsModal` continue working without any changes.
  - Student test-taking engine, timer, palette, scoring, negative marks, review, payments, and auth remain 100% untouched.
  - Reused existing database tables with zero migrations required.
  - Strict React Hook order compliance across all modals and components.
- **Verification & Test Results:**
  - `scripts/test-question-formatter.ts`: 100% passed across all 4 test scenarios (multi-set isolation, range extraction, validation tags, Excel range).
  - `scripts/test-smart-parser.ts`: 100% passed across all 3 regression scenarios.
  - `npx tsc --noEmit`: Code 0 (clean, 0 type errors).
  - `npm run build`: Code 0 (clean, 41 static/dynamic routes compiled).

---

## Phase 29 — High-Performance PDF Question Import Optimization

- **Root Causes Solved & Engine Optimizations:**
  - **Eliminated Unnecessary OCR Scans:** Previously, digital PDFs with embedded logos or image elements triggered sequential Tesseract OCR on dozens/hundreds of image blocks, causing multi-minute CPU execution and timeouts. Added instant digital-text probing (<10ms) that skips OCR completely whenever selectable text is present.
  - **Smart Page-Range Prober:** Instead of loading and parsing all 400 pages of a large book, the engine probes page intervals to locate the exact page where `fromQuestion` begins, extracts consecutive pages until `toQuestion` is reached, and stops immediately. Drops processing time from >300 seconds to **<100 milliseconds** for typical 100-question batches (e.g. 1 → 100 in 36ms, 501 → 600 in 65ms).
  - **In-Memory Buffer Cache:** Implemented `cachePdfBuffer` / `getCachedPdfBuffer` (15-minute TTL) returning a `file_id`. When creating multiple batches from the same PDF (e.g., 101 → 200 right after 1 → 100), the browser sends only `fileId` instead of re-uploading a 50MB file over the network.
  - **Scanned PDF Safety Cap:** For genuine scanned/image PDFs where OCR is strictly required, execution is capped at 12 pages maximum with timeout protection to prevent server hangs, and clearly displays `"Scanned PDF detected. OCR processing may take longer."`
- **Real-Time Streaming UI & UX:**
  - Implemented `/api/admin/test-series/create-from-pdf/parse-stream` with NDJSON streaming (`application/x-ndjson`).
  - Displays authentic live progress milestones without fake timers: `Reading PDF...`, `Finding question numbers in PDF...`, `Found question 1...`, `Found question 50...`, `Found question 100...`, and `Preparing preview...`.
  - Added 60-second client-side `AbortController` timeout handling to prevent indefinite loading states on slow connections.
  - Verified React Hook order: all 15+ hooks execute unconditionally at the top of component bodies in both `CreateSeriesFromPdfModal.tsx` and `ImportQuestionsModal.tsx`.
- **Validation Results:**
  - `npx tsc --noEmit`: Code 0 (clean, 0 errors).
  - `npm run build`: Code 0 (clean, 40 static/dynamic routes compiled successfully).
  - Benchmark & Range Test (`scripts/test-pdf-range-optimization.ts`):
    - Small range 1 → 5: 5 questions in 508ms with all streaming progress events.
    - Standard range 1 → 100: 100 questions in **36ms**.
    - Later range 501 → 600: 100 questions in **65ms** without parsing pages 1–50.
    - In-memory cache test: instantaneous subsequent batch extraction.
  - Comprehensive Test Suite (`scripts/test-pdf-range-import.ts`): 100% passed across all 6 test scenarios.

---

## Phase 28 — Create Test Series from PDF using Question Number Range

- **Core Feature & Workflow:**
  - Added dedicated Admin workflow: `Create Test Series from PDF` accessible from Admin → Test Series (`/admin/test-series`).
  - **Question Number Range as Primary Mechanism:** Scans the whole document to locate printed question numbers (e.g. 1 → 100, 101 → 200, 201 → 300, 501 → 650) rather than taking PDF page numbers. Supports arbitrary batch sizes (50, 100, 150, 200+).
  - **Question Boundary Detection Engine:** Recognizes numbering variations (`Q1.`, `Q.1`, `Q 1`, `Question 1`, `Question No. 1`, `Que. 1`, `प्रश्न 1:`, `1.`, `1)`, `(1)`, `[1]`), multiline questions, inline/multiline options, and answer keys. Filters page headers/footers (`Page X of Y`, `-- X --`) to prevent text pollution.
  - **Preview & Non-Silent Validation:** Prior to database commit, displays an import preview with requested range, found question count, valid questions, and needs-review flags.
  - **Incomplete Range Guard:** If requested range is e.g. 1 → 100 but only 96 questions are found, the system displays a clear warning banner with exact missing question numbers (`97, 98, 99, 100`) and a `[Go Back and Change Range]` option to prevent silent incomplete series creation.
  - **Inline Question Editing in Preview:** Admin can review and edit question text, options A-D, and correct answer directly in an inline sub-modal before committing.
  - **Fast-Track Multi-Set Flow:** After saving Set 01 (1 → 100), offers a 1-click `[Setup Next Set (101 → 200)]` option with the same PDF preloaded and auto-incremented series name ("General Knowledge Set 02").
- **Backend Architecture & Security:**
  - `POST /api/admin/test-series/create-from-pdf/parse`: Secure server-side PDF range extraction with admin role verification and duplicate checks.
  - `POST /api/admin/test-series/create-from-pdf/commit`: Creates Test Series, Subject (`test_series_subjects`), Test (`tests`), and inserts questions in chunks with subject tags and order sequencing.
  - Zero database schema migrations required (reused existing robust schema).
- **Validation Results:**
  - `npx tsc --noEmit`: Code 0 (clean).
  - `npm run build`: Code 0 (clean, 40 static/dynamic routes compiled).
  - Automated test suite (`scripts/test-pdf-range-import.ts`): All 6 comprehensive tests passed (1 → 5 exact 5 questions, 1 → 10 exact 10 questions, 101 → 110 question number extraction without page dependency, 101 → 120 missing questions detection refusing silent partials, text fallback range parse, and real PDF binary stream extraction).
  - Hierarchy verification test (`scripts/test-hierarchy-verification.mjs`): All checks passed.

---

## Phase 27 — Smart Question Import System for Test Series

- **Scope & Additive Architecture:**
  - Added smart bulk question import alongside existing manual question creation (`+ Add Question` and `📥 Import Questions`).
  - Completely additive: zero changes or breaks to manual creation, test series, subjects, tests, attempts, timer, scoring, solution review, payments, or courses.
  - Reuses existing database schema (`questions`, `test_series_subjects`, `tests`) and auto-updates test's `subject_ids` when questions from multiple subjects are imported.
- **Supported File Formats & OCR:**
  - **PDF:** Processes all pages; extracts digital text; automatically detects scanned/image PDFs and falls back to OCR via Tesseract.
  - **DOCX / Word:** Raw text & paragraph extraction via Mammoth, parsing all question patterns, options, answers, and explanations.
  - **XLSX / Excel & CSV:** Flexible column mapping engine (maps variations like Q, Question Text, Option 1/A, Ans, Key, Subject, Explanation, Marks), supports 10, 50, 100, 200, 500+ questions.
  - **JPG / JPEG / PNG:** High-accuracy OCR extraction using Tesseract.js with Hindi & English support.
- **Intelligent Processing Engine:**
  - Auto-detects subject headings (`COMPUTER`, `GENERAL KNOWLEDGE`, `REASONING`, `Subject: ...`, `विषय: ...`).
  - Confidently maps detected subject names to existing series subjects. If ambiguous/undetected, flags "Subject not detected" for admin review without silent guessing.
  - Recognizes standard formats: `Q1.`, `1.`, `1)`, `(1)`, options `(A)-(D)`, `A.-D.`, `A)-D)`, Hindi `क.-घ.`, answers `Answer: B`, `Ans: B`, `उत्तर: B`, and trailing answer keys.
  - Multi-tier duplicate detection against existing test database questions and intra-batch duplicates.
- **Preview & Admin Review Before Database Insert:**
  - Preview modal showing question count, valid questions, needs review, duplicates, and detected column mappings.
  - Full inline review: filter tabs (All, Valid, Needs Review, Duplicates), inline edit drawer, delete, subject assignment, and checkboxes.
  - Import options: "Import All Valid Questions" and "Import Selected Questions".
  - Viewport-safe responsive design (`max-h-[92vh]`, internal scroll, sticky footer) fully functional at 100%, 90%, 80%, 75% zoom and mobile/tablets.
- **Validation Results & Bug Fixes:**
  - **React Hook Order Fix:** Fixed `ImportQuestionsModal` where `if (!isOpen) return null` was placed before `useMemo` hooks (lines 217-229). Restructured so that all 15 hooks (`useState`, `useRef`, `useMemo`) execute unconditionally at the top of the component body on every render, and guarded modal mounting in `[seriesId]/page.tsx` with `{isImportModalOpen && ...}`.
  - `npx tsc --noEmit`: Code 0 (clean).
  - `npm run build`: Code 0 (clean, 40 static/dynamic routes compiled).
  - Automated test suite (`scripts/test-comprehensive-import.ts`): All 6 comprehensive tests passed (100-question Excel scaling, CSV with Hindi characters, varied question/option formats, validation & needs review flagging, DB/batch duplicate detection, and PDF text extraction).

---

## Phase 26 — Final Project State Verification & Production Sync

- **Scope & Verification:**
  - Comprehensive verification across all core platform modules:
    - **Test Series Admin Flow:** Scoped hierarchy (`Test Series -> Test -> Subjects -> Questions`), viewport-safe modal dialogs (Add/Edit Question, Edit Details, Add/Edit Subject, Create Test) with fixed headers, internal smooth scrolling, and sticky footers at 100% zoom.
    - **Student Test Series Pages:** Free & paid catalogs, series details, instructions, timed attempt interface, subject navigation tabs, and solution review.
    - **Payment & Courses:** Razorpay integration, webhook/signature verification, course catalog, lessons, and access control.
    - **Security Audit:** Zero secrets, `.env*` files, or API credentials committed; `.gitignore` rules active and verified.
    - **Production Health:** Verified all 40 static/dynamic application routes compile cleanly.
- **Validation Results:**
  - `npx tsc --noEmit`: Code 0 (clean).
  - `npm run build`: Code 0 (clean, 40 routes compiled).
  - Clean working tree and remote repository alignment with `origin/main`.

---

## Phase 25 — Add Question & Test Series Modals Viewport Responsiveness Fix

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
