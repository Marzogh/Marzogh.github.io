import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SOURCE_ROOT = '/Users/prajwal/Personal/My Poems';
const OUTPUT_DATA = path.resolve('src/data/poetry.generated.ts');
const OUTPUT_ASSET_ROOT = path.resolve('public/legacy-poetry');

const CP1252_MAP = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};

function decodeCp1252(buffer) {
  let output = '';
  for (const byte of buffer) {
    if (CP1252_MAP[byte]) {
      output += String.fromCodePoint(CP1252_MAP[byte]);
      continue;
    }
    output += String.fromCodePoint(byte);
  }
  return output;
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeWhitespace(value) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function slugify(filename) {
  return filename
    .replace(/^\d+\.\s*/, '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugifyTitle(title) {
  return title
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fingerprintLines(lines) {
  return lines
    .join('\n')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 240);
}

function copyAsset(relativePath) {
  if (!relativePath) return null;

  const source = path.join(SOURCE_ROOT, relativePath);
  if (!fs.existsSync(source)) return null;

  const target = path.join(OUTPUT_ASSET_ROOT, relativePath.toLowerCase());
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return `/${path.relative('public', target).split(path.sep).join('/')}`;
}

function extractMatch(source, pattern, label, file) {
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Could not extract ${label} from ${file}`);
  }
  return match[1];
}

function parsePoemFile(filePath) {
  const filename = path.basename(filePath);
  const source = decodeCp1252(fs.readFileSync(filePath));

  const title = normalizeWhitespace(
    decodeEntities(extractMatch(source, /<title>\s*([\s\S]*?)\s*<\/title>/i, 'title', filename)),
  );

  const poemHtml = extractMatch(
    source,
    /<p[^>]*>([\s\S]*?)<img\s+src="images\/prajwal\.gif"/i,
    'poem body',
    filename,
  );

  const bodyText = normalizeWhitespace(
    decodeEntities(
      poemHtml
        .replace(/\r?\n\s*/g, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ''),
    ),
  );

  const footer = source.match(/written and designed by[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i)?.[1];
  if (!footer) {
    throw new Error(`Could not extract publication date from ${filename}`);
  }
  const footerTitle = source.match(/<small><font[^>]*>"([^"]+)"/i)?.[1]?.trim() ?? null;

  const headerAsset = source.match(/<center>[\s\S]*?<img\s+src="([^"]+)"/i)?.[1] ?? null;
  const backgroundAsset = source.match(/\bbackground="([^"]+)"/i)?.[1] ?? null;
  const lines = bodyText.split('\n').map((line) => line.trim());
  const excerpt = lines.filter(Boolean).slice(0, 2).join(' ').trim();

  return {
    slug: slugify(filename),
    sourceFile: filename,
    title,
    footerTitle,
    pubDate: footer,
    excerpt,
    lines,
    headerImage: copyAsset(headerAsset),
    backgroundImage: copyAsset(backgroundAsset),
    quality: (footerTitle && slugifyTitle(footerTitle) === slugifyTitle(title) ? 1 : 0) + (headerAsset ? 1 : 0) + (backgroundAsset ? 1 : 0),
  };
}

function parseDocxFile(filePath) {
  const filename = path.basename(filePath);
  const source = execFileSync('textutil', ['-convert', 'txt', '-stdout', filePath], {
    encoding: 'utf8',
  });

  const lines = source
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\u00a0/g, ''))
    .map((line) => line.trimRight());

  const nonEmpty = lines.map((line, index) => ({ line: line.trim(), index })).filter((item) => item.line);
  const title = nonEmpty[0]?.line;
  const dateCandidate = nonEmpty.at(-1)?.line;
  const authorCandidate = nonEmpty.at(-2)?.line;

  if (!title) {
    throw new Error(`Could not extract title from ${filename}`);
  }

  const dateMatch = dateCandidate?.match(/^\(?\s*(\d{2})\.(\d{2})\.(\d{2,4})\s*\)?$/);
  if (!dateMatch || !authorCandidate) {
    return null;
  }

  const [, day, month, yearRaw] = dateMatch;
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  const pubDate = `${day}/${month}/${year}`;

  const startIndex = nonEmpty[0].index + 1;
  const endIndex = nonEmpty.at(-2).index;
  const bodyLines = lines
    .slice(startIndex, endIndex)
    .map((line) => line.trim())
    .filter((line, index, arr) => !(line === '' && arr[index - 1] === ''));

  const excerpt = bodyLines.filter(Boolean).slice(0, 2).join(' ').trim();

  return {
    slug: slugify(filename),
    sourceFile: filename,
    title,
    footerTitle: title,
    pubDate,
    excerpt,
    lines: bodyLines,
    headerImage: null,
    backgroundImage: null,
    quality: 0,
  };
}

function toTs(entries) {
  const payload = JSON.stringify(entries, null, 2);

  return `export type PoetryEntry = {
  slug: string;
  sourceFile: string;
  title: string;
  footerTitle: string | null;
  pubDate: string;
  excerpt: string;
  lines: string[];
  headerImage: string | null;
  backgroundImage: string | null;
};

export const poetryEntries: PoetryEntry[] = ${payload} as PoetryEntry[];
`;
}

const htmlFiles = fs
  .readdirSync(SOURCE_ROOT)
  .filter((file) => /\.html?$/i.test(file))
  .filter((file) => !/^main page/i.test(file))
  .sort((a, b) => a.localeCompare(b));

const htmlEntriesRaw = htmlFiles.map((file) => parsePoemFile(path.join(SOURCE_ROOT, file)));
const dedupedHtml = new Map();
for (const entry of htmlEntriesRaw) {
  const fingerprint = fingerprintLines(entry.lines);
  const current = dedupedHtml.get(fingerprint);
  if (!current || entry.quality > current.quality) {
    dedupedHtml.set(fingerprint, entry);
  }
}
const htmlEntries = [...dedupedHtml.values()];
const existingKeys = new Set(htmlEntries.map((entry) => `${entry.pubDate}:${slugifyTitle(entry.title)}`));
const existingFingerprints = new Set(htmlEntries.map((entry) => fingerprintLines(entry.lines)));

const docxRoot = path.join(SOURCE_ROOT, 'Poems as text files');
const docxFiles = fs
  .readdirSync(docxRoot)
  .filter((file) => /\.docx$/i.test(file))
  .filter((file) => !/^important notes/i.test(file))
  .sort((a, b) => a.localeCompare(b));

const docxEntries = docxFiles
  .map((file) => parseDocxFile(path.join(docxRoot, file)))
  .filter(Boolean)
  .filter((entry) => {
    const key = `${entry.pubDate}:${slugifyTitle(entry.title)}`;
    const fingerprint = fingerprintLines(entry.lines);
    if (existingKeys.has(key) || existingFingerprints.has(fingerprint)) return false;
    existingKeys.add(key);
    existingFingerprints.add(fingerprint);
    return true;
  });

const entries = [...htmlEntries, ...docxEntries].sort((a, b) => {
  const [aday, amonth, ayear] = a.pubDate.split('/').map(Number);
  const [bday, bmonth, byear] = b.pubDate.split('/').map(Number);
  return Date.UTC(ayear, amonth - 1, aday) - Date.UTC(byear, bmonth - 1, bday);
});

fs.mkdirSync(path.dirname(OUTPUT_DATA), { recursive: true });
fs.writeFileSync(OUTPUT_DATA, toTs(entries));

console.log(`Imported ${entries.length} poem entries to ${OUTPUT_DATA}`);
