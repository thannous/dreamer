#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ASO_SOURCE,
  FEATURE_SIZE,
  OUTPUT_ROOT,
  SCREENSHOT_LAYOUT,
  SCREENSHOT_SIZE,
  validateBriefAgainstLayout,
} = require('./build-google-play-store-assets');

async function validateDimensions(file, expected, label, errors) {
  if (!fs.existsSync(file)) {
    errors.push(`${label} absent : ${file}`);
    return;
  }
  const metadata = await sharp(file).metadata();
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    errors.push(`${label} doit mesurer ${expected.width}x${expected.height}, reçu ${metadata.width}x${metadata.height}.`);
  }
}

async function checkAssets(outputRoot = OUTPUT_ROOT) {
  const brief = JSON.parse(fs.readFileSync(ASO_SOURCE, 'utf8'));
  const structural = validateBriefAgainstLayout(brief);
  const errors = [...structural.errors];
  const sourceRoot = path.join(outputRoot, 'source');
  const generatedRoot = path.join(outputRoot, 'generated');

  for (let index = 0; index < SCREENSHOT_LAYOUT.length; index += 1) {
    const layout = SCREENSHOT_LAYOUT[index];
    const source = path.join(sourceRoot, layout.filename);
    if (!fs.existsSync(source)) errors.push(`Source ${index + 1}/7 absente : ${source}`);
    await validateDimensions(
      path.join(generatedRoot, layout.filename),
      SCREENSHOT_SIZE,
      `Capture ${index + 1}/7`,
      errors
    );
  }
  await validateDimensions(
    path.join(generatedRoot, 'feature-graphic-fr.png'),
    FEATURE_SIZE,
    'Visuel promotionnel',
    errors
  );

  return { valid: errors.length === 0, errors };
}

async function main() {
  const result = await checkAssets();
  console.log(`Assets Google Play FR : ${result.valid ? '7/7 VALIDES' : 'INVALIDES'}`);
  result.errors.forEach((error) => console.error(`- ${error}`));
  if (!result.valid) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { checkAssets };
