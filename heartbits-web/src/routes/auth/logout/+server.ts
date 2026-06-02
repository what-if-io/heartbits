/**
 * src/routes/auth/logout/+server.ts
 *
 * GET /auth/logout
 *
 * 1. Clears the session cookie.
 * 2. Redirects the browser to Zitadel's end_session endpoint so the IdP
 *    session is also terminated.
 * 3. Zitadel will redirect back to the post_logout_redirect_uri (the home page).
 */

import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import * as oidcClient from 'openid-client';
import {
  getOidcConfig,
  clearSessionCookieAttrs
} from '$lib/server/auth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ cookies }) => {
  const postLogoutUri = env.ORIGIN ?? 'http://localhost:5173';

  // 1. Clear local session cookie immediately
  const attrs = clearSessionCookieAttrs();
  cookies.set(attrs.name, attrs.value, {
    httpOnly: attrs.httpOnly,
    secure: attrs.secure,
    sameSite: attrs.sameSite,
    path: attrs.path,
    maxAge: attrs.maxAge
  });

  // 2. Build the end_session URL via openid-client
  let endSessionUrl: URL;
  try {
    const config = await getOidcConfig();
    endSessionUrl = oidcClient.buildEndSessionUrl(config, {
      post_logout_redirect_uri: postLogoutUri
    });
  } catch {
    throw redirect(302, postLogoutUri);
  }

  throw redirect(302, endSessionUrl.toString());
};
