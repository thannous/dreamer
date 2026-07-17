#!/usr/bin/env node


const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
  copyFile,
  ensureDir,
  readJson,
  readSourceDocument,
} = require('./lib/docs-source-utils');
const {
  markDocsBuildFailed,
  markDocsBuildStarted,
  markDocsBuildSucceeded,
} = require('./lib/docs-check-helpers');

function hashAssetFiles() {
  const hash = crypto.createHash('sha256');
  const assetInputs = [
    path.join(DOCS_SRC_DIR, 'static', 'css'),
    path.join(DOCS_SRC_DIR, 'static', 'js'),
    path.join(DOCS_SRC_DIR, 'static', 'img', 'seo'),
    path.join(DOCS_SRC_DIR, 'static', 'img', 'og', 'noctalia-dreamscape-v2-1200x630.jpg'),
    path.join(DOCS_SRC_DIR, 'config', 'image-assets.json'),
  ];

  function hashInput(inputPath) {
    if (!fs.existsSync(inputPath)) return;
    if (fs.statSync(inputPath).isFile()) {
      hash.update(path.relative(DOCS_SRC_DIR, inputPath));
      hash.update(fs.readFileSync(inputPath));
      return;
    }
    for (const entry of fs.readdirSync(inputPath).sort()) {
      hashInput(path.join(inputPath, entry));
    }
  }

  for (const inputPath of assetInputs) hashInput(inputPath);
  return hash.digest('hex').slice(0, 12);
}

function resolveBuildVersion() {
  const fromEnv = process.env.DOCS_BUILD_VERSION;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.trim();
  }
  return hashAssetFiles();
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

function writeAssetVersion(version) {
  const versionPath = path.join(DOCS_DIR, 'version.txt');
  ensureDir(path.dirname(versionPath));
  fs.writeFileSync(versionPath, `${version}\n`, 'utf8');
  console.log(`[docs-build] version.txt -> ${version}`);
}

function sourcePath(kind, entryId, lang) {
  return path.join(DOCS_SRC_DIR, 'content', kind, entryId, `${lang}.md`);
}

function outputPathForStaticPage(page, lang) {
  if (page.pageId === 'page.home' && lang === 'en') {
    return path.join(DOCS_DIR, 'index.html');
  }

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
  const homeEntry = manifest.collections.pages.entries['page.home'];

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

  const englishHomeOutputPath = path.join(DOCS_DIR, manifest.defaultLanguage, 'index.html');
  const { meta: englishHomeMeta, body: englishHomeBody } = readSourceDocument(
    sourcePath('pages', 'page.home', manifest.defaultLanguage)
  );

  ensureDir(path.dirname(englishHomeOutputPath));
  fs.writeFileSync(
    englishHomeOutputPath,
    renderManagedPage({
      manifest,
      entryId: 'page.home',
      meta: {
        ...englishHomeMeta,
        robots: 'noindex, follow',
        currentPath: '/',
      },
      bodyHtml: englishHomeBody,
      entryOverride: {
        ...homeEntry,
        locales: {
          ...homeEntry.locales,
          [manifest.defaultLanguage]: {
            ...homeEntry.locales[manifest.defaultLanguage],
            path: '/',
          },
        },
      },
    }),
    'utf8'
  );

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
  // `docs/scripts` is generated from `docs-src/static/scripts`. Recreate it so
  // archived or removed maintenance tools cannot survive as stale output.
  fs.rmSync(path.join(DOCS_DIR, 'scripts'), { recursive: true, force: true });
  copyDir(path.join(DOCS_SRC_DIR, 'static'), DOCS_DIR);
  // The editorial symbol catalog has one canonical source. Copy it after the
  // static assets so a stale generated snapshot can never drive symbol pages.
  copyFile(
    path.join(DATA_DIR, 'dream-symbols.json'),
    path.join(DOCS_DIR, 'data', 'dream-symbols.json')
  );
}

function main() {
  markDocsBuildStarted(ROOT_DIR);

  // Content quality is a hard prerequisite for generating or expanding the
  // programmatic symbol inventory.
  runNodeScript(path.join('scripts', 'check-content-release-gates.js'));
  runNodeScript(path.join('scripts', 'build-content-manifest.js'));
  runNodeScript(path.join('scripts', 'build-site-manifest.js'));
  runNodeScript(path.join('scripts', 'generate-image-seo-assets.js'));
  runNodeScript(path.join('scripts', 'generate-symbol-hero-posters.js'));
  runNodeScript(path.join('scripts', 'generate-symbol-responsive-images.js'));
  // Bundles docs-src/experience into docs-src/static/js/experience so the
  // output is covered by the asset version hash computed just after.
  runNodeScript(path.join('scripts', 'build-experience.js'));

  const version = resolveBuildVersion();
  cleanManagedOutputs();
  copyStaticFiles();
  writeAssetVersion(version);

  const manifest = readJson(path.join(DATA_DIR, 'site-manifest.json'));
  writeManagedPages(manifest);

  runNodeScript(path.join('docs', 'scripts', 'generate-symbol-pages.js'));
  runNodeScript(path.join('scripts', 'build-guides-pages.js'));
  runNodeScript(path.join('scripts', 'check-docs-shell.js'));
  runNodeScript(path.join('scripts', 'generate-sitemap-v2.js'));

  markDocsBuildSucceeded(ROOT_DIR, { version });
  console.log('[docs-build] Docs build complete.');
}

try {
  main();
} catch (error) {
  markDocsBuildFailed(ROOT_DIR, error);
  throw error;
}
