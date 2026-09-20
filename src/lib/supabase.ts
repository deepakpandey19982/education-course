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

  // Keep browser cookie in sync for server-side auth recognition
  if (typeof window !== 'undefined' && _supabase) {
    _supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=604800; SameSite=Lax`;
      } else if (event === 'SIGNED_OUT') {
        document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax';
      }
    });

    // Also initialize cookie if active session already exists in localStorage
    _supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=604800; SameSite=Lax`;
      }
    }).catch(() => {});
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
  const { data, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Error fetching profile for user', user.id, ':', JSON.stringify(profileError, null, 2));
    return null;
  }

  const baseProfile = data || {
    id: user.id,
    email: user.email || '',
    full_name: '',
    role: 'user' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    ...baseProfile,
    avatar_url: (data as any)?.avatar_url || (user.user_metadata?.avatar_url as string) || null,
    full_name: (data as any)?.full_name || (user.user_metadata?.full_name as string) || '',
  };
}

export async function updateUserProfile(updates: {
  full_name?: string;
  avatar_url?: string | null;
}): Promise<void> {
  const client = getSupabase();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    throw new Error('User not authenticated');
  }

  // 1. Always persist to Supabase Auth user_metadata so avatar and name survive even if profiles table lacks the column
  const metaUpdates: Record<string, any> = {};
  if (updates.full_name !== undefined) metaUpdates.full_name = updates.full_name;
  if (updates.avatar_url !== undefined) metaUpdates.avatar_url = updates.avatar_url;

  if (Object.keys(metaUpdates).length > 0) {
    const { error: metaError } = await client.auth.updateUser({ data: metaUpdates });
    if (metaError) {
      console.warn('Could not update user metadata:', metaError.message);
    }
  }

  // 2. Persist to profiles table:
  // First try updating all requested fields (including avatar_url if the column exists in DB)
  const profileUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name;
  if (updates.avatar_url !== undefined) profileUpdates.avatar_url = updates.avatar_url;

  const { error: profileError } = await client
    .from('profiles')
    .update(profileUpdates)
    .eq('id', user.id);

  if (profileError) {
    // If the error was because avatar_url column is missing in schema cache,
    // safely update just full_name so the save succeeds cleanly!
    if (profileError.message?.includes('avatar_url') || profileError.message?.includes('column')) {
      const { avatar_url, ...fallbackUpdates } = profileUpdates;
      if (Object.keys(fallbackUpdates).length > 0) {
        const { error: fallbackError } = await client
          .from('profiles')
          .update(fallbackUpdates)
          .eq('id', user.id);
        if (fallbackError) {
          throw new Error(fallbackError.message);
        }
      }
    } else {
      throw new Error(profileError.message);
    }
  }
}

// Bucket resolution helper
let _resolvedBucket: { name: string; isPublic: boolean } | null = null;

export async function getSiteAssetBucket(): Promise<{ name: string; isPublic: boolean }> {
  if (_resolvedBucket) return _resolvedBucket;
  _resolvedBucket = { name: 'course-pdfs', isPublic: false };
  return _resolvedBucket;
}

export async function getSiteAssetBucketName(): Promise<string> {
  const bucket = await getSiteAssetBucket();
  return bucket.name;
}

export async function resolveStorageUrl(url: string): Promise<string> {
  if (!url || url.includes('token=') || url.startsWith('data:')) {
    return url;
  }

  if (url.includes('/course-pdfs/')) {
    try {
      const res = await fetch('/api/storage/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlOrPath: url }),
      });
      const data = await res.json();
      if (data.url) return data.url;
    } catch {
      // Return original on network error
    }
  }

  return url;
}

export async function uploadSiteAsset(file: File, folder: string): Promise<string> {
  const client = getSupabase();
  const { data: { session } } = await client.auth.getSession();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const res = await fetch('/api/storage/upload', {
    method: 'POST',
    headers,
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.url) {
    throw new Error(json.error || 'Failed to upload image');
  }

  return json.url;
}

export async function isAdmin(): Promise<boolean> {
  const profile = await getUserProfile();
  return profile?.role === 'admin';
}
