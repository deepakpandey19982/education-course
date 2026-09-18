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

export async function uploadSiteAsset(file: File, folder: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${folder}/${Math.random().toString(36).substring(2)}-${Date.now()}.${ext}`;
  const bucket = 'site-assets';

  const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw new Error('Image upload failed: ' + error.message);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}

export async function isAdmin(): Promise<boolean> {
  const profile = await getUserProfile();
  return profile?.role === 'admin';
}
