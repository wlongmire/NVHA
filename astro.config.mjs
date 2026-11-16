import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// Pages are built as static files, except /edit and /api/edit/* which run on demand (they need to log you in
// and save to GitHub). The adapter is what lets Vercel run those few routes. Deployed from GitHub.
// Page URLs match the old WordPress site (for example /about-us/ and /haiku-lesson-plans/) so search rankings carry over.
export default defineConfig({
  site: 'https://nickvirgiliohaiku.org',
  output: 'static',
  trailingSlash: 'always',
  adapter: vercel(),
  integrations: [sitemap({ filter: (page) => !page.includes('/edit') })],
});
