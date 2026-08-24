#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  DEFAULT_LOCALE,
  FEATURE_SIZE,
  OUTPUT_ROOT,
  SCREENSHOT_LAYOUT,
  SCREENSHOT_SIZE,
  validateBriefAgainstLayout,
  parseArgs,
  resolveLocaleConfig,
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
  if (metadata.hasAlpha) {
    errors.push(`${label} ne doit pas contenir de canal alpha.`);
  }
}

async function checkAssets(outputRoot = OUTPUT_ROOT, locale = DEFAULT_LOCALE) {
  const localeConfig = resolveLocaleConfig(locale);
  const brief = JSON.parse(fs.readFileSync(localeConfig.asoSource, 'utf8'));
  const structural = validateBriefAgainstLayout(brief);
  const errors = [...structural.errors];
  const sourceRoot = path.join(outputRoot, 'source');
  const generatedRoot = path.join(outputRoot, 'generated');

  for (let index = 0; index < SCREENSHOT_LAYOUT.length; index += 1) {
    const layout = SCREENSHOT_LAYOUT[index];
    const source = path.join(sourceRoot, layout.source);
    if (!fs.existsSync(source)) errors.push(`Source ${index + 1}/7 absente : ${source}`);
    await validateDimensions(
      path.join(generatedRoot, layout.filename),
      SCREENSHOT_SIZE,
      `Capture ${index + 1}/7`,
      errors
    );
  }
  await validateDimensions(
    path.join(generatedRoot, localeConfig.featureFilename),
    FEATURE_SIZE,
    'Visuel promotionnel',
    errors
  );

  return { valid: errors.length === 0, errors };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: npm run aso:google-play:assets:check -- [--locale fr-FR|en-US]');
    return;
  }
  const localeConfig = resolveLocaleConfig(args.locale);
  const result = await checkAssets(localeConfig.outputRoot, args.locale);
  console.log(`Assets Google Play ${args.locale} : ${result.valid ? '7/7 VALIDES' : 'INVALIDES'}`);
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
