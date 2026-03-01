/**
 * Kiosk / Electron detection for UI overrides.
 * - URL kiosk: ?kiosk=1 shows only Sender (no nav).
 * - Electron: window.electronSerial means compact layout, hide terminal/export.
 */

export function isKioskUrl() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("kiosk") === "1";
}

export function hasElectronSerial() {
  if (typeof window === "undefined") return false;
  return !!window.electronSerial;
}
