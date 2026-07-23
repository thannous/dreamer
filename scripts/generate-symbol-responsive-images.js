#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { ROOT_DIR } = require('./lib/docs-site-config');
const {
  SYMBOL_RESPONSIVE_WIDTHS,
  generatedSymbolImagePath,
  loadSymbolImageRegistry,
} = require('./lib/symbol-image-assets');

const SOURCE_DATA_PATHS = [
  path.join(ROOT_DIR, 'docs-src', 'static', 'data', 'dream-symbols-extended.json'),
  path.join(ROOT_DIR, 'docs-src', 'static', 'data', 'dream-symbols-extended-tier3.json'),
];
const STATIC_DIR = path.join(ROOT_DIR, 'docs-src', 'static');
const CATALOG_PATH = path.join(ROOT_DIR, 'data', 'dream-symbols.json');
const POSTER_DIR = path.join(STATIC_DIR, 'img', 'symbols', 'posters-v1');
const OUTPUT_DIR = path.join(STATIC_DIR, 'img', 'seo', 'symbols-v2');
const WIDTHS = SYMBOL_RESPONSIVE_WIDTHS;
const CARD_MAX_BYTES = 30_000;
const MAX_BYTES = 250_000;
const WARN_BYTES = 180_000;

function collectIllustrations(payload) {
  const illustrations = new Map();
  for (const [symbolId, localized] of Object.entries(payload?.symbols || payload || {})) {
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

function collectPosterIllustrations(posterDir = POSTER_DIR) {
  if (!fs.existsSync(posterDir)) return [];
  return fs.readdirSync(posterDir)
    .filter((name) => name.endsWith('.webp'))
    .sort()
    .map((name) => ({
      symbolId: path.basename(name, '.webp'),
      stem: path.basename(name, '.webp'),
      src: `/img/symbols/posters-v1/${name}`,
      sourcePath: path.join(posterDir, name),
    }));
}

function collectGeneratedIllustrations(registry) {
  return Object.entries(registry?.assets || {})
    .map(([symbolId, asset]) => {
      const stem = path.basename(asset.src, path.extname(asset.src));
      return {
        symbolId,
        stem,
        src: asset.src,
        sourcePath: generatedSymbolImagePath(asset),
      };
    })
    .sort((a, b) => a.stem.localeCompare(b.stem));
}

function mergeIllustrations(primary, posters) {
  const byStem = new Map();
  for (const illustration of [...primary, ...posters]) {
    const existing = byStem.get(illustration.stem);
    if (
      existing &&
      existing.symbolId === illustration.symbolId &&
      existing.src === illustration.src
    ) {
      continue;
    }
    if (existing) {
      throw new Error(`Responsive symbol stem collision: ${illustration.stem}`);
    }
    byStem.set(illustration.stem, illustration);
  }
  return [...byStem.values()].sort((a, b) => a.stem.localeCompare(b.stem));
}

function outputPath(illustration, width) {
  return path.join(OUTPUT_DIR, `${illustration.stem}-${width}w.webp`);
}

function assertCompleteSymbolCoverage(illustrations, catalog) {
  const errors = [];
  const catalogIds = new Set((catalog?.symbols || []).map((symbol) => symbol.id));
  const bySymbol = new Map();
  const bySource = new Map();

  for (const illustration of illustrations) {
    if (!catalogIds.has(illustration.symbolId)) {
      errors.push(`${illustration.symbolId}: illustration is not present in the symbol catalog`);
    }
    if (bySymbol.has(illustration.symbolId)) {
      errors.push(`${illustration.symbolId}: more than one dedicated illustration source`);
    }
    bySymbol.set(illustration.symbolId, illustration);

    const existingSymbol = bySource.get(illustration.src);
    if (existingSymbol && existingSymbol !== illustration.symbolId) {
      errors.push(
        `${illustration.symbolId}: shares ${illustration.src} with ${existingSymbol}`
      );
    }
    bySource.set(illustration.src, illustration.symbolId);
  }

  for (const symbol of catalog?.symbols || []) {
    if (!bySymbol.has(symbol.id)) {
      errors.push(`${symbol.id}: missing dedicated illustration source`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid symbol image coverage:\n- ${errors.join('\n- ')}`);
  }
}

async function generateIllustrations(illustrations, { force = false } = {}) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  let generated = 0;
  let total = 0;
  for (const illustration of illustrations) {
    const sourceMtimeMs = fs.statSync(illustration.sourcePath).mtimeMs;
    for (const width of WIDTHS) {
      total += 1;
      const target = outputPath(illustration, width);
      // Only re-encode when the source changed: repeated builds (docs:dev,
      // CI reruns) must not pay for hundreds of sharp encodes for nothing.
      if (
        !force &&
        fs.existsSync(target) &&
        fs.statSync(target).mtimeMs >= sourceMtimeMs
      ) {
        continue;
      }
      await sharp(illustration.sourcePath)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({
          quality: width === WIDTHS[0] ? 78 : 82,
          effort: 5,
          smartSubsample: true,
        })
        .toFile(target);
      generated += 1;
    }
  }
  if (generated < total) {
    console.log(
      `[generate-symbol-responsive-images] ${generated} variants regenerated, ` +
        `${total - generated} up to date.`
    );
  }
}

async function validateIllustrations(illustrations) {
  const errors = [];
  const warnings = [];
  const bytesByWidth = Object.fromEntries(WIDTHS.map((width) => [width, 0]));
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
      bytesByWidth[width] += bytes;
      if (width === WIDTHS[0] && bytes > CARD_MAX_BYTES) {
        errors.push(
          `${illustration.symbolId}: ${width}w card variant is ${bytes} bytes (max ${CARD_MAX_BYTES})`
        );
      } else if (width === 1200 && bytes > MAX_BYTES) {
        errors.push(`${illustration.symbolId}: 1200w variant is ${bytes} bytes (max ${MAX_BYTES})`);
      } else if (width === 1200 && bytes > WARN_BYTES) {
        warnings.push(`${illustration.symbolId}: 1200w variant is ${bytes} bytes`);
      }
    }
  }
  if (errors.length > 0) throw new Error(`Invalid responsive symbol images:\n- ${errors.join('\n- ')}`);
  return { bytesByWidth, warnings };
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const force = process.argv.includes('--force');
  const registry = loadSymbolImageRegistry();
  const editorial = SOURCE_DATA_PATHS
    .filter((sourcePath) => fs.existsSync(sourcePath))
    .flatMap((sourcePath) => collectIllustrations(JSON.parse(fs.readFileSync(sourcePath, 'utf8'))));
  const illustrations = mergeIllustrations(
    editorial,
    collectGeneratedIllustrations(registry)
  );
  assertCompleteSymbolCoverage(
    illustrations,
    JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'))
  );
  if (!checkOnly) await generateIllustrations(illustrations, { force });
  const result = await validateIllustrations(illustrations);
  console.log(
    `Responsive symbol images ${checkOnly ? 'checked' : 'generated'}: ` +
      `${illustrations.length} illustrations, ${illustrations.length * WIDTHS.length} WebP variants ` +
      `(${WIDTHS.map((width) => `${width}w=${result.bytesByWidth[width]} bytes`).join(', ')}).`
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
  assertCompleteSymbolCoverage,
  collectIllustrations,
  collectGeneratedIllustrations,
  collectPosterIllustrations,
  mergeIllustrations,
  outputPath,
  validateIllustrations,
  WIDTHS,
};
