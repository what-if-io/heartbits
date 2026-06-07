import type { RequestHandler } from './$types';

// Public, indexable pages only (private app routes are disallowed in robots.txt).
// Note: locales are served via cookie/Accept-Language (no per-locale URLs), so
// there are no hreflang alternates to emit yet — see the SEO notes / roadmap.
const SITE = 'https://heartbits.what-if.io';
const PAGES = ['/', '/about', '/privacy', '/terms', '/status'];

export const prerender = true;

export const GET: RequestHandler = () => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = PAGES.map(
    (p) =>
      `  <url>\n    <loc>${SITE}${p}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${p === '/' ? '1.0' : '0.6'}</priority>\n  </url>`
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
