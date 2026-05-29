import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESSION_COOKIE, parseSession, sessionCookieAttrs } from '$lib/server/auth';

const API_BASE = process.env.API_BASE_INTERNAL ?? 'http://heartbits-api:3100';

/** Proxy PATCH /api/v1/me — keeps the access token server-side */
export const PATCH: RequestHandler = async ({ request, cookies }) => {
  const session = await parseSession(cookies.get(SESSION_COOKIE));
  if (!session || session.isDemo) return json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const res = await fetch(`${API_BASE}/api/v1/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });

  const data = await res.json();
  return json(data, { status: res.status });
};

/** Delete account — proxy to DELETE /api/v1/me, then clear session and redirect */
export const DELETE: RequestHandler = async ({ cookies }) => {
  const session = await parseSession(cookies.get(SESSION_COOKIE));
  if (!session || session.isDemo) return json({ error: 'Not authenticated' }, { status: 401 });

  const res = await fetch(`${API_BASE}/api/v1/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.accessToken}` },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Deletion failed' }));
    return json(data, { status: res.status });
  }

  // Clear the session cookie so the user is immediately logged out
  const attrs = sessionCookieAttrs('');
  cookies.set(attrs.name, '', {
    httpOnly: attrs.httpOnly,
    secure: attrs.secure,
    sameSite: attrs.sameSite,
    path: attrs.path,
    maxAge: 0,
  });

  return json({ deleted: true });
};
