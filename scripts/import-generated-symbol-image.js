#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { ROOT_DIR } = require('./lib/docs-site-config');

const WIDTH = 1600;
const HEIGHT = 900;
const OUTPUT_DIR = path.join(
  ROOT_DIR,
  'docs-src',
  'static',
  'img',
  'symbols',
  'editorial-2026-07-v2'
);

function outputPathFor(symbolId) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(symbolId)) {
    throw new Error(`Invalid symbol id: ${symbolId}`);
  }
  return path.join(OUTPUT_DIR, `${symbolId}-v2.webp`);
}

async function importGeneratedSymbolImage(sourcePath, symbolId) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error(`Missing generated source: ${sourcePath || '(empty)'}`);
  }

  const outputPath = outputPathFor(symbolId);
  if (fs.existsSync(outputPath)) {
    throw new Error(
      `Refusing to overwrite versioned symbol image: ${path.relative(ROOT_DIR, outputPath)}`
    );
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await sharp(sourcePath)
    .rotate()
    .resize(WIDTH, HEIGHT, {
      fit: 'cover',
      position: sharp.strategy.attention,
    })
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(outputPath);

  const metadata = await sharp(outputPath).metadata();
  if (metadata.width !== WIDTH || metadata.height !== HEIGHT || metadata.format !== 'webp') {
    throw new Error(
      `Invalid imported image for ${symbolId}: ${metadata.width}x${metadata.height} ${metadata.format}`
    );
  }

  return outputPath;
}

async function main() {
  const [, , sourcePath, symbolId] = process.argv;
  if (!sourcePath || !symbolId) {
    throw new Error('Usage: node scripts/import-generated-symbol-image.js <source.png> <symbol-id>');
  }
  const outputPath = await importGeneratedSymbolImage(sourcePath, symbolId);
  console.log(path.relative(ROOT_DIR, outputPath));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  HEIGHT,
  OUTPUT_DIR,
  WIDTH,
  importGeneratedSymbolImage,
  outputPathFor,
};
