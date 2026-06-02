import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESSION_COOKIE, parseSession, sessionCookieAttrs } from '$lib/server/auth';

const API_BASE = process.env.API_BASE_INTERNAL ?? 'http://heartbits-api:3100';

/** Pause account — proxy to POST /api/v1/me/pause, then clear the session.
 *  The client then redirects to /auth/logout to end the Zitadel session too. */
export const POST: RequestHandler = async ({ cookies }) => {
  const session = await parseSession(cookies.get(SESSION_COOKIE));
  if (!session || session.isDemo) return json({ error: 'Not authenticated' }, { status: 401 });

  const res = await fetch(`${API_BASE}/api/v1/me/pause`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}` },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Pause failed' }));
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

  return json({ paused: true });
};
