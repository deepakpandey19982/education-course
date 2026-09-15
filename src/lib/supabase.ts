import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Profile } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let _supabase: SupabaseClient | null = null;

export function getSupabase() {
  if (_supabase) return _supabase;

  if (!supabaseUrl || supabaseUrl === '' || !supabaseAnonKey || supabaseAnonKey === '') {
    _supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
  } else {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  return _supabase;
}

export const supabase = getSupabase();

export async function getUserProfile(): Promise<Profile | null> {
  const client = getSupabase();

  // 1. Get the currently authenticated user
  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // 2. Fetch the profile associated with this user's ID
  // We use .maybeSingle() instead of .single() to return null instead of an error if no row is found
  const { data, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Error fetching profile for user', user.id, ':', JSON.stringify(profileError, null, 2));
    return null;
  }

  return data;
}

export async function isAdmin(): Promise<boolean> {
  const profile = await getUserProfile();
  return profile?.role === 'admin';
}
