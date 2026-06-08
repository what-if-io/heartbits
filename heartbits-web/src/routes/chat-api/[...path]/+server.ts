import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESSION_COOKIE, parseSession } from '$lib/server/auth';

// Authed bridge: forwards /chat-api/<p> → API /api/v1/<p> with the session's
// access token. Every API endpoint is auth + RLS gated, so this only ever lets a
// user act as themselves. Used by the client-side chat (messages/reactions).
const API_BASE = process.env.API_BASE_INTERNAL ?? 'http://heartbits-api:3100';

async function forward(
  method: string,
  params: { path: string },
  cookies: import('@sveltejs/kit').Cookies,
  request: Request
): Promise<Response> {
  const session = await parseSession(cookies.get(SESSION_COOKIE));
  if (!session?.accessToken) return json({ error: 'Unauthenticated' }, { status: 401 });

  const search = new URL(request.url).search;
  const init: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${session.accessToken}` },
    signal: AbortSignal.timeout(8000)
  };
  if (method !== 'GET' && method !== 'DELETE') {
    init.body = await request.text();
    (init.headers as Record<string, string>)['content-type'] =
      request.headers.get('content-type') ?? 'application/json';
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/${params.path}${search}`, init);
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' }
    });
  } catch {
    return json({ error: 'Service unavailable' }, { status: 502 });
  }
}

export const GET: RequestHandler = ({ params, cookies, request }) => forward('GET', params, cookies, request);
export const POST: RequestHandler = ({ params, cookies, request }) => forward('POST', params, cookies, request);
export const PATCH: RequestHandler = ({ params, cookies, request }) => forward('PATCH', params, cookies, request);
export const DELETE: RequestHandler = ({ params, cookies, request }) => forward('DELETE', params, cookies, request);
