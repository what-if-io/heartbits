import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESSION_COOKIE, parseSession } from '$lib/server/auth';

const API_BASE = process.env.API_BASE_INTERNAL ?? 'http://heartbits-api:3100';
const CONSENT_TYPE = 'biometric_relay';

/** Grant biometric-relay consent — proxies to the API with the user's token. */
export const POST: RequestHandler = async ({ request, cookies }) => {
  const session = await parseSession(cookies.get(SESSION_COOKIE));
  if (!session || session.isDemo) return json({ error: 'Not authenticated' }, { status: 401 });

  const { version } = await request.json().catch(() => ({}));
  const res = await fetch(`${API_BASE}/api/v1/me/consent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ consent_type: CONSENT_TYPE, version }),
    signal: AbortSignal.timeout(8000)
  });
  const data = await res.json().catch(() => ({}));
  return json(data, { status: res.status });
};

/** Withdraw biometric-relay consent — evicts relay room keys server-side. */
export const DELETE: RequestHandler = async ({ cookies }) => {
  const session = await parseSession(cookies.get(SESSION_COOKIE));
  if (!session || session.isDemo) return json({ error: 'Not authenticated' }, { status: 401 });

  const res = await fetch(`${API_BASE}/api/v1/me/consent/${CONSENT_TYPE}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.accessToken}` },
    signal: AbortSignal.timeout(8000)
  });
  const data = await res.json().catch(() => ({}));
  return json(data, { status: res.status });
};
