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

## Latest Production Status & Updates (Phase 20)

- **Commit:** `548bfd9` (pushed to `origin/main`)
- **Key Changes:**
  1. **Test Series Questions & CORS:** Fixed CORS credential spec issue by removing wildcard origin with credentials in `next.config.ts` and implementing strict dynamic origin reflection in `src/middleware.ts` for `capacitor://localhost`, `https://education-course-nine.vercel.app`, and `http://localhost:3000`.
  2. **Payment Creation:** Expanded service role aliases in server libraries. Identified missing Vercel environment variable `SUPABASE_SERVICE_ROLE_KEY` required for bypass of `orders` and `questions` admin RLS.
  3. **Homepage Course Card Navigation:** Verified Next.js `<Link>` wrapping for image, title, and "View Course" button with `courseId` correctly passed.
  4. **Dynamic Android Orientation:** Installed `@capacitor/screen-orientation@8.0.1` and ran `npx cap sync`. Created `src/lib/orientation.ts` which automatically locks to landscape on test attempt screen and restores portrait on unmount, back button, error, or submit. Normal pages remain portrait.
- **Verification:**
  - `npx tsc --noEmit`: Code 0 (clean).
  - `npm run build`: Code 0 (clean, 40 routes).
  - `npx cap sync`: Synced `@capacitor/screen-orientation` to Android & iOS platforms.
  - Vercel live health check: Deployed and responsive.
