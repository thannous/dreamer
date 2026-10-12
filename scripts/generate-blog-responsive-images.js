#!/usr/bin/env node

'use strict';

// Writes AVIF siblings for every blog photo that already ships its 480w, 800w
// and 1200w WebP variants. The renderer offers them first in <picture>, so
// browsers that decode AVIF fetch roughly a third fewer bytes. There is no
// higher-quality original in the repository, so every width is resized from
// the 1200w WebP once instead of re-encoding an already resized file.

const fs = require('fs');
const path = require('path');
const sharp = require('../apps/site/dependencies')('sharp');
const { createImageBuildCache } = require('./lib/image-build-cache');
const { ROOT_DIR } = require('./lib/docs-site-config');

const BLOG_IMAGE_DIR = path.join(ROOT_DIR, 'docs-src', 'static', 'img', 'blog');
const WIDTHS = Object.freeze([480, 800, 1200]);
const AVIF_OPTIONS = Object.freeze({ quality: 52, effort: 5, chromaSubsampling: '4:4:4' });

function collectBlogImageStems(dir = BLOG_IMAGE_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('-1200w.webp'))
    .map((name) => name.slice(0, -'-1200w.webp'.length))
    .filter((stem) => WIDTHS.every((width) => fs.existsSync(path.join(dir, `${stem}-${width}w.webp`))))
    .sort();
}

async function generateBlogAvif({ dir = BLOG_IMAGE_DIR, force = false, manifestPath = path.join(
  ROOT_DIR, 'docs-src', 'config', 'image-build-cache', 'blog.json'
) } = {}) {
  const cache = createImageBuildCache({
    manifestPath,
    codePaths: [__filename, require.resolve('./lib/image-build-cache')],
    versions: sharp.versions,
  });
  const stems = collectBlogImageStems(dir);
  let generated = 0;
  for (const stem of stems) {
    const sourcePath = path.join(dir, `${stem}-1200w.webp`);
    for (const width of WIDTHS) {
      const target = path.join(dir, `${stem}-${width}w.avif`);
      const key = path.basename(target);
      const input = cache.fingerprint(sourcePath, { width, ...AVIF_OPTIONS });
      if (!force && cache.isFresh(key, input, target)) continue;
      await sharp(sourcePath)
        .resize({ width, withoutEnlargement: true })
        .avif(AVIF_OPTIONS)
        .toFile(target);
      cache.record(key, input, target);
      generated += 1;
    }
  }
  cache.commit();
  console.log(
    `[generate-blog-responsive-images] ${stems.length} blog photos, ` +
      `${generated} AVIF variants regenerated, ${stems.length * WIDTHS.length - generated} up to date.`
  );
  return { stems, generated };
}

if (require.main === module) {
  generateBlogAvif({ force: process.argv.includes('--force') }).catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = { collectBlogImageStems, generateBlogAvif, WIDTHS };
