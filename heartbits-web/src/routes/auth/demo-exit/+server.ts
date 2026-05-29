import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { clearSessionCookieAttrs } from '$lib/server/auth';

export const GET: RequestHandler = async ({ cookies }) => {
  const attrs = clearSessionCookieAttrs();
  cookies.set(attrs.name, attrs.value, {
    httpOnly: attrs.httpOnly,
    secure: attrs.secure,
    sameSite: attrs.sameSite,
    path: attrs.path,
    maxAge: attrs.maxAge
  });
  throw redirect(302, '/');
};
