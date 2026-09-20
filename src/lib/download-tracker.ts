import { getSupabaseAdmin } from '@/lib/test-series-server';

export interface DownloadRecord {
  id: string;
  user_id: string;
  course_id: string;
  course_title?: string;
  course_file_id?: string | null;
  access_type: 'FREE' | 'PAID';
  file_name?: string | null;
  created_at: string;
}

/**
 * Records a successful, verified course PDF download event.
 * Writes to course_downloads table and site_settings download log for zero-downtime persistence.
 */
export async function recordCourseDownload(params: {
  user_id: string;
  course_id: string;
  course_file_id?: string | null;
  access_type: 'FREE' | 'PAID';
  file_name?: string | null;
  course_title?: string | null;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  const downloadId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: DownloadRecord = {
    id: downloadId,
    user_id: params.user_id,
    course_id: params.course_id,
    course_title: params.course_title || 'Course PDF',
    course_file_id: params.course_file_id || null,
    access_type: params.access_type,
    file_name: params.file_name || null,
    created_at: new Date().toISOString(),
  };

  // 1. Attempt insert into primary course_downloads table
  try {
    await admin.from('course_downloads').insert({
      user_id: params.user_id,
      course_id: params.course_id,
      course_file_id: params.course_file_id || null,
      access_type: params.access_type,
      file_name: params.file_name || null,
    });
  } catch (err) {
    // If table not created yet on remote DB, fallback stores it
  }

  // 2. Persist to site_settings log for guaranteed immediate storage
  try {
    await admin.from('site_settings').upsert({
      key: `download_log_${downloadId}`,
      value: JSON.stringify(record),
    });
  } catch (err) {
    console.warn('Could not record download in site_settings:', err);
  }
}

/**
 * Retrieves all verified download events, optionally filtered by user ID.
 */
export async function getAllDownloads(userId?: string): Promise<DownloadRecord[]> {
  const admin = getSupabaseAdmin();
  const downloads: DownloadRecord[] = [];

  // 1. Try querying course_downloads table
  try {
    let query = admin
      .from('course_downloads')
      .select(`
        id,
        user_id,
        course_id,
        course_file_id,
        access_type,
        file_name,
        created_at,
        courses (title)
      `)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      for (const d of data) {
        downloads.push({
          id: d.id,
          user_id: d.user_id,
          course_id: d.course_id,
          course_title: (d.courses as any)?.title || 'Course PDF',
          course_file_id: d.course_file_id,
          access_type: d.access_type as 'FREE' | 'PAID',
          file_name: d.file_name,
          created_at: d.created_at,
        });
      }
      return downloads;
    }
  } catch {
    // Fall back to site_settings
  }

  // 2. Read from site_settings fallback logs
  try {
    const { data: logs } = await admin
      .from('site_settings')
      .select('key, value')
      .like('key', 'download_log_%');

    if (logs && logs.length > 0) {
      for (const log of logs) {
        try {
          const parsed = JSON.parse(log.value) as DownloadRecord;
          if (!userId || parsed.user_id === userId) {
            downloads.push(parsed);
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    }
  } catch (err) {
    console.error('Error fetching fallback downloads:', err);
  }

  // Sort descending by created_at
  return downloads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
