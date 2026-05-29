// GDPR Article 9 biometric consent store
// Heart rate is special category biometric data — explicit consent required.
// Plain TS module (no runes) — SSR-safe.

import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';

const CONSENT_VERSION = '1.0';
const STORAGE_KEY = 'hb_biometric_consent';

export interface ConsentRecord {
  hasConsented: boolean;
  consentDate: string | null;
  version: string | null;
}

const EMPTY: ConsentRecord = { hasConsented: false, consentDate: null, version: null };

function readFromStorage(): ConsentRecord {
  if (!browser) return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    return {
      hasConsented: parsed.hasConsented === true,
      consentDate: parsed.consentDate ?? null,
      version: parsed.version ?? null,
    };
  } catch {
    return EMPTY;
  }
}

function writeToStorage(record: ConsentRecord) {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {}
}

// Writable store — SSR starts empty, browser initialises from localStorage
export const consent = writable<ConsentRecord>(browser ? readFromStorage() : EMPTY);

// Sync from localStorage when running in browser (e.g. after hydration)
if (browser) {
  consent.set(readFromStorage());
}

export function grantConsent(version: string = CONSENT_VERSION) {
  const now = new Date().toISOString();
  const record: ConsentRecord = { hasConsented: true, consentDate: now, version };
  consent.set(record);
  writeToStorage(record);

  // Fire-and-forget API call — never block UX
  if (browser) {
    const apiBase = (typeof window !== 'undefined' && (window as any).__PUBLIC_API_URL) ? (window as any).__PUBLIC_API_URL : '';
    fetch(`${apiBase}/api/v1/me/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, grantedAt: now }),
    }).catch(() => {});
  }
}

export function withdrawConsent() {
  const record: ConsentRecord = EMPTY;
  consent.set(record);
  writeToStorage(record);
}

export function checkConsent(): boolean {
  return get(consent).hasConsented === true;
}
