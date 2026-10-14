#!/usr/bin/env node

'use strict';

// Writes AVIF siblings of the symbol page hero (480w, 800w, 1200w) next to the
// WebP variants in img/seo/symbols-v2. The symbol page offers them first in its
// <picture>. They are encoded from the same source illustrations as the WebP
// files. This lives apart from generate-symbol-responsive-images.js so its WebP
// build cache, keyed on that script's code, stays valid.

const fs = require('fs');
const path = require('path');
const sharp = require('../apps/site/dependencies')('sharp');
const { createImageBuildCache } = require('./lib/image-build-cache');
const { ROOT_DIR } = require('./lib/docs-site-config');
const {
  SYMBOL_DETAIL_RESPONSIVE_WIDTHS,
  loadSymbolImageRegistry,
} = require('./lib/symbol-image-assets');
const {
  collectGeneratedIllustrations,
  collectIllustrations,
  mergeIllustrations,
} = require('./generate-symbol-responsive-images');

const SOURCE_DATA_PATHS = [
  path.join(ROOT_DIR, 'docs-src', 'static', 'data', 'dream-symbols-extended.json'),
  path.join(ROOT_DIR, 'docs-src', 'static', 'data', 'dream-symbols-extended-tier3.json'),
];
const OUTPUT_DIR = path.join(ROOT_DIR, 'docs-src', 'static', 'img', 'seo', 'symbols-v2');
const WIDTHS = SYMBOL_DETAIL_RESPONSIVE_WIDTHS;
const AVIF_OPTIONS = Object.freeze({ quality: 52, effort: 5, chromaSubsampling: '4:4:4' });

function collectSymbolIllustrations() {
  const editorial = SOURCE_DATA_PATHS
    .filter((sourcePath) => fs.existsSync(sourcePath))
    .flatMap((sourcePath) => collectIllustrations(JSON.parse(fs.readFileSync(sourcePath, 'utf8'))));
  return mergeIllustrations(editorial, collectGeneratedIllustrations(loadSymbolImageRegistry()));
}

async function generateSymbolAvif({ force = false, manifestPath = path.join(
  ROOT_DIR, 'docs-src', 'config', 'image-build-cache', 'symbols-avif.json'
) } = {}) {
  const cache = createImageBuildCache({
    manifestPath,
    codePaths: [__filename, require.resolve('./lib/image-build-cache')],
    versions: sharp.versions,
  });
  const illustrations = collectSymbolIllustrations();
  let generated = 0;
  for (const illustration of illustrations) {
    for (const width of WIDTHS) {
      const target = path.join(OUTPUT_DIR, `${illustration.stem}-${width}w.avif`);
      const key = path.basename(target);
      const input = cache.fingerprint(illustration.sourcePath, { width, ...AVIF_OPTIONS });
      if (!force && cache.isFresh(key, input, target)) continue;
      await sharp(illustration.sourcePath)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .avif(AVIF_OPTIONS)
        .toFile(target);
      cache.record(key, input, target);
      generated += 1;
    }
  }
  cache.commit();
  console.log(
    `[generate-symbol-avif-images] ${illustrations.length} symbol heroes, ` +
      `${generated} AVIF variants regenerated, ${illustrations.length * WIDTHS.length - generated} up to date.`
  );
  return { illustrations, generated };
}

if (require.main === module) {
  generateSymbolAvif({ force: process.argv.includes('--force') }).catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = { collectSymbolIllustrations, generateSymbolAvif, WIDTHS };
