import type { PageServerLoad } from './$types';
import { SESSION_COOKIE, parseSession } from '$lib/server/auth';

const API_BASE = process.env.API_BASE_INTERNAL ?? 'http://heartbits-api:3100';

export interface ApiMatch {
  match_id: string;
  bond_id: string | null;
  matched_at: string;
  partner: {
    id: string;
    display_name: string | null;
    age: number | null;
    gender: string | null;
    avatar_url: string | null;
    bpm: number | null;
  };
}

export const load: PageServerLoad = async ({ cookies }) => {
  const session = await parseSession(cookies.get(SESSION_COOKIE));

  if (!session || session.isDemo) {
    return { matches: [] as ApiMatch[], isDemo: true };
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/matches`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json() as { matches: ApiMatch[] };
      return { matches: data.matches, isDemo: false };
    }
    console.warn('[matches/load] API status', res.status);
  } catch (e) {
    console.warn('[matches/load] fetch failed:', e instanceof Error ? e.message : e);
  }

  return { matches: [] as ApiMatch[], isDemo: false };
};
