/**
 * src/routes/auth/callback/+server.ts
 *
 * GET /auth/callback
 *
 * Receives the authorization code from Zitadel, exchanges it for tokens
 * using PKCE, validates the ID token, builds a session, sets the session
 * cookie, and redirects to /discover (or the original ?next= path).
 */

import type { RequestHandler } from './$types';
import { redirect, error } from '@sveltejs/kit';
import * as oidcClient from 'openid-client';
import {
  getOidcConfig,
  getRedirectUri,
  parseSession,
  serializeSession,
  sessionCookieAttrs,
  clearPkceStateCookies,
  SESSION_COOKIE,
  PKCE_COOKIE,
  STATE_COOKIE,
  type SessionData
} from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, cookies }) => {
  // 1. Retrieve PKCE verifier and expected state from cookies
  const codeVerifier = cookies.get(PKCE_COOKIE);
  const expectedState = cookies.get(STATE_COOKIE);

  if (!codeVerifier || !expectedState) {
    throw error(400, 'Auth session expired or missing. Please try logging in again.');
  }

  // 2. Validate state parameter to prevent CSRF
  const returnedState = url.searchParams.get('state');
  if (!returnedState || returnedState !== expectedState) {
    throw error(400, 'Invalid state parameter. Possible CSRF attack.');
  }

  // 3. Check for error from Zitadel
  const authError = url.searchParams.get('error');
  if (authError) {
    const description = url.searchParams.get('error_description') ?? authError;
    throw error(400, `Authentication failed: ${description}`);
  }

  // 4. Exchange authorization code for tokens
  const config = await getOidcConfig();

  let tokenSet: oidcClient.TokenEndpointResponse;
  try {
    tokenSet = await oidcClient.authorizationCodeGrant(config, url, {
      pkceCodeVerifier: codeVerifier,
      expectedState,
      redirectUri: getRedirectUri()
    });
  } catch (e) {
    console.error('[auth/callback] Token exchange failed:', e);
    throw error(502, 'Failed to exchange authorization code. Please try again.');
  }

  // 5. Extract claims from the ID token
  const claims = tokenSet.claims();
  if (!claims) {
    throw error(502, 'No ID token claims returned from authorization server.');
  }

  const userId = claims.sub;
  const email = (claims.email as string | undefined) ?? '';
  const name =
    (claims.name as string | undefined) ??
    (claims.preferred_username as string | undefined) ??
    email;

  // 6. Determine token expiry (fall back to 1 hour from now)
  const expiresAt =
    typeof tokenSet.expires_in === 'number'
      ? Math.floor(Date.now() / 1000) + tokenSet.expires_in
      : Math.floor(Date.now() / 1000) + 3600;

  // 7. Build and sign the session cookie
  const sessionData: SessionData = {
    userId,
    email,
    name,
    accessToken: tokenSet.access_token ?? '',
    expiresAt
  };

  const signedSession = await serializeSession(sessionData);
  const attrs = sessionCookieAttrs(signedSession);

  cookies.set(attrs.name, attrs.value, {
    httpOnly: attrs.httpOnly,
    secure: attrs.secure,
    sameSite: attrs.sameSite,
    path: attrs.path,
    maxAge: attrs.maxAge
  });

  // 8. Clear the PKCE / state cookies — they're single-use
  for (const c of clearPkceStateCookies()) {
    cookies.set(c.name, c.value, {
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
      path: c.path,
      maxAge: c.maxAge
    });
  }

  // 9. Redirect to original destination or /discover
  // State format: "randomState:encodedNextPath" or just "randomState"
  const colonIdx = expectedState.indexOf(':');
  const nextPath =
    colonIdx !== -1
      ? decodeURIComponent(expectedState.slice(colonIdx + 1))
      : '/discover';

  // Safety: only allow relative paths on our own origin
  const safeNext =
    nextPath.startsWith('/') && !nextPath.startsWith('//')
      ? nextPath
      : '/discover';

  throw redirect(302, safeNext);
};
