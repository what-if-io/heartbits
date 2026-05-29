import type { PageServerLoad } from './$types';
import { SESSION_COOKIE, parseSession } from '$lib/server/auth';

const API_BASE = process.env.API_BASE_INTERNAL ?? 'http://heartbits-api:3100';

export interface ApiProfile {
  id: string;
  display_name: string | null;
  age: number | null;
  bio: string | null;
  gender: string | null;
  avatar_url: string | null;
  distance_band: string | null;
  bpm: number | null;
}

export const load: PageServerLoad = async ({ cookies }) => {
  const session = await parseSession(cookies.get(SESSION_COOKIE));

  if (!session || session.isDemo) {
    return { profiles: [] as ApiProfile[], isDemo: true };
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/discover`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json() as { profiles: ApiProfile[] };
      return { profiles: data.profiles, isDemo: false };
    }
    console.warn('[discover/load] API status', res.status);
  } catch (e) {
    console.warn('[discover/load] fetch failed:', e instanceof Error ? e.message : e);
  }

  return { profiles: [] as ApiProfile[], isDemo: false };
};
