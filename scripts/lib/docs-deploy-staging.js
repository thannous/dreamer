'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { DOCS_DIR } = require('./docs-site-config');
const { copyFile, walkFiles } = require('./docs-source-utils');

const ALLOWED_ROOT_DIRECTORIES = new Set([
  '.well-known',
  'auth',
  'css',
  'de',
  'en',
  'es',
  'fonts',
  'fr',
  'img',
  'it',
  'js',
  'logo',
  'screenshot',
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
    if (FORBIDDEN_STAGE_PATTERNS.some((pattern) => pattern.test(relativePath))) {
      errors.push(`internal artifact in deployment: ${relativePath}`);
    }
  }

  if (errors.length > 0) throw new Error(errors.join('\n'));
}

function createDeployStaging(options = {}) {
  const docsDir = options.docsDir || DOCS_DIR;
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
