/**
 * src/hooks.server.ts
 *
 * Runs on every request (server-side).
 *   1. Reads and validates the session cookie first.
 *   2. Staging gate — if STAGING_PASSWORD is set, gate the app behind a password.
 *      Bypassed for: static assets, all /auth/* routes, /pitch, and any valid session
 *      (real or demo). This lets demo users and logged-in users skip the gate.
 *   3. Attaches the user to event.locals.
 *   4. Redirects unauthenticated requests from protected routes to /auth/login.
 */

import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { parseSession, SESSION_COOKIE } from '$lib/server/auth';

const PROTECTED_PREFIXES = ['/discover', '/matches', '/bond', '/profile'];
// Public, ungated pages — the waitlist landing and marketing/legal pages.
// The app itself (PROTECTED_PREFIXES) stays behind the staging gate + auth.
const PUBLIC_PATHS = new Set(['/', '/about', '/privacy', '/terms', '/pitch', '/status', '/waitlist']);
const STAGING_COOKIE = 'hb_staging';

export const handle: Handle = async ({ event, resolve }) => {
  const { url: { pathname }, request } = event;

  // ── Session (parse first so staging gate can check it) ───────────────────
  const sessionCookie = event.cookies.get(SESSION_COOKIE);
  const session = await parseSession(sessionCookie);
  event.locals.user = session
    ? { userId: session.userId, email: session.email, name: session.name, isDemo: session.isDemo ?? false }
    : null;

  // ── Staging gate ─────────────────────────────────────────────────────────
  const stagingPassword = env.STAGING_PASSWORD;
  if (stagingPassword) {
    const isAsset = pathname.startsWith('/_app/') || /\.[a-z0-9]+$/i.test(pathname);
    const isAuth  = pathname.startsWith('/auth/');
    const isPublic = PUBLIC_PATHS.has(pathname);
    const hasSession = !!event.locals.user;

    if (!isAsset && !isAuth && !isPublic && !hasSession) {
      const stagingCookie = event.cookies.get(STAGING_COOKIE);

      if (request.method === 'POST') {
        const body = await request.formData().catch(() => null);
        const submitted = body?.get('password')?.toString() ?? '';
        if (submitted === stagingPassword) {
          const maxAge = 60 * 60 * 24 * 30;
          const cookie = `${STAGING_COOKIE}=${stagingPassword}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
          return new Response(null, {
            status: 302,
            headers: { Location: pathname || '/', 'Set-Cookie': cookie }
          });
        }
        return new Response(stagingPage(true), {
          status: 401,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      if (stagingCookie !== stagingPassword) {
        return new Response(stagingPage(false), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    }
  }

  // ── Auth guard for protected routes ──────────────────────────────────────
  if (!pathname.startsWith('/auth')) {
    const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
    if (isProtected && !event.locals.user) {
      const loginUrl = new URL('/auth/login', event.url.origin);
      loginUrl.searchParams.set('next', pathname);
      throw redirect(302, loginUrl.toString());
    }
  }

  return resolve(event);
};

function stagingPage(error: boolean): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>HeartBits</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100svh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #030308;
      font-family: system-ui, sans-serif;
      color: #fff;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
      max-width: 320px;
      padding: 0 24px;
    }
    h1 { font-size: 1.5rem; font-weight: 600; text-align: center; letter-spacing: -0.02em; }
    p  { font-size: 0.875rem; color: #8a8a9a; text-align: center; }
    .err { color: #ff6b6b; font-size: 0.8rem; text-align: center; }
    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid #2a2a3a;
      background: #0f0f1a;
      color: #fff;
      font-size: 1rem;
      outline: none;
    }
    input[type="password"]:focus { border-color: #e03d5a; }
    button {
      padding: 12px;
      border-radius: 12px;
      border: none;
      background: #e03d5a;
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #c42e48; }
  </style>
</head>
<body>
  <form method="POST">
    <h1>HeartBits</h1>
    <p>Private preview</p>
    ${error ? '<p class="err">Wrong password</p>' : ''}
    <input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
    <button type="submit">Enter</button>
  </form>
</body>
</html>`;
}
