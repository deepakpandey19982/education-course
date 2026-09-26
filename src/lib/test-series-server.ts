import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type TestAccess = {
  id: string;
  title: string;
  duration_minutes: number;
  is_paid: boolean;
};

/**
 * Searches process.env for the first defined and non-empty key among provided names.
 */
export function getEnvironmentVar(names: string[]): string | undefined {
  for (const name of names) {
    const val = process.env[name];
    if (val && val.trim() !== '') {
      return val.trim();
    }
  }
  return undefined;
}

/**
 * Resolves a required environment variable or throws an actionable, descriptive error.
 */
export function getRequiredEnvironmentVar(names: string[]): string {
  const val = getEnvironmentVar(names);
  if (!val) {
    throw new Error(
      `Missing required environment variable: ${names.join(' or ')}. Please configure this variable in your Vercel project settings (Environment Variables).`
    );
  }
  return val;
}

export function getSupabaseUrl(): string {
  return getRequiredEnvironmentVar(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']);
}

export function getSupabaseAnonKey(): string {
  return getRequiredEnvironmentVar([
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_KEY',
  ]);
}

export function getSupabaseServiceRoleKey(): string {
  return getRequiredEnvironmentVar([
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_SERVICE_ROLE',
    'SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SECRET',
    'SERVICE_KEY',
    'SUPABASE_ADMIN_KEY',
    'SUPABASE_SERVICE_ROLE_SECRET',
  ]);
}

/**
 * Server-authoritative Supabase Admin client with service-role privileges.
 * Bypasses RLS to manage test attempts, questions, orders, and protected assets.
 */
export function getSupabaseAdmin(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Supabase client initialized with anon key for token verification.
 */
export function getSupabaseAnon(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Supabase client for reading public data (test_series, test_series_subjects, tests).
 * Uses service role if available, but safely falls back to anon key so public catalog
 * browsing never fails even if the service role key is not configured.
 */
export function getSupabaseClient(preferAdmin = false): SupabaseClient {
  if (preferAdmin) {
    return getSupabaseAdmin();
  }
  const serviceKey = getEnvironmentVar([
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_SERVICE_ROLE',
    'SERVICE_ROLE_KEY',
  ]);
  if (serviceKey) {
    return createClient(getSupabaseUrl(), serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return getSupabaseAnon();
}

export async function getRequestUser(request?: Request): Promise<User | null> {
  // 1. Check Authorization header: Bearer <token>
  const authorization = request?.headers.get('authorization');
  let token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null;

  // 2. Check query params: ?token=... or ?access_token=...
  if (!token && request) {
    try {
      const url = new URL(request.url);
      token = url.searchParams.get('token') || url.searchParams.get('access_token');
    } catch {
      // Ignore invalid URL
    }
  }

  // 3. If token found from header or query param, verify with Supabase (try anon client, then admin service client fallback)
  if (token) {
    try {
      const supabaseAuth = getSupabaseAnon();
      const { data, error } = await supabaseAuth.auth.getUser(token);
      if (!error && data?.user) {
        return data.user;
      }
    } catch (tokenErr) {
      console.warn('Bearer token verification with anon client failed:', tokenErr);
    }

    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user) {
        return data.user;
      }
    } catch (adminTokenErr) {
      console.warn('Bearer token verification with admin client failed:', adminTokenErr);
    }
  }

  // 4. Check raw cookie header on the Request object directly if present
  if (request) {
    const rawCookie = request.headers.get('cookie') || '';
    if (rawCookie) {
      // Check direct sb-access-token cookie
      const directMatch = rawCookie.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
      const cookieVal = directMatch ? decodeURIComponent(directMatch[1].trim()) : null;
      if (cookieVal) {
        try {
          const supabaseAuth = getSupabaseAnon();
          const { data, error } = await supabaseAuth.auth.getUser(cookieVal);
          if (!error && data?.user) return data.user;
        } catch {}
        try {
          const supabaseAdmin = getSupabaseAdmin();
          const { data, error } = await supabaseAdmin.auth.getUser(cookieVal);
          if (!error && data?.user) return data.user;
        } catch {}
      }

      // Check standard sb-<ref>-auth-token cookie
      const authCookieMatch = rawCookie.match(/(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=([^;]+)/);
      if (authCookieMatch) {
        try {
          const rawVal = decodeURIComponent(authCookieMatch[1]);
          let parsedToken: string | null = null;
          if (rawVal.startsWith('base64-')) {
            const decoded = Buffer.from(rawVal.slice(7), 'base64').toString('utf-8');
            const json = JSON.parse(decoded);
            parsedToken = json?.access_token || (Array.isArray(json) ? json[0] : null);
          } else if (rawVal.startsWith('{') || rawVal.startsWith('[')) {
            const json = JSON.parse(rawVal);
            parsedToken = json?.access_token || (Array.isArray(json) ? json[0] : null);
          }
          if (parsedToken) {
            const supabaseAdmin = getSupabaseAdmin();
            const { data, error } = await supabaseAdmin.auth.getUser(parsedToken);
            if (!error && data?.user) return data.user;
          }
        } catch {}
      }
    }
  }

  // 5. Check cookies via Next.js cookieStore
  try {
    const cookieStore = await cookies();

    // Check direct sb-access-token cookie
    const directToken = cookieStore.get('sb-access-token')?.value;
    if (directToken) {
      try {
        const supabaseAuth = getSupabaseAnon();
        const { data, error } = await supabaseAuth.auth.getUser(directToken);
        if (!error && data?.user) {
          return data.user;
        }
      } catch (cookieErr) {
        console.warn('Direct cookie verification failed:', cookieErr);
      }
      try {
        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin.auth.getUser(directToken);
        if (!error && data?.user) {
          return data.user;
        }
      } catch (adminCookieErr) {
        console.warn('Admin direct cookie verification failed:', adminCookieErr);
      }
    }

    // Check @supabase/ssr structured cookies
    const supabaseAuth = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Safe ignore when called in contexts where setting cookies is disallowed
          }
        },
      },
    });

    const { data, error } = await supabaseAuth.auth.getUser();
    if (!error && data?.user) {
      return data.user;
    }
  } catch {
    return null;
  }

  return null;
}

export async function getAccessibleTest(
  admin: SupabaseClient,
  userId: string,
  testId: string
): Promise<{ test: TestAccess | null; error: string | null }> {
  const { data: test, error: testError } = await admin
    .from('tests')
    .select('id, title, duration_minutes, is_paid')
    .eq('id', testId)
    .eq('is_published', true)
    .maybeSingle();

  if (testError || !test) {
    return { test: null, error: 'Test not found or unavailable' };
  }

  if (test.is_paid) {
    const isDemo = test.title?.toLowerCase().includes('demo');
    if (!isDemo) {
      const { data: order, error: orderError } = await admin
        .from('orders')
        .select('id')
        .eq('user_id', userId)
        .eq('test_id', testId)
        .eq('status', 'paid')
        .maybeSingle();

      if (orderError || !order) {
        return { test: null, error: 'Purchase is required for this test' };
      }
    }
  }

  return { test, error: null };
}

export function isAttemptExpired(attempt: {
  started_at: string;
  duration_minutes_snapshot: number;
}) {
  const expiry =
    new Date(attempt.started_at).getTime() +
    attempt.duration_minutes_snapshot * 60 * 1000;
  return Date.now() >= expiry;
}

export function stripQuestionAnswers(question: Record<string, unknown>) {
  const safeQuestion = { ...question };
  delete safeQuestion.correct_option;
  delete safeQuestion.explanation;
  return safeQuestion;
}
