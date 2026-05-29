import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { SESSION_COOKIE, parseSession } from '$lib/server/auth';

const API_BASE = process.env.API_BASE_INTERNAL ?? 'http://heartbits-api:3100';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const session = await parseSession(cookies.get(SESSION_COOKIE));

  if (!session || session.isDemo) {
    return json({ demo: true });
  }

  let body: { swiped_id: string; direction: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/swipes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return json(data, { status: res.status });
  } catch (e) {
    console.error('[discover/swipe] failed:', e instanceof Error ? e.message : e);
    return json({ error: 'Swipe failed' }, { status: 502 });
  }
};
