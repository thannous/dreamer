#!/usr/bin/env node
/**
 * Exports the badge family illustrations for the app.
 *
 * Sources: the original transparent PNGs listed in assets/images/badges/catalogue.json,
 * kept untouched. Outputs: assets/images/badges/app/<family-id>.webp for a card held in
 * the hand (up to about 230 pt wide at 3x) and <family-id>-small.webp for the album grid
 * and the tier row, both keeping the alpha channel at full quality.
 *
 *   node scripts/export-badge-artwork.mjs          write the exports
 *   node scripts/export-badge-artwork.mjs --check  fail when an export is missing
 */
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
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

const catalogue = JSON.parse(readFileSync(path.join(SOURCE_DIR, 'catalogue.json'), 'utf8'));
const check = process.argv.includes('--check');
const problems = [];
let written = 0;

mkdirSync(OUTPUT_DIR, { recursive: true });
for (const family of catalogue.families) {
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
    if (existsSync(output) && statSync(output).mtimeMs >= statSync(source).mtimeMs) continue;
    await sharp(source).resize({ width, height: width, fit: 'contain' }).webp(WEBP).toFile(output);
    written += 1;
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(check ? `Badge artwork exports present for ${catalogue.families.length} families.` : `Wrote ${written} badge artwork exports.`);
