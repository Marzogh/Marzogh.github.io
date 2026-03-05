// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://chipsncode.com',

  output: 'static',

  trailingSlash: 'never',

  integrations: [
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/education/digital-technologies-yr9-2026/') &&
        !page.includes('/education/student-resources/digital-technologies-yr9-2026/'),
    }),
    react(),
  ],
});
