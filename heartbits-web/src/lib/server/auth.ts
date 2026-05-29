/**
 * src/lib/server/auth.ts
 *
 * OIDC client configuration for Zitadel v4.
 * Uses openid-client v6 (discovery-based, no manual endpoint config needed).
 *
 * Environment variables required:
 *   PUBLIC_ZITADEL_ISSUER      — e.g. https://auth.heartbits.example.com
 *   PUBLIC_ZITADEL_CLIENT_ID   — the OIDC app's client ID
 *   SESSION_SECRET             — 32+ random bytes for signing session cookies
 *   ORIGIN                     — canonical app URL, e.g. https://heartbits.example.com
 * Optional:
 *   ZITADEL_CLIENT_SECRET      — only for confidential clients (omit for PKCE-only)
 */

import * as client from 'openid-client';
import { env } from '$env/dynamic/private';
import { env as pubEnv } from '$env/dynamic/public';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  accessToken: string;
  /** Unix timestamp (seconds) when the access token expires */
  expiresAt: number;
  /** True for demo sessions — no real OIDC, hardcoded mock data */
  isDemo?: boolean;
}

// ─── Lazy OIDC config (cached after first discovery) ─────────────────────────

let _config: client.Configuration | null = null;

export async function getOidcConfig(): Promise<client.Configuration> {
  if (_config) return _config;

  const issuer = pubEnv.PUBLIC_ZITADEL_ISSUER;
  const clientId = pubEnv.PUBLIC_ZITADEL_CLIENT_ID;

  if (!issuer || !clientId) {
    throw new Error(
      'Missing required env vars: PUBLIC_ZITADEL_ISSUER, PUBLIC_ZITADEL_CLIENT_ID'
    );
  }

  const clientSecret = env.ZITADEL_CLIENT_SECRET || undefined;

  // Pass secret only for confidential clients; PKCE-only clients omit it.
  _config = await client.discovery(
    new URL(issuer),
    clientId,
    clientSecret
  );

  return _config;
}

// Derived from ORIGIN env var so it works across prod + local dev.
// SvelteKit sets ORIGIN automatically in production; in dev it's http://localhost:5173.
export function getRedirectUri(): string {
  const origin = env.ORIGIN ?? 'http://localhost:5173';
  return `${origin}/auth/callback`;
}
export const SCOPES = 'openid profile email';

// ─── Cookie helpers ───────────────────────────────────────────────────────────

const SESSION_COOKIE = 'hb_session';
const PKCE_COOKIE = 'hb_pkce';
const STATE_COOKIE = 'hb_state';

// 7-day session lifetime
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Derive a 256-bit HMAC key from the client secret using HKDF.
 * Called once and cached.
 */
let _signingKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (_signingKey) return _signingKey;

  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error('Missing required env var: SESSION_SECRET');
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  _signingKey = keyMaterial;
  return _signingKey;
}

/**
 * Sign a payload string → "base64url(payload).base64url(sig)"
 */
async function signPayload(payload: string): Promise<string> {
  const key = await getSigningKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${payload}.${sigB64}`;
}

/**
 * Verify the signature and return the plain payload, or null if invalid.
 */
async function verifyPayload(signed: string): Promise<string | null> {
  const lastDot = signed.lastIndexOf('.');
  if (lastDot === -1) return null;

  const payload = signed.slice(0, lastDot);
  const sigB64 = signed.slice(lastDot + 1);

  // Decode base64url sig
  const sigBin = atob(sigB64.replace(/-/g, '+').replace(/_/g, '/'));
  const sigBytes = Uint8Array.from(sigBin, (c) => c.charCodeAt(0));

  const key = await getSigningKey();
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(payload)
  );

  return valid ? payload : null;
}

// ─── Session cookie ───────────────────────────────────────────────────────────

/**
 * Serialize a SessionData object into a signed cookie value.
 */
export async function serializeSession(data: SessionData): Promise<string> {
  const json = JSON.stringify(data);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return signPayload(b64);
}

/**
 * Parse and verify a session cookie value.
 * Returns null if the cookie is missing, tampered, or expired.
 */
export async function parseSession(cookieValue: string | undefined): Promise<SessionData | null> {
  if (!cookieValue) return null;

  const payload = await verifyPayload(cookieValue);
  if (!payload) return null;

  try {
    const json = decodeURIComponent(escape(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))));
    const data = JSON.parse(json) as SessionData;

    // Check token expiry
    if (data.expiresAt < Math.floor(Date.now() / 1000)) return null;

    return data;
  } catch {
    return null;
  }
}

// ─── Cookie attribute builders ────────────────────────────────────────────────

export function sessionCookieAttrs(value: string) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  };
}

export function clearSessionCookieAttrs() {
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0
  };
}

export function pkceCookieAttrs(verifier: string) {
  return {
    name: PKCE_COOKIE,
    value: verifier,
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/auth',
    maxAge: 600 // 10 minutes — just for the auth flow
  };
}

export function stateCookieAttrs(state: string) {
  return {
    name: STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/auth',
    maxAge: 600
  };
}

export function clearPkceStateCookies() {
  return [
    {
      name: PKCE_COOKIE,
      value: '',
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      path: '/auth',
      maxAge: 0
    },
    {
      name: STATE_COOKIE,
      value: '',
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      path: '/auth',
      maxAge: 0
    }
  ];
}

export { SESSION_COOKIE, PKCE_COOKIE, STATE_COOKIE };
