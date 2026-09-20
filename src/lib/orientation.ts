import { ScreenOrientation } from '@capacitor/screen-orientation';
import { isCapacitorNative } from './api-config';

let isLandscapeActive = false;

/**
 * Dynamically locks screen orientation to landscape when test questions are active.
 * Compatible with Capacitor Android/iOS and supported mobile web browsers.
 */
export async function lockTestLandscape(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Native Capacitor Android/iOS plugin
  try {
    if (isCapacitorNative()) {
      await ScreenOrientation.lock({ orientation: 'landscape' });
      isLandscapeActive = true;
      return;
    }
  } catch {
    // Gracefully ignore native lock issues
  }

  // 2. Web Screen Orientation API fallback for mobile Chrome/Edge (where supported)
  try {
    const screenAny = window.screen as any;
    if (screenAny?.orientation?.lock) {
      await screenAny.orientation.lock('landscape').catch(() => {});
      isLandscapeActive = true;
    }
  } catch {
    // Browsers require fullscreen permission for screen.orientation.lock, so silently ignore
  }
}

/**
 * Restores screen orientation to portrait when exiting, finishing, or submitting a test.
 * Ensures all other website pages (home, courses, dashboard) display vertically.
 */
export async function restorePortrait(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Native Capacitor Android/iOS plugin
  try {
    if (isCapacitorNative()) {
      // First lock to portrait, then unlock so user has normal natural rotation
      await ScreenOrientation.lock({ orientation: 'portrait' });
      isLandscapeActive = false;
      return;
    }
  } catch {
    // Gracefully ignore native restore issues
  }

  // 2. Web Screen Orientation API fallback
  try {
    const screenAny = window.screen as any;
    if (screenAny?.orientation?.lock) {
      await screenAny.orientation.lock('portrait').catch(() => {});
    } else if (screenAny?.orientation?.unlock) {
      screenAny.orientation.unlock();
    }
    isLandscapeActive = false;
  } catch {
    // Silently ignore web unsupported error
  }
}
