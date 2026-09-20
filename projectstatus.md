# Project Structure

```text
Education-Course/
├── android/                     # Android Capacitor application
├── ios/                         # iOS Capacitor application
├── public/                      # Public static assets
├── src/
│   ├── app/                     # Next.js pages, layouts, and API routes
│   │   ├── about/
│   │   ├── admin/               # Course and homepage administration
│   │   ├── api/                 # Contact, course download, and payment APIs
│   │   ├── contact/
│   │   ├── courses/
│   │   ├── dashboard/
│   │   ├── login/
│   │   ├── profile/
│   │   ├── signup/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── shared/              # Shared course, navigation, footer, and home UI
│   │   └── ui/                  # Reusable UI components
│   ├── lib/                     # Supabase client configuration
│   └── types/                   # TypeScript type definitions
├── supabase/                    # Database schema and migrations
├── .env.local                   # Local environment settings
├── capacitor.config.ts          # Capacitor configuration
├── next.config.ts               # Next.js configuration
├── package.json                 # Project dependencies and scripts
└── README.md
```

## Latest Production Status & Updates (Phase 21)

- **Key Changes:**
  1. **Same-Origin Relative API URLs (`src/lib/api-config.ts`):** Standardized all browser fetch requests to use relative URLs (`/api/...`), completely avoiding CORS preflights, domain mismatches, and `TypeError: Failed to fetch` errors in mobile/desktop Chrome.
  2. **Orientation Web Safety (`src/lib/orientation.ts`):** Made orientation lock/restore completely safe on mobile and desktop web browsers without throwing errors or unhandled rejections, while keeping native Capacitor Android screen locking intact.
  3. **Error Reporting (`src/app/test-series/tests/[testId]/attempt/page.tsx`):** Improved error reporting to clearly differentiate between network reachability errors and authentication requirements.
  4. **Production Database Security & Service Role Alignment:** Identified that Supabase Row Level Security (RLS) protects `orders` (no public insert) and `questions` (admin-only select to avoid exposing answers). Documented the missing `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
- **Verification:**
  - `npx tsc --noEmit`: Code 0 (clean).
  - `npm run build`: Code 0 (clean, 40 routes).
  - `npx cap sync`: Synced `@capacitor/screen-orientation` to Android & iOS.

