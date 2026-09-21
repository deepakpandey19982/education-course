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

## Latest Production Status & Updates (Phase 22)

- **Key Changes:**
  1. **Admin Test Series Central Hub (`/admin/test-series`):** Clean, non-technical overview showing series cards with Published/Draft status, Free/Paid badge, metrics (Subjects, Tests, Questions), and quick "+ Create Test Series" modal.
  2. **Dedicated Series Manager (`/admin/test-series/[seriesId]`):** 4 distinct tabs (Overview, Subjects, Tests, Questions) for managing a single series without technical clutter.
  3. **Multi-Subject Tests (Section 4):** Tests configure which subjects are included from the parent series with question counts and target indicators.
  4. **Question Bank Context Management:** Context header (Series → Test → Subject), subject filters, search, and intuitive question creation/editing.
  5. **Student 4-Step Journey Alignment:**
     - Step 1: Dynamic published series list on `/test-series` & `/test-series/paid`.
     - Step 2: Series detail page displaying subjects with configured tests and 0-test empty indicators.
     - Step 3: Instructions & Agree & Continue screen.
     - Step 4: Subject-wise question attempt panel with real-time timer, palette, and orientation lock.
  6. **Safe Additive Migration (`supabase/migrations/20260921_test_series_hierarchy.sql`):** Preserves existing data, demo tests, and backwards compatibility.
- **Verification:**
  - `npx tsc --noEmit`: Code 0 (clean).
  - `npm run build`: Code 0 (clean, 40 routes).
  - Live Endpoint Probe: Free and Paid endpoints tested and verified.

## Last Updated

2026-09-21
