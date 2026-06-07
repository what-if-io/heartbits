import type { RequestHandler } from './$types';
import { locales, localizeHref } from '$lib/paraglide/runtime';

// Public, indexable pages only (private app routes are disallowed in robots.txt).
const SITE = 'https://heartbits.what-if.io';
const PAGES = ['/', '/about', '/privacy', '/terms', '/status'];

export const prerender = true;

export const GET: RequestHandler = () => {
  const lastmod = new Date().toISOString().slice(0, 10);

  const entries: string[] = [];
  for (const page of PAGES) {
    const alternates = [
      ...locales.map(
        (l) =>
          `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${localizeHref(page, { locale: l })}"/>`
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${page}"/>`
    ].join('\n');

    // One <url> entry per localized URL, each advertising all hreflang alternates.
    for (const l of locales) {
      const loc = `${SITE}${localizeHref(page, { locale: l })}`;
      entries.push(
        `  <url>\n    <loc>${loc}</loc>\n${alternates}\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${page === '/' ? '1.0' : '0.6'}</priority>\n  </url>`
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
