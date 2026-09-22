# Education-Course Project Status

## Current Phase

Phase 23 — Test-Specific Subject + Question Flow Scoping & Verification

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
