/**
 * src/routes/+page.server.ts
 *
 * Landing page load — exposes whether the user is logged in
 * so the hero CTAs can point to /discover instead of /auth/login.
 */

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  return {
    loggedIn: !!locals.user
  };
};
