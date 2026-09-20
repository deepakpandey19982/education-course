import { supabase } from '@/lib/supabase';

export interface DownloadResult {
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  error?: string;
}

/**
 * Initiates an authenticated request to download or view a course PDF.
 * Uses the active Supabase session token to verify user identity and access privileges.
 */
export async function downloadCoursePdf(courseId: string): Promise<DownloadResult> {
  try {
    if (!courseId) {
      return { success: false, error: 'Course ID is required' };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return {
        success: false,
        error: 'Authentication required. Please log in to download this course.',
      };
    }

    const response = await fetch(`/api/courses/download?courseId=${encodeURIComponent(courseId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Accept': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok || !data.downloadUrl) {
      return {
        success: false,
        error: data.error || 'Failed to generate download link.',
      };
    }

    // Securely trigger the download / open PDF in a new tab
    const link = document.createElement('a');
    link.href = data.downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (data.fileName) {
      link.download = data.fileName;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return {
      success: true,
      downloadUrl: data.downloadUrl,
      fileName: data.fileName,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'An error occurred while downloading the PDF.',
    };
  }
}
