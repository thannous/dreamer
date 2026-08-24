#!/usr/bin/env node
/* global __dirname */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT_DIR = path.resolve(__dirname, '..');
const ASO_SOURCE = path.join(ROOT_DIR, 'marketing', 'aso', 'google-play-fr-2026-08-09.json');
const OUTPUT_ROOT = path.join(ROOT_DIR, 'output', 'google-play', 'fr-FR');
const SCREENSHOT_SIZE = Object.freeze({ width: 1080, height: 1920 });
const FEATURE_SIZE = Object.freeze({ width: 1024, height: 500 });
const SCREENSHOT_LAYOUT = Object.freeze([
  { surface: 'journal', filename: '01-journal.png', crop: { top: 90, bottom: 650 } },
  { surface: 'patterns', filename: '02-patterns.png', crop: { top: 90, bottom: 650 } },
  { surface: 'emotions', filename: '03-emotions.png', crop: { top: 90, bottom: 650 } },
  { surface: 'dream-detail', filename: '04-dream-detail.png', crop: { top: 90, bottom: 90 } },
  { surface: 'dream-art', filename: '05-dream-art.png', crop: { top: 90, bottom: 90 } },
  { surface: 'reflection', filename: '06-reflection.png', crop: { top: 90, bottom: 550 } },
  { surface: 'capture', filename: '07-capture.png', crop: { top: 90, bottom: 650 } },
]);

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapCaption(caption, maxCharacters = 26) {
  const lines = [];
  let current = '';

  String(caption)
    .split(/\s+/)
    .forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (current && candidate.length > maxCharacters) {
        lines.push(current);
        current = word;
      } else current = candidate;
    });
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function validateBriefAgainstLayout(brief) {
  const errors = [];
  const screenshots = Array.isArray(brief?.screenshot_brief) ? brief.screenshot_brief : [];
  if (screenshots.length !== SCREENSHOT_LAYOUT.length) {
    errors.push(`Le brief doit contenir ${SCREENSHOT_LAYOUT.length} captures.`);
  }
  SCREENSHOT_LAYOUT.forEach((layout, index) => {
    const shot = screenshots[index];
    if (!shot) return;
    if (shot.order !== index + 1) errors.push(`Ordre invalide pour la capture ${index + 1}.`);
    if (shot.surface !== layout.surface) errors.push(`Surface invalide pour la capture ${index + 1}.`);
    if (!shot.caption) errors.push(`Accroche absente pour la capture ${index + 1}.`);
  });
  return { valid: errors.length === 0, errors };
}

function screenshotBackground(shot) {
  const text = wrapCaption(shot.caption)
    .map((line, index) => `<text x="90" y="${205 + index * 72}" class="headline">${escapeXml(line)}</text>`)
    .join('');

  return Buffer.from(`
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#070711"/>
          <stop offset="0.58" stop-color="#111027"/>
          <stop offset="1" stop-color="#1b294d"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#ground)"/>
      <circle cx="963" cy="155" r="276" fill="none" stroke="#d9aa72" stroke-opacity="0.16" stroke-width="2"/>
      <circle cx="963" cy="155" r="208" fill="#d9aa72" fill-opacity="0.025"/>
      <path d="M-90 1710 C260 1470 620 1950 1150 1630" fill="none" stroke="#a9a0c7" stroke-opacity="0.09" stroke-width="2"/>
      <text x="90" y="94" class="eyebrow">NOCTALIA  •  JOURNAL DE RÊVES</text>
      ${text}
      <rect x="89" y="433" width="902" height="1412" rx="54" fill="#05050d" stroke="#d9aa72" stroke-opacity="0.52" stroke-width="2"/>
      <text x="947" y="1875" class="number">${String(shot.order).padStart(2, '0')} / 07</text>
      <style>
        .eyebrow { fill: #d9aa72; font: 600 24px Arial, sans-serif; letter-spacing: 4px; }
        .headline { fill: #f6f0e6; font: 700 59px Georgia, serif; }
        .number { fill: #aaa1c3; font: 500 20px Arial, sans-serif; text-anchor: end; letter-spacing: 2px; }
      </style>
    </svg>`);
}

async function prepareScreenshot(source, crop) {
  const image = sharp(source);
  const metadata = await image.metadata();
  const top = crop?.top || 0;
  const bottom = crop?.bottom || 0;
  const height = metadata.height - top - bottom;
  if (!metadata.width || !metadata.height || height <= 0) {
    throw new Error(`Recadrage invalide pour ${source}.`);
  }

  const mask = Buffer.from('<svg width="860" height="1370"><rect width="860" height="1370" rx="38" fill="white"/></svg>');
  return image
    .extract({ left: 0, top, width: metadata.width, height })
    .resize({ width: 860, height: 1370, fit: 'cover', position: 'top' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function buildScreenshot(shot, layout, sourceRoot, generatedRoot) {
  const source = path.join(sourceRoot, layout.filename);
  const output = path.join(generatedRoot, layout.filename);
  if (!fs.existsSync(source)) throw new Error(`Source locale absente : ${source}`);
  const appScreenshot = await prepareScreenshot(source, layout.crop);
  await sharp(screenshotBackground(shot))
    .composite([{ input: appScreenshot, left: 110, top: 454 }])
    .png({ compressionLevel: 9 })
    .toFile(output);
  return output;
}

function featureGraphicSvg() {
  return Buffer.from(`
    <svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#070711"/>
          <stop offset="0.62" stop-color="#15132e"/>
          <stop offset="1" stop-color="#20345d"/>
        </linearGradient>
        <radialGradient id="glow">
          <stop offset="0" stop-color="#d9aa72" stop-opacity="0.2"/>
          <stop offset="1" stop-color="#d9aa72" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1024" height="500" fill="url(#ground)"/>
      <circle cx="830" cy="215" r="235" fill="url(#glow)"/>
      <circle cx="846" cy="201" r="128" fill="#f6f0e6"/>
      <circle cx="900" cy="156" r="128" fill="#171831"/>
      <circle cx="762" cy="111" r="5" fill="#d9aa72"/>
      <circle cx="947" cy="323" r="4" fill="#f6f0e6" fill-opacity="0.8"/>
      <path d="M719 363 C799 330 886 330 963 363" fill="none" stroke="#d9aa72" stroke-opacity="0.55" stroke-width="2"/>
      <text x="72" y="92" class="brand">NOCTALIA</text>
      <text x="72" y="205" class="headline">Ton journal de rêves</text>
      <text x="72" y="276" class="headline">vivant</text>
      <text x="74" y="350" class="subhead">Symboles • émotions • motifs</text>
      <line x1="74" y1="386" x2="508" y2="386" stroke="#d9aa72" stroke-width="3"/>
      <style>
        .brand { fill: #d9aa72; font: 600 25px Arial, sans-serif; letter-spacing: 6px; }
        .headline { fill: #f6f0e6; font: 700 58px Georgia, serif; }
        .subhead { fill: #c5bdd8; font: 400 25px Arial, sans-serif; letter-spacing: 1px; }
      </style>
    </svg>`);
}

async function buildAssets(outputRoot = OUTPUT_ROOT) {
  const brief = JSON.parse(fs.readFileSync(ASO_SOURCE, 'utf8'));
  const validation = validateBriefAgainstLayout(brief);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));

  const sourceRoot = path.join(outputRoot, 'source');
  const generatedRoot = path.join(outputRoot, 'generated');
  fs.mkdirSync(generatedRoot, { recursive: true });
  const outputs = [];
  for (let index = 0; index < SCREENSHOT_LAYOUT.length; index += 1) {
    outputs.push(
      await buildScreenshot(brief.screenshot_brief[index], SCREENSHOT_LAYOUT[index], sourceRoot, generatedRoot)
    );
  }
  const featureGraphic = path.join(generatedRoot, 'feature-graphic-fr.png');
  await sharp(featureGraphicSvg()).png({ compressionLevel: 9 }).toFile(featureGraphic);
  outputs.push(featureGraphic);
  return outputs;
}

async function main() {
  const outputs = await buildAssets();
  console.log(`Assets Google Play générés hors Git : ${outputs.length - 1}/7 captures + visuel promotionnel.`);
  console.log(path.relative(ROOT_DIR, path.dirname(outputs[0])));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  ASO_SOURCE,
  FEATURE_SIZE,
  OUTPUT_ROOT,
  SCREENSHOT_LAYOUT,
  SCREENSHOT_SIZE,
  buildAssets,
  escapeXml,
  validateBriefAgainstLayout,
  wrapCaption,
};
