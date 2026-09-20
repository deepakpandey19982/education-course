# Education-Course Project Status

## Current Phase

Phase 11 — Site-wide Global Text-Visibility and Color-Contrast Audit & Fix for Light and Dark Themes.

## What Changed

- **Tailwind v4 & Theme System Synchronization (`src/app/globals.css`, `ThemeProvider.tsx`, `layout.tsx`):**
  - Configured `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *, .dark, .dark *));` to ensure all standard Tailwind `dark:*` utilities work seamlessly alongside `[data-theme='dark']`.
  - Synchronized `ThemeProvider.tsx` and the inline `<head>` script in `layout.tsx` to set both `data-theme="dark"` attribute and `.dark` class, eliminating flash of unstyled theme and guaranteeing instant CSS inheritance.
  - Defined semantic tokens for `:root` and `:root[data-theme='dark'], .dark`:
    - `--background`, `--foreground`, `--panel`, `--panel-border`, `--input-bg`, `--input-text`, `--input-border`, `--muted-text`.
  - **Eliminated White-on-White button text bug:**
    - Removed blanket destructive rule `button[class*="bg-blue-"] { color: #ffffff !important; }` which was erroneously forcing white text on light blue tinted elements (e.g. `bg-blue-50`, `bg-blue-100`, active subject pills, selected question option cards).
    - Scoped text color rules precisely to deep filled blue buttons (`.bg-brand-primary`, `.bg-blue-600`...`.bg-blue-900`) and preserved dark text (`text-brand-primary` / `text-blue-900`) on subtle light blue backgrounds.
  - **Status Badges & Tokens:**
    - Defined WCAG-compliant status badge styles in `globals.css` for both light and dark themes:
      - Active/Success: `bg-emerald-50 text-emerald-700` (Light) / `bg-emerald-950/80 text-emerald-300 border-emerald-800` (Dark)
      - Inactive/Draft: `bg-slate-100 text-slate-700` (Light) / `bg-slate-800/80 text-slate-300 border-slate-700` (Dark)
      - Warning/Pending: `bg-amber-50 text-amber-700` (Light) / `bg-amber-950/80 text-amber-300 border-amber-800` (Dark)
      - Error/Danger: `bg-rose-50 text-rose-700` (Light) / `bg-rose-950/80 text-rose-300 border-rose-800` (Dark)
      - Info/Primary: `bg-blue-50 text-blue-700` (Light) / `bg-blue-950/80 text-blue-300 border-blue-800` (Dark)

- **Shared UI Buttons (`src/components/ui/Button.tsx`):**
  - Upgraded `primary`, `secondary`, `outline`, and `ghost` variants with robust contrast tokens.
  - Replaced low-contrast `disabled:opacity-50` with high-readability disabled styling:
    - `disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none`
    - Explicit readable text on disabled state (`disabled:text-slate-500 dark:disabled:text-slate-400 disabled:bg-slate-100 dark:disabled:bg-slate-800`).

- **Test Series Exam Interface (`src/app/test-series/tests/[testId]/attempt/page.tsx`):**
  - Fixed active subject pills: clearly readable with `border-brand-primary bg-blue-50 dark:bg-blue-950/70 text-brand-primary dark:text-blue-300 font-bold`.
  - Fixed question options: unselected options display crisp dark text in light mode (`text-slate-800 dark:text-slate-200`) and selected options show clear blue highlights (`border-brand-primary bg-blue-50 dark:bg-blue-950/70 dark:border-blue-500 text-slate-900 dark:text-slate-100 font-medium`).
  - Fixed question palette buttons: high-contrast status colors and legible white/dark labels across `attempted`, `marked_for_review`, `answered_marked`, `unattempted`, and `not_visited`.

- **Admin Pages & Controls:**
  - `src/app/admin/layout.tsx`: Dark mode support for navigation header, sidebar links, and page container (`dark:bg-slate-950`, `dark:border-slate-800`, `dark:text-slate-100`).
  - `src/app/admin/page.tsx`: StatCards, Quick Action buttons, and System Status card with theme-aware borders and text.
  - `src/app/admin/courses/page.tsx`: Course tables, headers, action buttons (Edit/Delete), and status pills.
  - `src/app/admin/categories/page.tsx`: Category tables, modal dialogs, form inputs, and cancel/save buttons.
  - `src/app/admin/homepage/page.tsx`: Tabs, banner management cards, drag handles, labels, and action buttons.

- **Public & Student Pages:**
  - `src/components/shared/Navbar.tsx`: Fixed theme toggle, desktop navigation links, and mobile menu dropdown with clear contrast.
  - `src/app/courses/page.tsx` & `src/components/shared/CourseCard.tsx`: Course cards, pricing, ratings, category filter pills, and empty states.
  - `src/app/courses/[id]/CourseDetailsClient.tsx`: Course curriculum, learning outcome cards, instructor info, and purchase card.
  - `src/app/test-series/page.tsx` & `src/app/test-series/paid/page.tsx`: Test series cards, badge labels, and explore buttons.
  - `src/app/test-series/[seriesId]/page.tsx`: Series hero, subjects list, test cards, and status indicators.
  - `src/app/test-series/tests/[testId]/instructions/page.tsx`: Instructions card, demo banner, and agreement checkbox.
  - `src/app/test-series/tests/[testId]/results/page.tsx`: Scorecard, accuracy meters, stat cards, and solution analysis questions.
  - `src/app/login/page.tsx` & `src/app/signup/page.tsx`: Authentication card, input labels, fields, error messages, and link buttons.
  - `src/app/profile/edit/page.tsx` (Account Settings): Form fields, avatar section, labels, inputs, and password security cards.
  - `src/app/dashboard/page.tsx`: Profile summary card, user role badge, enrolled course cards, and empty state.

## Files Updated

- [src/app/globals.css](src/app/globals.css)
- [src/components/providers/ThemeProvider.tsx](src/components/providers/ThemeProvider.tsx)
- [src/app/layout.tsx](src/app/layout.tsx)
- [src/components/ui/Button.tsx](src/components/ui/Button.tsx)
- [src/app/test-series/tests/[testId]/attempt/page.tsx](src/app/test-series/tests/[testId]/attempt/page.tsx)
- [src/app/test-series/tests/[testId]/instructions/page.tsx](src/app/test-series/tests/[testId]/instructions/page.tsx)
- [src/app/test-series/tests/[testId]/results/page.tsx](src/app/test-series/tests/[testId]/results/page.tsx)
- [src/app/test-series/page.tsx](src/app/test-series/page.tsx)
- [src/app/test-series/paid/page.tsx](src/app/test-series/paid/page.tsx)
- [src/app/test-series/[seriesId]/page.tsx](src/app/test-series/[seriesId]/page.tsx)
- [src/app/admin/layout.tsx](src/app/admin/layout.tsx)
- [src/app/admin/page.tsx](src/app/admin/page.tsx)
- [src/app/admin/courses/page.tsx](src/app/admin/courses/page.tsx)
- [src/app/admin/categories/page.tsx](src/app/admin/categories/page.tsx)
- [src/app/admin/homepage/page.tsx](src/app/admin/homepage/page.tsx)
- [src/app/courses/page.tsx](src/app/courses/page.tsx)
- [src/components/shared/CourseCard.tsx](src/components/shared/CourseCard.tsx)
- [src/app/courses/[id]/CourseDetailsClient.tsx](src/app/courses/[id]/CourseDetailsClient.tsx)
- [src/components/shared/Navbar.tsx](src/components/shared/Navbar.tsx)
- [src/app/login/page.tsx](src/app/login/page.tsx)
- [src/app/signup/page.tsx](src/app/signup/page.tsx)
- [src/app/profile/edit/page.tsx](src/app/profile/edit/page.tsx)
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)
- [Status.md](Status.md)

## Validation Results

- **TypeScript check:** `npx tsc --noEmit` passed with 0 errors (exit code 0).
- **Production build:** `npm run build` passed cleanly (exit code 0, 42/42 static/dynamic routes compiled).
- **Light mode visibility:** Audited and verified. No white-on-white text in buttons, active filters, or option cards.
- **Dark mode visibility:** Audited and verified. All cards, tables, inputs, modals, headings, badges, and buttons have high contrast.
- **Disabled/Active states:** Disabled buttons maintain legible text (`opacity-60`, crisp text color), active states clearly differentiated.
- **Layout & Responsiveness:** Unchanged layout structure, no horizontal scroll introduced.

## Remaining Bugs / Blockers

- None.

## Last Updated

2026-09-20
