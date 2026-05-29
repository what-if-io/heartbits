import type { PageServerLoad } from './$types';
import { SESSION_COOKIE, parseSession } from '$lib/server/auth';

const API_BASE = process.env.API_BASE_INTERNAL ?? 'http://heartbits-api:3100';

export interface ApiProfile {
  id: string;
  display_name: string | null;
  age: number | null;
  date_of_birth: string | null;
  bio: string | null;
  gender: string | null;
  seeking: string[];
  age_min: number;
  age_max: number;
  location_geohash6: string | null;
  avatar_url: string | null;
}

export const load: PageServerLoad = async ({ cookies }) => {
  const session = await parseSession(cookies.get(SESSION_COOKIE));
  if (!session || session.isDemo) {
    return { profile: null as ApiProfile | null, isDemo: true };
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return { profile: (await res.json()) as ApiProfile, isDemo: false };
    }
  } catch (e) {
    console.warn('[profile/load] fetch failed:', e instanceof Error ? e.message : e);
  }

  return { profile: null as ApiProfile | null, isDemo: false };
};
