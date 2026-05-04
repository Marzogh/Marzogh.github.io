import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sourceDir = path.join(repoRoot, 'vendor', 'the-living-codex');
const targetDir = path.join(repoRoot, 'public', 'living-codex');
const sourceIcon = path.join(repoRoot, 'public', 'images', 'projects', 'living-codex', 'rahu-watermark-1.png');
const targetIcon = path.join(targetDir, 'assets', 'rahu-favicon.png');

const FAVICON_SNIPPET = [
  '<!-- Living Codex custom favicon -->',
  '<link rel="icon" type="image/png" sizes="32x32" href="assets/rahu-favicon.png" />',
  '<link rel="apple-touch-icon" href="assets/rahu-favicon.png" />',
].join('\n');

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function injectFavicon(htmlPath) {
  const ok = await exists(htmlPath);
  if (!ok) return;
  const raw = await readFile(htmlPath, 'utf8');
  const cleaned = raw.replace(/<!-- Living Codex custom favicon -->[\s\S]*?<link rel="apple-touch-icon" href="assets\/rahu-favicon\.png" \/>\n?/g, '');
  const withFavicon = cleaned.replace('</head>', `${FAVICON_SNIPPET}\n</head>`);
  await writeFile(htmlPath, withFavicon, 'utf8');
}

async function main() {
  const sourceExists = await exists(sourceDir);
  if (!sourceExists) {
    throw new Error(
      'Missing submodule at vendor/the-living-codex. Run: git submodule update --init --recursive'
    );
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(path.dirname(targetDir), { recursive: true });

  await cp(sourceDir, targetDir, {
    recursive: true,
    filter: (src) => {
      const name = path.basename(src);
      if (name === '.git') return false;
      if (name === '.DS_Store') return false;
      return true;
    },
  });

  // Copy site-owned favicon artwork into the mirrored app folder.
  await mkdir(path.dirname(targetIcon), { recursive: true });
  await cp(sourceIcon, targetIcon);

  // Ensure all Living Codex entrypoints use the custom icon.
  await injectFavicon(path.join(targetDir, 'index.html'));
  await injectFavicon(path.join(targetDir, 'v2.html'));
  await injectFavicon(path.join(targetDir, 'v2-standalone.html'));

  console.log('Synced Living Codex into public/living-codex');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
