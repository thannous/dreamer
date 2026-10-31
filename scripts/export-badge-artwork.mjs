#!/usr/bin/env node
/**
 * Exports the badge family illustrations for the app.
 *
 * Sources: the original transparent PNGs listed in assets/images/badges/catalogue.json,
 * kept untouched. A painting marked `"inApp": false` is no longer shown by the app and is
 * not exported. Outputs: assets/images/badges/app/<family-id>.webp for a card held in
 * the hand (up to about 230 pt wide at 3x), served from media.noctalia.app (see
 * `npm run docs:media -- app-inventory`), and <family-id>-small.webp, bundled for the
 * album grid, the tier row and as the stand-in while the full painting loads.
 *
 * The painted disc of the sources sits at alpha 252-253, not 255: noise that lossless
 * alpha would pay for. It is snapped to opaque (and near-zero to clear) before encoding;
 * the anti-aliased edge between them is kept as painted.
 *
 *   node scripts/export-badge-artwork.mjs          write exports older than their source
 *   node scripts/export-badge-artwork.mjs --force  rewrite every export
 *   node scripts/export-badge-artwork.mjs --check  fail when an export is missing
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'assets/images/badges');
const OUTPUT_DIR = path.join(SOURCE_DIR, 'app');
const SIZES = [
  { suffix: '', width: 720 },
  { suffix: '-small', width: 320 },
];
const WEBP = { quality: 88, alphaQuality: 100, effort: 6, smartSubsample: true };
const OPAQUE_FROM = 248;
const CLEAR_TO = 3;

/** The resized painting with its alpha noise snapped, encoded as WebP. */
export async function encodeBadge(source, width) {
  const { data, info } = await sharp(source).resize({ width, height: width, fit: 'contain' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] >= OPAQUE_FROM) data[index] = 255;
    else if (data[index] <= CLEAR_TO) data[index] = 0;
  }
  // sharp reports this raw buffer as premultiplied although its pixels are straight: passing
  // `info` back would un-premultiply them and halo the edges. Describe the pixels instead.
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp(WEBP).toBuffer();
}

async function main() {
  const catalogue = JSON.parse(readFileSync(path.join(SOURCE_DIR, 'catalogue.json'), 'utf8'));
  const check = process.argv.includes('--check');
  const force = process.argv.includes('--force');
  const problems = [];
  let written = 0;

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const exported = catalogue.families.filter((family) => family.inApp !== false);
  for (const family of exported) {
    const source = path.join(ROOT, family.asset);
    if (!existsSync(source)) {
      problems.push(`${family.id}: missing source ${family.asset}`);
      continue;
    }
    for (const { suffix, width } of SIZES) {
      const output = path.join(OUTPUT_DIR, `${family.id}${suffix}.webp`);
      if (check) {
        if (!existsSync(output)) problems.push(`${family.id}: missing ${path.relative(ROOT, output)}`);
        continue;
      }
      if (!force && existsSync(output) && statSync(output).mtimeMs >= statSync(source).mtimeMs) continue;
      writeFileSync(output, await encodeBadge(source, width));
      written += 1;
    }
  }

  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(check ? `Badge artwork exports present for ${exported.length} paintings.` : `Wrote ${written} badge artwork exports.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
