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
  const envApiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envApiUrl && envApiUrl.trim() !== '') {
    return envApiUrl.replace(/\/+$/, '');
  }

  // 2. Server-side rendering in Node.js / Next.js
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  // 3. Client-side browser execution
  const origin = window.location.origin;

  // If running inside Capacitor / Android WebView where localhost points to the phone:
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

    // Default development host IP fallback for local Android testing
    // 10.29.110.224 is the current development workstation IP on the Wi-Fi network
    // 10.0.2.2 is the Android emulator loopback to the host machine
    return 'http://10.29.110.224:3000';
  }

  // Normal browser (e.g. desktop localhost:3000 or production domain): use current origin
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
