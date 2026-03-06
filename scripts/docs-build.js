#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  DATA_DIR,
  DOCS_DIR,
  DOCS_SRC_DIR,
  ROOT_DIR,
  staticPagesConfig,
} = require('./lib/docs-site-config');
const { renderManagedPage } = require('./lib/docs-renderer');
const {
  copyDir,
  ensureDir,
  readJson,
  readSourceDocument,
} = require('./lib/docs-source-utils');

function pad(number) {
  return String(number).padStart(2, '0');
}

function generateBuildVersion(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function runNodeScript(relativeScriptPath, args = []) {
  const scriptPath = path.join(ROOT_DIR, relativeScriptPath);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`Script failed: ${relativeScriptPath}`);
  }
}

function bumpAssetVersion() {
  const version = generateBuildVersion();
  const versionPath = path.join(DOCS_SRC_DIR, 'static', 'version.txt');
  fs.writeFileSync(versionPath, `${version}\n`, 'utf8');
  console.log(`[docs-build] version.txt -> ${version}`);
}

function sourcePath(kind, entryId, lang) {
  return path.join(DOCS_SRC_DIR, 'content', kind, entryId, `${lang}.md`);
}

function outputPathForStaticPage(page, lang) {
  const slug = page.slugs[lang];
  return slug
    ? path.join(DOCS_DIR, lang, `${slug}.html`)
    : path.join(DOCS_DIR, lang, 'index.html');
}

function outputPathForBlogEntry(entry, lang) {
  const locale = entry.locales[lang];
  return entry.id === 'blog.index'
    ? path.join(DOCS_DIR, lang, 'blog', 'index.html')
    : path.join(DOCS_DIR, lang, 'blog', `${locale.slug}.html`);
}

function cleanManagedOutputs() {
  for (const lang of ['en', 'fr', 'es', 'de', 'it']) {
    const langDir = path.join(DOCS_DIR, lang);
    const blogDir = path.join(langDir, 'blog');

    if (fs.existsSync(langDir)) {
      for (const entry of fs.readdirSync(langDir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.html')) {
          fs.unlinkSync(path.join(langDir, entry.name));
        }
      }
    }

    if (fs.existsSync(blogDir)) {
      for (const entry of fs.readdirSync(blogDir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.html')) {
          fs.unlinkSync(path.join(blogDir, entry.name));
        }
      }
    }
  }
}

function writeManagedPages(manifest) {
  const blogEntries = manifest.collections.blog.entries;

  for (const page of staticPagesConfig.pages) {
    for (const lang of Object.keys(page.slugs)) {
      const outputPath = outputPathForStaticPage(page, lang);
      const { meta, body } = readSourceDocument(sourcePath('pages', page.pageId, lang));
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(
        outputPath,
        renderManagedPage({
          manifest,
          entryId: page.pageId,
          meta,
          bodyHtml: body,
        }),
        'utf8'
      );
    }
  }

  for (const entry of Object.values(blogEntries)) {
    for (const lang of Object.keys(entry.locales)) {
      const outputPath = outputPathForBlogEntry(entry, lang);
      const { meta, body } = readSourceDocument(sourcePath('blog', entry.id, lang));
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(
        outputPath,
        renderManagedPage({
          manifest,
          entryId: entry.id,
          meta,
          bodyHtml: body,
        }),
        'utf8'
      );
    }
  }
}

function copyStaticFiles() {
  copyDir(path.join(DOCS_SRC_DIR, 'static'), DOCS_DIR);
}

function main() {
  runNodeScript(path.join('scripts', 'build-content-manifest.js'));
  runNodeScript(path.join('scripts', 'build-site-manifest.js'));

  bumpAssetVersion();
  cleanManagedOutputs();
  copyStaticFiles();

  const manifest = readJson(path.join(DATA_DIR, 'site-manifest.json'));
  writeManagedPages(manifest);

  runNodeScript(path.join('docs', 'scripts', 'generate-symbol-pages.js'));
  runNodeScript(path.join('scripts', 'fix-guides-architecture.js'));
  runNodeScript(path.join('scripts', 'generate-sitemap-v2.js'));

  console.log('[docs-build] Docs build complete.');
}

main();
