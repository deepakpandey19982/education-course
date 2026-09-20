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
  } catch (capErr) {
    console.warn('[Orientation] Capacitor lock failed:', capErr);
  }

  // 2. Web Screen Orientation API fallback for mobile Chrome/Edge
  try {
    const screenAny = window.screen as any;
    if (screenAny?.orientation?.lock) {
      await screenAny.orientation.lock('landscape');
      isLandscapeActive = true;
    }
  } catch (webErr) {
    // Expected on desktop browsers or without fullscreen permission
    console.warn('[Orientation] Web lock landscape not supported:', webErr);
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
  } catch (capErr) {
    console.warn('[Orientation] Capacitor restore portrait failed:', capErr);
  }

  // 2. Web Screen Orientation API fallback
  try {
    const screenAny = window.screen as any;
    if (screenAny?.orientation?.lock) {
      await screenAny.orientation.lock('portrait');
    } else if (screenAny?.orientation?.unlock) {
      screenAny.orientation.unlock();
    }
    isLandscapeActive = false;
  } catch (webErr) {
    console.warn('[Orientation] Web restore portrait failed:', webErr);
  }
}
