import type { Reroute } from '@sveltejs/kit';
import { deLocalizeUrl } from '$lib/paraglide/runtime';

// Strip the locale prefix (/es/about → /about) so SvelteKit's router matches the
// real route. The Paraglide server middleware still reads the locale from the
// original (prefixed) URL. Runs on both server and client.
export const reroute: Reroute = ({ url }) => deLocalizeUrl(url).pathname;
