#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function slugifyBaseName(filename) {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  const noLeadingLessonNumber = withoutExt.replace(/^\s*\d+\s*[.)\-:_]?\s*/u, '');
  return noLeadingLessonNumber
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeHtml(html) {
  let output = html;

  // Strip identifying information.
  output = output.replace(/Mr\.\s*Bhattaram/gi, 'Mr. B');

  // Strip class identifiers if present.
  output = output.replace(/\bBIO\d+[A-Z]?\b/g, '');
  output = output.replace(/\bMAG\d+[A-Z]?\b/g, '');

  // Remove numbered lesson labels while keeping meaning readable.
  output = output.replace(/From\s+Lesson\s+\d+/gi, 'From previous lesson');
  output = output.replace(/\b[Ll]esson\s+\d+\s*:\s*/g, '');
  output = output.replace(/\b[Ll]esson\s+\d+\b/g, 'Lesson');

  // Keep section branding but remove "self-learning pack" phrasing.
  output = output.replace(/Year\s*(\d+)\s+Biology\s+self-learning\s+pack/gi, 'Year $1 Biology');
  output = output.replace(/Year\s*(\d+)\s+Biology\s+Self-Learning\s+Pack/gi, 'Year $1 Biology');

  // Clean up any accidental double spaces from removals.
  output = output.replace(/ {2,}/g, ' ');

  return output;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.source;
  const destDir = args['dest-dir'];
  const slugArg = args.slug;

  if (!source || !destDir) {
    console.error('Usage: node scripts/import-education-resource.mjs --source "<input.html>" --dest-dir "<public-dir>" [--slug "target-slug"]');
    process.exit(1);
  }

  const sourceName = path.basename(source);
  const slug = slugArg ? slugArg.trim().toLowerCase() : slugifyBaseName(sourceName);
  if (!slug) {
    throw new Error(`Could not derive slug from source filename: ${sourceName}`);
  }

  const html = await readFile(source, 'utf-8');
  const sanitized = sanitizeHtml(html);

  const outputDir = path.resolve(destDir);
  const outputPath = path.join(outputDir, `${slug}.html`);
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, sanitized, 'utf-8');

  process.stdout.write(`${outputPath}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
