# Chips’nCode

Chips’nCode is where I keep the things I build, investigate, photograph, teach and occasionally get distracted by.

The site contains amateur radio, electronics, software, astronomy, technical documentation, teaching resources, photography, poetry and other projects. This repository contains the source for [chipsncode.com](https://chipsncode.com).

## What is here

- **Notebook:** Investigations, technical notes and rabbit holes.
- **Projects:** Things built, being built, or documented after considerable experimentation.
- **Documentation:** Manuals, references, restored material and technical documentation.
- **Tools:** Utilities and small purpose-built applications.
- **Education:** Teaching and student resources.
- **Astrophotography:** Images, observing sessions and processing notes.
- **Poetry:** Preserved older writing.

Different kinds of material use different presentation styles. A technical manual, an image gallery and a project page do not need to look or behave identically.

## How the site is built

Chips’nCode is statically generated with Astro 5. Content is written in Markdown and MDX and managed through Astro Content Collections. React is used where interactive components are needed, Shiki provides syntax highlighting, and Sharp handles image processing.

Structured content is primarily under `src/content/`, with collection definitions and schemas in `src/content.config.ts`.

## Running locally

| Command | Purpose |
| --- | --- |
| `npm install` | Install the project dependencies. |
| `npm run dev` | Start the local development server. |
| `npm run build` | Generate the production site. |
| `npm run preview` | Preview the production build locally. |

## Content

The current Astro content collections are:

```text
src/content/
├── astrophotography/
├── blog/
├── docs/
├── education/
├── projects/
└── tools/
```

The `blog` collection is presented publicly as the Notebook. Routes and page-specific interfaces live in `src/pages/`, reusable components in `src/components/`, and static assets and standalone resources in `public/`. Astro Content Collections validate frontmatter against the schemas in `src/content.config.ts`.

## Site-specific tooling

The `scripts/` directory contains site-specific import and validation utilities, including education resource import, astronomy almanac import, astronomy manifest validation and sitemap validation.

## Design

Chips’nCode has a documented site architecture and design language covering the shared foundations of the site and the deliberate differences between its sections. See [Site architecture and design language](/docs/site-architecture-and-design-language/).

## Repository structure

```text
.
├── public/
├── scripts/
├── src/
│   ├── components/
│   ├── content/
│   ├── layouts/
│   ├── pages/
│   └── utils/
├── astro.config.mjs
├── package.json
└── README.md
```

The live site is the best place to browse the finished material. This repository is where the machinery, source material and occasional evidence of how much trouble that material caused live.
