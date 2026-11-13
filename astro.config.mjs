// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://chipsncode.com',

  output: 'static',

  trailingSlash: 'ignore',

  integrations: [
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/education/digital-technologies-yr9-2026/') &&
        !/\/projects\/(?:openstarshoot|kite-lifted-endfed-activation|pixinsight-deep-sky-processing-checklist)\/?$/.test(page) &&
        !page.includes('/education/student-resources/digital-technologies-yr9-2026/'),
    }),
    react(),
  ],
});
