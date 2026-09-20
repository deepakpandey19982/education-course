/**
 * Centralized API base URL resolver.
 * Handles desktop web, Android Capacitor WebView, Android emulator (10.0.2.2),
 * and production deployments cleanly.
 */

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  if (win.location.port === '3000') return false;
  return Boolean(
    win.Capacitor?.isNativePlatform?.() ||
    win.Capacitor?.platform === 'android' ||
    win.Capacitor?.platform === 'ios' ||
    win.location.origin === 'capacitor://localhost' ||
    win.location.origin === 'http://localhost' ||
    win.location.origin === 'https://localhost' ||
    win.location.protocol === 'capacitor:' ||
    win.location.protocol === 'file:'
  );
}

export function getApiBaseUrl(): string {
  // 1. Explicit environment variable takes top precedence
  const envApiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : undefined);
  if (envApiUrl && envApiUrl.trim() !== '') {
    return envApiUrl.replace(/\/+$/, '');
  }

  // 2. Server-side rendering in Node.js / Next.js
  if (typeof window === 'undefined') {
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return 'http://localhost:3000';
  }

  // 3. Client-side browser execution: if already running on a remote web domain (e.g. Vercel),
  // always use current origin so all API requests route to the deployed backend!
  const origin = window.location.origin;
  if (
    origin &&
    (origin.startsWith('https://') || origin.startsWith('http://')) &&
    !origin.includes('localhost') &&
    !origin.includes('127.0.0.1')
  ) {
    return origin;
  }

  // 4. If running inside Capacitor / Android WebView where origin is localhost or capacitor://
  if (isCapacitorNative()) {
    // Check if user or dev configured an override in localStorage
    try {
      const stored = localStorage.getItem('api_base_url');
      if (stored && stored.trim() !== '') {
        return stored.replace(/\/+$/, '');
      }
    } catch {
      // Ignore storage error
    }

    // Default to production Vercel backend so Android devices work seamlessly anywhere
    return 'https://education-course-nine.vercel.app';
  }

  // Normal browser (e.g. desktop localhost:3000)
  return origin;
}

export function getApiUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return `${base}${cleanPath}`;
}
