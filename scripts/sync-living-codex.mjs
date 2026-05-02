import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sourceDir = path.join(repoRoot, 'vendor', 'the-living-codex');
const targetDir = path.join(repoRoot, 'public', 'living-codex');

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
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

  console.log('Synced Living Codex into public/living-codex');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
