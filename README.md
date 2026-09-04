# Chips'nCode

Astro-powered personal site for technical writing, projects, tools, education resources, poetry, and astrophotography.

Live deployment is served as a static site.

## Stack

- Astro 5
- Astro Content Collections (Markdown/MDX)
- CI-based static deployment

## Content Collections

Content is managed in `src/content/`:

- `blog`
- `docs`
- `projects`
- `tools`
- `education`
- `poetry`
- `astrophotography`

Collection schemas and validation live in `src/content.config.ts`.

## Local Development

Run all commands from repository root:

| Command | Action |
| :-- | :-- |
| `npm install` | Install dependencies |
| `npm run dev` | Start local dev server |
| `npm run build` | Build static site to `dist/` |
| `npm run preview` | Preview production build locally |

## Publishing Workflow

1. Add or edit content in the relevant `src/content/<collection>/` directory.
2. Include frontmatter fields expected by the schema (for example: `title`, `description`, `pubDate`, `tags`, optional `updatedDate`, optional `featured`).
3. Run `npm run build` before pushing.
4. Push through the normal repository workflow to trigger deployment.

Tags are normalized to slug routes under `/tags/<tag-slug>/`.

## Education Resource Import Workflow

For imported standalone lesson pages, use the import script so naming and privacy cleanup stay consistent:

```bash
node scripts/import-education-resource.mjs \
  --source "/absolute/path/to/source.html" \
  --dest-dir "public/education/student-resources/year-12-biology"
```

Rules enforced by this workflow:

1. Output filenames are standalone slugs with no lesson numbering (for example `gene-expression.html`, not `07-gene-expression.html`).
2. Numbered lesson labels in the HTML are stripped (for example `Lesson 7:` becomes just the topic heading).
3. Identifying teacher information is sanitized (`Mr. Bhattaram` is rewritten to `Mr. B`).
4. Class-code identifiers are stripped from imported HTML content.

After importing HTML into `public/education/student-resources/<subject-folder>/`, create a matching MDX wrapper in `src/content/education/...` using `EmbeddedResource` so the resource appears in the Education collection.

## CLI Index Shell

The reusable shell component lives at:

- `src/components/CliShell.astro`

It is used on:

- `/docs`
- `/projects`
- `/tools`
- `/notebook`

Notes:

- Supports unix-style commands (`stat`, `ls`, `cd`, `grep`, `tag`, `man`, etc.)
- Supports per-command help via `--help` / `-h`
- Manual drawer includes keyboard navigation and clickable `SEE ALSO`
- Hidden on mobile breakpoints to keep index pages lightweight

## Deployment

- Deployment target: static hosting
- Build output: static files in `dist/`

Deployment is handled by the repository's configured CI workflow.

## Astronomy Almanac Hooks

This repository includes a stable static integration surface for yearly almanac outputs:

- Route: `/astronomy`
- Manifest: `public/astronomy/manifest.json`
- Bundle payload root: `public/astronomy/years/<year>/<site-slug>/`

Import generated almanac outputs from the local almanac project:

```bash
npm run astronomy:import -- --year=2027 --site='South East Queensland, Australia' --source='/Users/prajwal/Documents/GitHub/astroplan/personal-astro-almanac/output'
```

Import multiple year/site bundles in one command:

Note: `--sites` uses `;;` as the separator to allow commas inside site names.

```bash
npm run astronomy:import:bundles -- --years=2027,2028 --sites='South East Queensland, Australia;;Southern Tasmania, Australia;;Malabar Coast, India' --source='/Users/prajwal/Documents/GitHub/astroplan/personal-astro-almanac/output'
```
Or pass explicit bundles:

```bash
npm run astronomy:import:bundles -- --bundles='2027|South East Queensland, Australia|/path/to/output;2028|Southern Tasmania, Australia|/path/to/output2'
```

The importer copies:
- `almanac.html`
- `almanac.pdf`
- `data/`
- `charts/`
- `months/`
- `logs/`

and updates `public/astronomy/manifest.json` so the `/astronomy` page can discover it.
Manifest entries are automatically preserved and upserted per `(year, site-slug)` so repeated imports do not erase other bundles.

Validate manifest integrity and required files:

```bash
npm run astronomy:validate
```

## Domain and DNS

Custom domain DNS is managed outside this repository.

## Repository Layout

```text
.
├── public/
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
