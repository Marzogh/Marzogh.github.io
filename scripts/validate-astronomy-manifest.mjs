#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'public', 'astronomy', 'manifest.json');

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  fail(`Manifest not found: ${manifestPath}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const entries = Array.isArray(manifest.entries)
  ? manifest.entries
  : Array.isArray(manifest.years)
    ? manifest.years
    : [];

if (!entries.length) {
  fail('Manifest has no entries.');
}

const seen = new Set();
let errors = 0;

for (const entry of entries) {
  const year = entry.year;
  const site = entry.site || 'Unknown';
  const basePath = entry.basePath;
  const siteSlug = entry.siteSlug || 'unknown';
  const key = `${year}::${siteSlug}`;

  if (seen.has(key)) {
    console.error(`ERROR: Duplicate manifest key ${key}`);
    errors += 1;
    continue;
  }
  seen.add(key);

  if (!year || !basePath) {
    console.error(`ERROR: Missing year/basePath for entry ${JSON.stringify(entry)}`);
    errors += 1;
    continue;
  }

  const rel = String(basePath).replace(/^\/+/, '');
  const abs = path.join(repoRoot, 'public', rel);
  const required = ['almanac.html', 'data'];
  const missing = required.filter((r) => !fs.existsSync(path.join(abs, r)));
  const pdfExists = fs.existsSync(path.join(abs, 'almanac.pdf'));

  if (missing.length) {
    console.error(`ERROR: ${year} ${site} missing in ${basePath}: ${missing.join(', ')}`);
    errors += 1;
  } else {
    const suffix = pdfExists ? '' : ' (warning: missing almanac.pdf)';
    console.log(`OK: ${year} ${site} (${basePath})${suffix}`);
  }
}

if (errors) {
  fail(`Validation failed with ${errors} error(s).`);
}

console.log(`Manifest validation passed (${entries.length} entries).`);
