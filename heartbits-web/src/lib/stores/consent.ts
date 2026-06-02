// GDPR Article 9 biometric consent store
// Heart rate is special category biometric data — explicit consent required.
// Plain TS module (no runes) — SSR-safe.

import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';

const CONSENT_VERSION = '1.1';
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

export async function grantConsent(version: string = CONSENT_VERSION): Promise<void> {
  const now = new Date().toISOString();
  const record: ConsentRecord = { hasConsented: true, consentDate: now, version };
  consent.set(record);
  writeToStorage(record);

  // Persist the consent record server-side — the legally-required artifact.
  // The /consent proxy attaches the session bearer token and the consent_type.
  // Errors are logged, never silently swallowed.
  if (browser) {
    try {
      const res = await fetch('/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) {
        console.error('[consent] server record failed:', res.status, await res.text().catch(() => ''));
      }
    } catch (e) {
      console.error('[consent] server record error:', e);
    }
  }
}

export async function withdrawConsent(): Promise<void> {
  consent.set(EMPTY);
  writeToStorage(EMPTY);

  // Withdraw server-side too — evicts the relay room keys so sharing stops.
  if (browser) {
    try {
      const res = await fetch('/consent', { method: 'DELETE' });
      if (!res.ok) console.error('[consent] server withdraw failed:', res.status);
    } catch (e) {
      console.error('[consent] server withdraw error:', e);
    }
  }
}

export function checkConsent(): boolean {
  return get(consent).hasConsented === true;
}
