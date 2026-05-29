import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import {
  serializeSession,
  sessionCookieAttrs,
  type SessionData
} from '$lib/server/auth';

export const GET: RequestHandler = async ({ cookies, url }) => {
  const session: SessionData = {
    userId: 'demo',
    email: 'demo@heartbits.app',
    name: 'Demo User',
    accessToken: '',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    isDemo: true
  };

  const signed = await serializeSession(session);
  const attrs = sessionCookieAttrs(signed);
  cookies.set(attrs.name, attrs.value, {
    httpOnly: attrs.httpOnly,
    secure: attrs.secure,
    sameSite: attrs.sameSite,
    path: attrs.path,
    maxAge: attrs.maxAge
  });

  const next = url.searchParams.get('next') ?? '/discover';
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/discover';
  throw redirect(302, safe);
};
