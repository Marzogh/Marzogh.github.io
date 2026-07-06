#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = Object.fromEntries(
  args
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=');
      return [k, rest.join('=') || 'true'];
    }),
);

const defaultSource = '/Users/prajwal/Documents/GitHub/astroplan/personal-astro-almanac/output';

function parseBundlesArg(value) {
  if (!value) return [];
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [year, site, source] = part.split('|').map((s) => s.trim());
      return { year, site, source: source || defaultSource };
    });
}

function parseMatrix(years, sites, source) {
  const y = (years || '').split(',').map((s) => s.trim()).filter(Boolean);
  const st = (sites || '').split(';;').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const year of y) {
    for (const site of st) out.push({ year, site, source: source || defaultSource });
  }
  return out;
}

function main() {
  let bundles = [];

  if (opt['batch-json']) {
    const full = path.resolve(opt['batch-json']);
    const rows = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (!Array.isArray(rows)) throw new Error('--batch-json must be a JSON array');
    bundles = rows.map((r) => ({ year: r.year, site: r.site, source: r.source || defaultSource }));
  }

  if (!bundles.length && opt.bundles) {
    bundles = parseBundlesArg(opt.bundles);
  }

  if (!bundles.length && opt.years && opt.sites) {
    bundles = parseMatrix(opt.years, opt.sites, opt.source || defaultSource);
  }

  if (!bundles.length) {
    throw new Error('No bundles provided. Use --bundles, --batch-json, or --years with --sites.');
  }

  const tmp = path.join(os.tmpdir(), `astro-batch-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(bundles, null, 2));

  const importScript = path.join(process.cwd(), 'scripts', 'import-astro-almanac.mjs');
  const run = spawnSync(process.execPath, [importScript, `--batch-json=${tmp}`], { stdio: 'inherit' });
  try { fs.unlinkSync(tmp); } catch {}
  process.exit(run.status ?? 1);
}

main();
