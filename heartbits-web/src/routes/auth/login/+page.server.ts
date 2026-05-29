/**
 * src/routes/auth/login/+page.server.ts
 *
 * If the user is already authenticated, skip the login page and redirect
 * straight to /discover.
 */

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { env as pubEnv } from '$env/dynamic/public';

export const load: PageServerLoad = ({ locals, url }) => {
  if (locals.user && !locals.user.isDemo) {
    const next = url.searchParams.get('next') ?? '/discover';
    const safeNext =
      next.startsWith('/') && !next.startsWith('//')
        ? next
        : '/discover';
    throw redirect(302, safeNext);
  }

  const next = url.searchParams.get('next') ?? '';
  const issuer = pubEnv.PUBLIC_ZITADEL_ISSUER ?? '';
  return { next, issuer };
};
