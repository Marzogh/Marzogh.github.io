import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const sitemapIndexPath = path.join(distDir, 'sitemap-index.xml');
const robotsPath = path.join(distDir, 'robots.txt');
const expectedSitemapUrl = 'https://chipsncode.com/sitemap-index.xml';

function extractTagValues(xml, tagName) {
  const pattern = new RegExp(`<${tagName}>([^<]+)</${tagName}>`, 'g');
  const values = [];
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    values.push(match[1].trim());
  }
  return values;
}

function toCandidatePaths(pathname) {
  if (!pathname || pathname === '/') return ['index.html'];
  const normalized = pathname.replace(/^\/+|\/+$/g, '');
  if (!normalized) return ['index.html'];

  const hasExtension = path.extname(normalized) !== '';
  if (hasExtension) return [normalized];

  return [`${normalized}/index.html`, `${normalized}.html`];
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const robotsText = await readFile(robotsPath, 'utf8');
  if (!robotsText.includes(`Sitemap: ${expectedSitemapUrl}`)) {
    throw new Error(`robots.txt must contain: Sitemap: ${expectedSitemapUrl}`);
  }

  const indexXml = await readFile(sitemapIndexPath, 'utf8');
  const sitemapUrls = extractTagValues(indexXml, 'loc');

  if (sitemapUrls.length === 0) {
    throw new Error('No child sitemaps were found in sitemap-index.xml.');
  }

  const missingSitemapFiles = [];
  const missingPageTargets = [];
  let totalPageUrls = 0;

  for (const sitemapUrl of sitemapUrls) {
    const url = new URL(sitemapUrl);
    const sitemapFile = url.pathname.replace(/^\/+/, '');
    const sitemapFilePath = path.join(distDir, sitemapFile);

    if (!(await fileExists(sitemapFilePath))) {
      missingSitemapFiles.push(sitemapFile);
      continue;
    }

    const childXml = await readFile(sitemapFilePath, 'utf8');
    const pageUrls = extractTagValues(childXml, 'loc');
    totalPageUrls += pageUrls.length;

    for (const pageUrl of pageUrls) {
      const pagePathname = new URL(pageUrl).pathname;
      const candidates = toCandidatePaths(pagePathname);
      let found = false;

      for (const candidate of candidates) {
        const outputPath = path.join(distDir, candidate);
        if (await fileExists(outputPath)) {
          found = true;
          break;
        }
      }

      if (!found) {
        missingPageTargets.push(`${pagePathname} -> ${candidates.join(' OR ')}`);
      }
    }
  }

  if (missingSitemapFiles.length > 0 || missingPageTargets.length > 0) {
    if (missingSitemapFiles.length > 0) {
      console.error('Missing sitemap files:');
      for (const file of missingSitemapFiles) console.error(`- ${file}`);
    }
    if (missingPageTargets.length > 0) {
      console.error('Sitemap URLs without matching build output:');
      for (const entry of missingPageTargets) console.error(`- ${entry}`);
    }
    process.exit(1);
  }

  console.log(
    `Sitemap validation passed: robots.txt is valid, ${sitemapUrls.length} sitemap file(s), ${totalPageUrls} URL(s).`,
  );
}

main().catch((error) => {
  console.error(`Sitemap validation failed: ${error.message}`);
  process.exit(1);
});
