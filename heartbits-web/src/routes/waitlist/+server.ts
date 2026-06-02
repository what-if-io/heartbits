import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const API_BASE = process.env.API_BASE_INTERNAL ?? 'http://heartbits-api:3100';

/** Public waitlist signup — proxies to the API's POST /api/v1/waitlist. */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  try {
    const res = await fetch(`${API_BASE}/api/v1/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json().catch(() => ({ error: 'Waitlist is temporarily unavailable.' }));
    return json(data, { status: res.status });
  } catch {
    return json({ error: 'Waitlist is temporarily unavailable.' }, { status: 502 });
  }
};
