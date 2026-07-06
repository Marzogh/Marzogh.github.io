#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = Object.fromEntries(
  args
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=');
      return [k, rest.join('=') || 'true'];
    }),
);

const repoRoot = process.cwd();
const targetRoot = path.join(repoRoot, 'public', 'astronomy');
const manifestPath = path.join(targetRoot, 'manifest.json');

const defaultSource = '/Users/prajwal/Documents/GitHub/astroplan/personal-astro-almanac/output';

function slugifySite(site) {
  return String(site)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) return { version: 1, entries: [] };
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(parsed.entries)) {
    // Back-compat with previous shape
    const years = Array.isArray(parsed.years) ? parsed.years : [];
    return {
      version: 1,
      entries: years.map((y) => ({
        year: y.year,
        site: y.site || 'Unknown',
        siteSlug: slugifySite(y.site || 'unknown'),
        basePath: y.basePath || `/astronomy/years/${y.year}`,
        sourceOutput: defaultSource,
        generatedAt: y.generatedAt || new Date().toISOString(),
      })),
    };
  }
  return parsed;
}

function writeManifest(manifest) {
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function importOne({ source, year, site }) {
  const siteSlug = slugifySite(site);
  const yearSrc = path.join(source, String(year));
  const dstBase = path.join(targetRoot, 'years', String(year), siteSlug);

  if (!fs.existsSync(yearSrc)) {
    throw new Error(`Source year path not found: ${yearSrc}`);
  }

  fs.mkdirSync(dstBase, { recursive: true });
  copyDir(path.join(yearSrc, 'data'), path.join(dstBase, 'data'));
  copyDir(path.join(yearSrc, 'charts'), path.join(dstBase, 'charts'));
  copyDir(path.join(yearSrc, 'months'), path.join(dstBase, 'months'));
  copyDir(path.join(yearSrc, 'logs'), path.join(dstBase, 'logs'));

  for (const f of ['almanac.html', 'almanac.pdf']) {
    const s = path.join(yearSrc, f);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(dstBase, f));
  }

  const basePath = `/astronomy/years/${year}/${siteSlug}`;
  return {
    year: Number(year),
    site,
    siteSlug,
    basePath,
    sourceOutput: source,
    generatedAt: new Date().toISOString(),
  };
}

function upsertEntry(entries, entry) {
  const i = entries.findIndex((e) => String(e.year) === String(entry.year) && String(e.siteSlug) === String(entry.siteSlug));
  if (i >= 0) entries[i] = { ...entries[i], ...entry };
  else entries.push(entry);
}

function parseBatchJson(batchPath) {
  const full = path.resolve(batchPath);
  const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('--batch-json must be a JSON array');
  return parsed.map((row) => ({
    year: row.year,
    site: row.site,
    source: row.source || defaultSource,
  }));
}

function parseBatchCsv(csvPath) {
  const full = path.resolve(csvPath);
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',').map((s) => s.trim().toLowerCase());
  const iy = header.indexOf('year');
  const is = header.indexOf('site');
  const io = header.indexOf('source');
  if (iy < 0 || is < 0) throw new Error('batch csv requires year,site columns');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    return {
      year: cols[iy]?.trim(),
      site: cols[is]?.trim(),
      source: (io >= 0 ? cols[io]?.trim() : '') || defaultSource,
    };
  });
}

function main() {
  const manifest = readManifest();
  manifest.version = 1;
  manifest.entries = Array.isArray(manifest.entries) ? manifest.entries : [];

  let batch = [];
  if (opt['batch-json']) batch = parseBatchJson(opt['batch-json']);
  if (opt['batch-csv']) batch = parseBatchCsv(opt['batch-csv']);

  if (!batch.length) {
    batch = [
      {
        source: opt.source || defaultSource,
        year: opt.year || '2027',
        site: opt.site || 'South East Queensland, Australia',
      },
    ];
  }

  for (const row of batch) {
    if (!row.year || !row.site) {
      console.warn('Skipping row with missing year/site:', row);
      continue;
    }
    const entry = importOne({ source: row.source || defaultSource, year: row.year, site: row.site });
    upsertEntry(manifest.entries, entry);
    console.log(`Imported ${entry.year} ${entry.site} -> ${entry.basePath}`);
  }

  manifest.entries.sort((a, b) => (a.year - b.year) || a.site.localeCompare(b.site));
  writeManifest(manifest);
  console.log(`Updated manifest: ${manifestPath}`);
}

main();
