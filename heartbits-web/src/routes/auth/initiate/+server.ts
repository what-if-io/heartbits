/**
 * src/routes/auth/initiate/+server.ts
 *
 * GET /auth/initiate[?next=/some/path]
 *
 * Generates a PKCE code_verifier + state, stores them in short-lived
 * httpOnly cookies, then redirects the browser to Zitadel's authorize URL.
 *
 * Kept separate from /auth/login so the login page (+page.svelte) can render
 * its UI while this endpoint handles only the OIDC redirect.
 *
 * Accepts an optional `?next=<path>` query param that will be stored in
 * the state so the callback can redirect back to the original page.
 */

import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import * as oidcClient from 'openid-client';
import {
  getOidcConfig,
  getRedirectUri,
  SCOPES,
  pkceCookieAttrs,
  stateCookieAttrs
} from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const config = await getOidcConfig();

  // PKCE: generate code_verifier + derive code_challenge
  const codeVerifier = oidcClient.randomPKCECodeVerifier();
  const codeChallenge = await oidcClient.calculatePKCECodeChallenge(codeVerifier);

  // Generate random state, optionally encode a post-login redirect
  const randomState = oidcClient.randomState();
  const nextPath = url.searchParams.get('next');
  // Pack next path into state as "randomState:encodedPath" — safe since state
  // is verified at callback time and we control encoding
  const state = nextPath
    ? `${randomState}:${encodeURIComponent(nextPath)}`
    : randomState;

  // Store verifier + state in short-lived httpOnly cookies for the callback
  cookies.set(pkceCookieAttrs(codeVerifier).name, codeVerifier, {
    httpOnly: pkceCookieAttrs(codeVerifier).httpOnly,
    secure: pkceCookieAttrs(codeVerifier).secure,
    sameSite: pkceCookieAttrs(codeVerifier).sameSite,
    path: pkceCookieAttrs(codeVerifier).path,
    maxAge: pkceCookieAttrs(codeVerifier).maxAge
  });

  cookies.set(stateCookieAttrs(state).name, state, {
    httpOnly: stateCookieAttrs(state).httpOnly,
    secure: stateCookieAttrs(state).secure,
    sameSite: stateCookieAttrs(state).sameSite,
    path: stateCookieAttrs(state).path,
    maxAge: stateCookieAttrs(state).maxAge
  });

  // Build the authorization URL
  const authUrl = oidcClient.buildAuthorizationUrl(config, {
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state
  });

  throw redirect(302, authUrl.toString());
};
