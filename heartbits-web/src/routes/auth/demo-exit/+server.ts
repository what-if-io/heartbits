import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { clearSessionCookieAttrs } from '$lib/server/auth';
import { localizeHref, extractLocaleFromUrl } from '$lib/paraglide/runtime';

export const GET: RequestHandler = async ({ cookies, url }) => {
  const attrs = clearSessionCookieAttrs();
  cookies.set(attrs.name, attrs.value, {
    httpOnly: attrs.httpOnly,
    secure: attrs.secure,
    sameSite: attrs.sameSite,
    path: attrs.path,
    maxAge: attrs.maxAge
  });
  const locale = extractLocaleFromUrl(url);
  throw redirect(302, locale ? localizeHref('/', { locale }) : '/');
};
