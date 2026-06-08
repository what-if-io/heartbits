import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESSION_COOKIE, parseSession } from '$lib/server/auth';

const API_BASE    = process.env.API_BASE_INTERNAL ?? 'http://heartbits-api:3100';
const RELAY_URL   = process.env.RELAY_URL          ?? '';

/** Convert https:// → wss://, http:// → ws:// */
function toWss(url: string): string {
  return url.replace(/^https?:\/\//, (m) => (m === 'https://' ? 'wss://' : 'ws://'));
}

export const GET: RequestHandler = async ({ params, cookies }) => {
  const session = await parseSession(cookies.get(SESSION_COOKIE));
  if (!session) return json({ error: 'Unauthenticated' }, { status: 401 });

  // Demo: no real relay — client falls back to simulation
  if (session.isDemo) return json({ demo: true });

  try {
    const res = await fetch(`${API_BASE}/api/v1/bonds/${params.id}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const bond = await res.json() as { room_id: string; partner_id: string; match_id: string };
      const baseWss = toWss(RELAY_URL).replace(/\/$/, '');
      return json({
        demo:      false,
        relayUrl:  `${baseWss}/${bond.room_id}`,
        token:     session.accessToken,
        partnerId: bond.partner_id,
        matchId:   bond.match_id,
      });
    }
  } catch {
    // API unavailable — fall through
  }

  return json({ demo: false, relayUrl: null, token: null });
};
