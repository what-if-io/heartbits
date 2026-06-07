import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      // URL first (so crawlers + shared links resolve locale from the path),
      // then cookie/Accept-Language fallback for the unprefixed base routes.
      strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
      // Base locale (en) stays at root; every other locale is path-prefixed
      // (e.g. /es/about). The base catch-all MUST be last — first match wins.
      urlPatterns: [
        {
          pattern: '/:path(.*)?',
          localized: [
            ['es', '/es/:path(.*)?'],
            ['fr', '/fr/:path(.*)?'],
            ['de', '/de/:path(.*)?'],
            ['it', '/it/:path(.*)?'],
            ['pt-BR', '/pt-BR/:path(.*)?'],
            ['el', '/el/:path(.*)?'],
            ['zh', '/zh/:path(.*)?'],
            ['ja', '/ja/:path(.*)?'],
            ['ko', '/ko/:path(.*)?'],
            ['ru', '/ru/:path(.*)?'],
            ['tr', '/tr/:path(.*)?'],
            ['ro', '/ro/:path(.*)?'],
            ['en', '/:path(.*)?']
          ]
        }
      ]
    }),
    sveltekit()
  ]
});
