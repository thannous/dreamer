#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { ROOT_DIR } = require('./lib/docs-site-config');

const SOURCE_DATA_PATH = path.join(
  ROOT_DIR,
  'docs-src',
  'static',
  'data',
  'dream-symbols-extended.json'
);
const STATIC_DIR = path.join(ROOT_DIR, 'docs-src', 'static');
const OUTPUT_DIR = path.join(STATIC_DIR, 'img', 'seo', 'symbols-v1');
const WIDTHS = [480, 800, 1200];
const MAX_BYTES = 250_000;
const WARN_BYTES = 180_000;

function collectIllustrations(payload) {
  const illustrations = new Map();
  for (const [symbolId, localized] of Object.entries(payload?.symbols || {})) {
    for (const value of Object.values(localized || {})) {
      const illustration = value?.illustration;
      if (!illustration?.src) continue;
      const stem = path.basename(illustration.src, path.extname(illustration.src));
      const existing = illustrations.get(stem);
      if (existing && existing.src !== illustration.src) {
        throw new Error(`Responsive symbol stem collision: ${stem}`);
      }
      illustrations.set(stem, {
        symbolId,
        stem,
        src: illustration.src,
        sourcePath: path.join(STATIC_DIR, illustration.src.replace(/^\/+/, '')),
      });
    }
  }
  return [...illustrations.values()].sort((a, b) => a.stem.localeCompare(b.stem));
}

function outputPath(illustration, width) {
  return path.join(OUTPUT_DIR, `${illustration.stem}-${width}w.webp`);
}

async function generateIllustrations(illustrations) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const illustration of illustrations) {
    for (const width of WIDTHS) {
      await sharp(illustration.sourcePath)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82, effort: 5, smartSubsample: true })
        .toFile(outputPath(illustration, width));
    }
  }
}

async function validateIllustrations(illustrations) {
  const errors = [];
  const warnings = [];
  for (const illustration of illustrations) {
    if (!fs.existsSync(illustration.sourcePath)) {
      errors.push(`${illustration.symbolId}: missing source ${illustration.src}`);
      continue;
    }
    const source = await sharp(illustration.sourcePath).metadata();
    if (!source.width || source.width < 1200 || !source.height) {
      errors.push(`${illustration.symbolId}: source must be at least 1200px wide`);
      continue;
    }
    for (const width of WIDTHS) {
      const target = outputPath(illustration, width);
      if (!fs.existsSync(target)) {
        errors.push(`${illustration.symbolId}: missing ${path.relative(ROOT_DIR, target)}`);
        continue;
      }
      const metadata = await sharp(target).metadata();
      const expectedHeight = Math.round((source.height / source.width) * width);
      if (metadata.width !== width || metadata.height !== expectedHeight || metadata.format !== 'webp') {
        errors.push(
          `${illustration.symbolId}: ${width}w variant expected ${width}x${expectedHeight} WebP, got ${metadata.width}x${metadata.height} ${metadata.format}`
        );
      }
      const bytes = fs.statSync(target).size;
      if (width === 1200 && bytes > MAX_BYTES) {
        errors.push(`${illustration.symbolId}: 1200w variant is ${bytes} bytes (max ${MAX_BYTES})`);
      } else if (width === 1200 && bytes > WARN_BYTES) {
        warnings.push(`${illustration.symbolId}: 1200w variant is ${bytes} bytes`);
      }
    }
  }
  if (errors.length > 0) throw new Error(`Invalid responsive symbol images:\n- ${errors.join('\n- ')}`);
  return { warnings };
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const payload = JSON.parse(fs.readFileSync(SOURCE_DATA_PATH, 'utf8'));
  const illustrations = collectIllustrations(payload);
  if (!checkOnly) await generateIllustrations(illustrations);
  const result = await validateIllustrations(illustrations);
  console.log(
    `Responsive symbol images ${checkOnly ? 'checked' : 'generated'}: ` +
      `${illustrations.length} illustrations, ${illustrations.length * WIDTHS.length} WebP variants.`
  );
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  collectIllustrations,
  outputPath,
  validateIllustrations,
};
