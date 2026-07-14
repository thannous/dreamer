#!/usr/bin/env node


'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { DOCS_SRC_DIR, ROOT_DIR } = require('./lib/docs-site-config');

const INPUT_PATH = path.join(
  DOCS_SRC_DIR,
  'static',
  'img',
  'hero',
  'noctalia-observatory-bg.png'
);
const OUTPUT_PATH = path.join(
  DOCS_SRC_DIR,
  'static',
  'img',
  'hero',
  'noctalia-observatory-bg.webp'
);
const MAX_OUTPUT_BYTES = 300_000;

async function optimizeHomepageHero(inputPath = INPUT_PATH, outputPath = OUTPUT_PATH) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing hero source: ${path.relative(ROOT_DIR, inputPath)}`);
  }

  await sharp(inputPath)
    .rotate()
    .webp({ effort: 6, quality: 68, smartSubsample: true })
    .toFile(outputPath);

  const sourceBytes = fs.statSync(inputPath).size;
  const outputBytes = fs.statSync(outputPath).size;
  if (outputBytes > MAX_OUTPUT_BYTES) {
    throw new Error(`Optimized hero is ${outputBytes} bytes; maximum is ${MAX_OUTPUT_BYTES}`);
  }
  if (outputBytes >= sourceBytes) {
    throw new Error('Optimized hero must be smaller than the PNG source');
  }

  return { outputBytes, sourceBytes };
}

if (require.main === module) {
  optimizeHomepageHero()
    .then(({ outputBytes, sourceBytes }) => {
      const reduction = Math.round((1 - outputBytes / sourceBytes) * 100);
      console.log(
        `[optimize-homepage-hero] ${path.relative(ROOT_DIR, OUTPUT_PATH)}: ` +
          `${sourceBytes} -> ${outputBytes} bytes (${reduction}% smaller).`
      );
    })
    .catch((error) => {
      console.error(`[optimize-homepage-hero] Failed: ${error.message || error}`);
      process.exit(1);
    });
}

module.exports = {
  MAX_OUTPUT_BYTES,
  optimizeHomepageHero,
};
