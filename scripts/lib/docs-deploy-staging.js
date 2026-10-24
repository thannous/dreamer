'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT_DIR, DOCS_DIR, siteConfig } = require('./docs-site-config');
const { copyFile, walkFiles } = require('./docs-source-utils');
const { readMedia, verifyLocal: verifyMediaLocal, assertRemoteReceipt, cdnRedirect } = require('./site-media');

const ALLOWED_ROOT_DIRECTORIES = new Set([
  '.well-known',
  // Sleep sounds the app downloads on first play (lib/sleepSounds.ts).
  'audio',
  'auth',
  // Symbol interpretations the native app downloads per language
  // (services/symbolExtendedContent.ts).
  'content',
  'css',
  ...siteConfig.languages,
  'fonts',
  'img',
  'js',
  'logo',
  'screenshot',
  // Public landing films and the downloadable press walkthrough.
  'video',
]);

// Linked from the localized comparison and press pages. Keep every other
// data export excluded, including source catalogs and private reports.
const ALLOWED_PUBLIC_DATA_FILES = new Set([
  'data/dream-journal-apps-comparison-2026.csv',
]);

const ALLOWED_ROOT_FILES = new Set([
  '404.html',
  '_headers',
  '_redirects',
  'assetlinks.json',
  'favicon.ico',
  'favicon.png',
  'favicon.svg',
  'index.html',
  'llms.txt',
  'logo192.png',
  'logo512.png',
  'robots.txt',
  'sitemap.xml',
  'version.txt',
]);

const REQUIRED_STAGE_PATHS = [
  'index.html',
  'sitemap.xml',
  'robots.txt',
  '_headers',
  '_redirects',
  'llms.txt',
  'css',
  'js',
  'en',
  'fr',
  'es',
  'de',
  'it',
];

const FORBIDDEN_STAGE_PATTERNS = [
  /(^|\/)AGENTS\.md$/i,
  /(^|\/)audits?(\/|$)/i,
  /(^|\/)data(\/|$)/i,
  /(^|\/)scripts?(\/|$)/i,
  /(^|\/)templates?(\/|$)/i,
  /(^|\/)\.git/i,
  /\.md$/i,
  /(^|\/)vercel\.json$/i,
  /(^|\/)fix_og\.js$/i,
];

const EXCLUDED_RUNTIME_ASSETS = new Set([
  'img/hero/noctalia-observatory-bg.png',
]);

function isRootVerificationFile(fileName) {
  return /^[a-f0-9]{24,64}\.txt$/i.test(fileName);
}

function assertDeployStaging(deployDir) {
  const errors = [];
  for (const requiredPath of REQUIRED_STAGE_PATHS) {
    if (!fs.existsSync(path.join(deployDir, requiredPath))) {
      errors.push(`missing required runtime path: ${requiredPath}`);
    }
  }

  for (const filePath of walkFiles(deployDir)) {
    const relativePath = path.relative(deployDir, filePath).split(path.sep).join('/');
    if (EXCLUDED_RUNTIME_ASSETS.has(relativePath)) {
      errors.push(`obsolete heavyweight asset in deployment: ${relativePath}`);
    }
    if (
      !ALLOWED_PUBLIC_DATA_FILES.has(relativePath) &&
      FORBIDDEN_STAGE_PATTERNS.some((pattern) => pattern.test(relativePath))
    ) {
      errors.push(`internal artifact in deployment: ${relativePath}`);
    }
  }

  if (errors.length > 0) throw new Error(errors.join('\n'));
}

function createDeployStaging(options = {}) {
  const docsDir = options.docsDir || DOCS_DIR;
  const mediaRoot = options.rootDir || (options.docsDir ? path.dirname(path.resolve(options.docsDir)) : ROOT_DIR);
  const media = readMedia(mediaRoot);
  const useCdn = media?.config.delivery === 'cdn';
  if (useCdn) {
    assertRemoteReceipt(mediaRoot, media);
    verifyMediaLocal(mediaRoot);
  }
  const tempRoot = options.tempRoot || fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-pages-'));
  const deployDir = path.join(tempRoot, 'public');
  fs.mkdirSync(deployDir, { recursive: true });

  for (const entry of fs.readdirSync(docsDir, { withFileTypes: true })) {
    const sourcePath = path.join(docsDir, entry.name);
    const destinationPath = path.join(deployDir, entry.name);

    if (entry.isDirectory() && ALLOWED_ROOT_DIRECTORIES.has(entry.name)) {
      for (const filePath of walkFiles(sourcePath)) {
        const relativeFromDocs = path.relative(docsDir, filePath).split(path.sep).join('/');
        if (EXCLUDED_RUNTIME_ASSETS.has(relativeFromDocs)) continue;
        if (useCdn && relativeFromDocs.startsWith('img/')) {
          if (!media.paths.has(relativeFromDocs)) throw new Error(`Unpublished CDN media: ${relativeFromDocs}`);
          continue;
        }
        copyFile(filePath, path.join(destinationPath, path.relative(sourcePath, filePath)));
      }
      continue;
    }
    if (
      entry.isFile() &&
      (ALLOWED_ROOT_FILES.has(entry.name) || isRootVerificationFile(entry.name))
    ) {
      copyFile(sourcePath, destinationPath);
    }
  }

  for (const relativePath of ALLOWED_PUBLIC_DATA_FILES) {
    const sourcePath = path.join(docsDir, relativePath);
    if (fs.existsSync(sourcePath)) {
      copyFile(sourcePath, path.join(deployDir, relativePath));
    }
  }

  if (useCdn) {
    const redirects = path.join(deployDir, '_redirects');
    fs.writeFileSync(redirects, `${cdnRedirect(media)}\n${fs.readFileSync(redirects, 'utf8')}`);
    // The alias may switch snapshots or roll back; only the R2 object is immutable.
    const headersFile = path.join(deployDir, '_headers');
    let inImages = false, foundImages = false;
    const headers = [];
    for (const line of fs.readFileSync(headersFile, 'utf8').split(/\r?\n/)) {
      if (line.trim() && !/^\s*#/.test(line) && !/^\s/.test(line)) {
        inImages = line.trim() === '/img/*';
        if (inImages) {
          foundImages = true;
          headers.push(line, '  Cache-Control: public, max-age=300, must-revalidate');
          continue;
        }
      }
      if (inImages && /^\s+Cache-Control:/i.test(line)) continue;
      headers.push(line);
    }
    if (!foundImages) headers.push('/img/*', '  Cache-Control: public, max-age=300, must-revalidate');
    fs.writeFileSync(headersFile, headers.join('\n') + '\n');
  }
  assertDeployStaging(deployDir);
  return {
    deployDir,
    tempRoot,
    cleanup() {
      if (!options.tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}

function summarizeDeployStaging(deployDir) {
  const files = walkFiles(deployDir);
  const bytes = files.reduce((total, filePath) => total + fs.statSync(filePath).size, 0);
  return { bytes, files: files.length };
}

module.exports = {
  ALLOWED_ROOT_DIRECTORIES,
  ALLOWED_ROOT_FILES,
  EXCLUDED_RUNTIME_ASSETS,
  FORBIDDEN_STAGE_PATTERNS,
  REQUIRED_STAGE_PATHS,
  assertDeployStaging,
  createDeployStaging,
  summarizeDeployStaging,
};
