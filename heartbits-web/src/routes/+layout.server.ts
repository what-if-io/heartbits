/**
 * src/routes/+layout.server.ts
 *
 * Exposes the authenticated user to all pages via $page.data.user.
 * event.locals.user is populated by hooks.server.ts on every request.
 */

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
  return {
    user: locals.user ?? null,
    isDemo: locals.user?.isDemo ?? false
  };
};
