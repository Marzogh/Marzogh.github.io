import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { DOC_SECTION_LABELS } from './utils/docs';

// ------------------------
// Blog Collection
// ------------------------

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date().optional(),
      updatedDate: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
      type: z.string().optional(),
      featured: z.boolean().default(false),
      image: z.string().optional(),
      headerStyle: z.enum(['panel', 'plain']).optional(),
    }),
});

// ------------------------
// Projects Collection
// ------------------------

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date().optional(),
      updatedDate: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
      type: z.string().optional(),
      featured: z.boolean().default(false),
      github: z.string().url().optional(),
      demo: z.string().url().optional(),
      image: z.string().optional(),
    }),
});

// ------------------------
// Tools Collection
// ------------------------

const tools = defineCollection({
  loader: glob({ base: './src/content/tools', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date().optional(),
      updatedDate: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
    }),
});

// ------------------------
// Documentation Collection
// ------------------------

const docs = defineCollection({
  loader: glob({ base: './src/content/docs', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date().optional(),
      updatedDate: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      section: z.enum(DOC_SECTION_LABELS).default('General'),
      order: z.number().optional(),
      tags: z.array(z.string()).default([]),
      type: z.string().optional(),
      featured: z.boolean().default(false),
      image: z.string().optional(),
    }),
});

// ------------------------
// Education Collection
// ------------------------

const education = defineCollection({
  loader: glob({ base: './src/content/education', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date().optional(),
      updatedDate: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      level: z.string().optional(),
      subject: z.string().optional(),
      order: z.number().optional(),
      tags: z.array(z.string()).default([]),
      type: z.string().optional(),
      featured: z.boolean().default(false),
      image: z.string().optional(),
    }),
});

// ------------------------
// Astrophotography Collection
// ------------------------

const astrophotography = defineCollection({
  loader: glob({ base: './src/content/astrophotography', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date().optional(),
      updatedDate: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
      type: z.string().optional(),
      featured: z.boolean().default(false),

      target: z.string().optional(),
      sessionDate: z.coerce.date().optional(),
      location: z.string().optional(),
      camera: z.string().optional(),
      lensOrTelescope: z.string().optional(),
      mount: z.string().optional(),
      filters: z.array(z.string()).default([]),
      totalIntegrationMinutes: z.number().optional(),
      processing: z.array(z.string()).default([]),

      image: image().optional(),
      gallery: z.array(image()).optional(),
    }),
});

export const collections = {
  blog,
  projects,
  tools,
  docs,
  education,
  astrophotography,
};
