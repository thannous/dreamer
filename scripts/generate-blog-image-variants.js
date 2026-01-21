#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Generates responsive WebP variants for blog images in `docs/img/blog/`.
 *
 * For each base image `slug.webp`, generates (if missing):
 * - `slug-480w.webp`
 * - `slug-800w.webp`
 * - `slug-1200w.webp`
 *
 * Usage:
 *   node scripts/generate-blog-image-variants.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DOCS_DIR = path.join(__dirname, '../docs');
const BLOG_IMG_DIR = path.join(DOCS_DIR, 'img', 'blog');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const TARGET_WIDTHS = [480, 800, 1200];

function isVariantFilename(filename) {
  return /-\d+w\.webp$/i.test(filename);
}

function listBaseWebpImages() {
  if (!fs.existsSync(BLOG_IMG_DIR)) return [];
  return fs
    .readdirSync(BLOG_IMG_DIR)
    .filter((name) => name.toLowerCase().endsWith('.webp'))
    .filter((name) => !isVariantFilename(name))
    .map((name) => ({
      name,
      slug: name.replace(/\.webp$/i, ''),
      absPath: path.join(BLOG_IMG_DIR, name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function outPathFor(slug, width) {
  return path.join(BLOG_IMG_DIR, `${slug}-${width}w.webp`);
}

async function ensureVariantsForImage({ slug, absPath }) {
  const pipeline = sharp(absPath);
  const meta = await pipeline.metadata();
  const width = meta && meta.width ? meta.width : null;
  if (!width) return { created: 0, skipped: TARGET_WIDTHS.length, reason: 'no-width' };

  let created = 0;
  let skipped = 0;

  for (const target of TARGET_WIDTHS) {
    const outPath = outPathFor(slug, target);
    if (fs.existsSync(outPath)) {
      skipped += 1;
      continue;
    }
    if (width < target) {
      skipped += 1;
      continue;
    }

    if (!DRY_RUN) {
      if (width === target) {
        fs.copyFileSync(absPath, outPath);
      } else {
        await pipeline
          .clone()
          .resize({ width: target, withoutEnlargement: true })
          .webp({ quality: 82, effort: 5 })
          .toFile(outPath);
      }
    }
    created += 1;
  }

  return { created, skipped, reason: 'ok' };
}

async function main() {
  if (!fs.existsSync(BLOG_IMG_DIR)) {
    console.error(`Missing directory: ${BLOG_IMG_DIR}`);
    process.exit(1);
  }

  const images = listBaseWebpImages();
  let created = 0;
  let processed = 0;

  for (const img of images) {
    const res = await ensureVariantsForImage(img);
    processed += 1;
    created += res.created;
  }

  const mode = DRY_RUN ? 'dry-run' : 'write';
  console.log(`[generate-blog-image-variants] mode=${mode} processed=${processed} created=${created}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

