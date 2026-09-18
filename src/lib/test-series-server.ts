import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type TestAccess = {
  id: string;
  title: string;
  duration_minutes: number;
  is_paid: boolean;
};

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function getRequestUser(request?: Request): Promise<User | null> {
  const authorization = request?.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length);
    const supabaseAuth = createClient(
      requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL'),
      requiredEnvironment('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data, error } = await supabaseAuth.auth.getUser(token);
    return error ? null : data.user;
  }

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnvironment('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabaseAuth.auth.getUser();
  return error ? null : data.user;
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

  return { test, error: null };
}

export function isAttemptExpired(attempt: {
  started_at: string;
  duration_minutes_snapshot: number;
}) {
  const expiry = new Date(attempt.started_at).getTime()
    + attempt.duration_minutes_snapshot * 60 * 1000;
  return Date.now() >= expiry;
}

export function stripQuestionAnswers(question: Record<string, unknown>) {
  const safeQuestion = { ...question };
  delete safeQuestion.correct_option;
  delete safeQuestion.explanation;
  return safeQuestion;
}
