# Chips'nCode

Astro-powered personal site for technical writing, projects, tools, education resources, poetry, and astrophotography.

Live deployment is served via GitHub Pages.

## Stack

- Astro 5
- Astro Content Collections (Markdown/MDX)
- GitHub Actions + GitHub Pages deployment

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
4. Push to `master` to trigger deployment.

Tags are normalized to slug routes under `/tags/<tag-slug>/`.

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

- Primary branch: `master`
- Deployment target: GitHub Pages
- Build output: static files in `dist/`

If deployment fails, check the GitHub Actions workflow logs in the repository Actions tab.

## Living Codex Sync

This site tracks [The Living Codex](https://github.com/Marzogh/The-Living-Codex) as a git submodule:

- Submodule path: `vendor/the-living-codex`
- Tracking branch: `main`
- Served route: `/living-codex/*` (synced into `public/living-codex` at build time)

### Automatic sync

The workflow `.github/workflows/sync-living-codex.yml` runs daily (and on manual dispatch), updates the submodule to latest `main`, and opens/updates a PR on branch `sync/living-codex` when changes exist.

### Manual fallback sync

Run from repo root:

```bash
git submodule update --init --recursive
git submodule update --remote --merge vendor/the-living-codex
git add .gitmodules vendor/the-living-codex
git commit -m "chore(sync): bump Living Codex submodule"
git push origin HEAD
```

To refresh the static payload locally:

```bash
npm run sync:living-codex
```

## Domain and DNS

Custom domain DNS is managed outside this repo (Squarespace DNS host), while site hosting is GitHub Pages.

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
