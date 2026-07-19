#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { ROOT_DIR } = require('./lib/docs-site-config');
const { inlineLucideIcons } = require('./lib/lucide-inline');
const {
  generatedSymbolImagePath,
  getGeneratedSymbolImage,
  loadSymbolImageRegistry,
} = require('./lib/symbol-image-assets');

const CATALOG_PATH = path.join(ROOT_DIR, 'data', 'dream-symbols.json');
const PRIMARY_EXTENDED_PATH = path.join(
  ROOT_DIR,
  'docs-src',
  'static',
  'data',
  'dream-symbols-extended.json'
);
const TIER3_EXTENDED_PATH = path.join(
  ROOT_DIR,
  'docs-src',
  'static',
  'data',
  'dream-symbols-extended-tier3.json'
);
const STATIC_DIR = path.join(ROOT_DIR, 'docs-src', 'static');
const THUMBNAIL_DIR = path.join(STATIC_DIR, 'img', 'symbols', 'generated');
const OUTPUT_DIR = path.join(STATIC_DIR, 'img', 'symbols', 'posters-v1');
const WIDTH = 1200;
const HEIGHT = 675;

const CATEGORY_ICONS = {
  actions: 'zap',
  animals: 'paw-print',
  body: 'person-standing',
  celestial: 'moon-star',
  nature: 'leaf',
  objects: 'box',
  people: 'users',
  places: 'map-pin',
};

const SYMBOL_ICONS = {
  abandonment: 'heart-crack',
  accident: 'triangle-alert',
  angel: 'feather',
  apocalypse: 'flame',
  arguing: 'messages-square',
  baby: 'baby',
  bird: 'bird',
  blood: 'droplets',
  clothes: 'shirt',
  crying: 'frown',
  'deceased-person': 'skull',
  horse: 'paw-print',
  lion: 'paw-print',
  lost: 'signpost',
  money: 'coins',
  mountain: 'mountain',
  night: 'moon-star',
  nudity: 'person-standing',
  path: 'route',
  phone: 'phone',
  plane: 'plane',
  pregnancy: 'baby',
  rainbow: 'rainbow',
  sun: 'sun',
  swimming: 'waves',
  train: 'train-front',
  wedding: 'gem',
};

const CATEGORY_PALETTES = {
  actions: ['#321154', '#8f3f70'],
  animals: ['#171145', '#5b386f'],
  body: ['#2b123f', '#86485c'],
  celestial: ['#0d1745', '#5c3f8f'],
  nature: ['#101c46', '#32606c'],
  objects: ['#241341', '#604579'],
  people: ['#32113f', '#8a455f'],
  places: ['#11183f', '#4d446f'],
};

const POSTER_SOURCE_OVERRIDES = {
  abandonment: { src: '/img/symbols/generated/ex-partner.webp', mode: 'full' },
  accident: { src: '/img/symbols/generated/car.webp', mode: 'full' },
  apocalypse: { src: '/img/symbols/generated/storm.webp', mode: 'full' },
  baby: { src: '/img/symbols/generated/child.webp', mode: 'full' },
  bird: { src: '/img/symbols/generated/flying.webp', mode: 'full' },
  blood: { src: '/img/symbols/generated/death.webp', mode: 'full' },
  clothes: { src: '/img/symbols/generated/mirror.webp', mode: 'full' },
  crying: { src: '/img/symbols/generated/rain.webp', mode: 'full' },
  'deceased-person': { src: '/img/symbols/generated/death.webp', mode: 'full' },
  lost: { src: '/img/symbols/generated/forest.webp', mode: 'full' },
  mountain: { src: '/img/symbols/generated/cliff.webp', mode: 'full' },
  night: { src: '/img/symbols/generated/moon.webp', mode: 'full' },
  nudity: { src: '/img/symbols/generated/mirror.webp', mode: 'full' },
  path: { src: '/img/symbols/generated/forest.webp', mode: 'full' },
  plane: { src: '/img/symbols/generated/airport.webp', mode: 'card' },
  pregnancy: { src: '/img/blog/pregnancy-dreams-meaning.webp', mode: 'full' },
  swimming: { src: '/img/symbols/plan-a/water-dream-it.jpg', mode: 'full' },
  train: { src: '/img/symbols/generated/missing-train.webp', mode: 'card' },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getLocalizedSymbolContent(extended, symbolId) {
  return extended?.symbols?.[symbolId] || extended?.[symbolId] || null;
}

function hasEditorialIllustration(symbolId, primary, tier3) {
  const localized =
    getLocalizedSymbolContent(primary, symbolId) ||
    getLocalizedSymbolContent(tier3, symbolId);
  return Object.values(localized || {}).some((value) => Boolean(value?.illustration?.src));
}

function resolvePosterIcon(symbol) {
  return SYMBOL_ICONS[symbol.id] || CATEGORY_ICONS[symbol.category] || 'sparkles';
}

function resolvePosterSource(symbolId) {
  const override = POSTER_SOURCE_OVERRIDES[symbolId];
  if (override) {
    const sourcePath = path.join(STATIC_DIR, override.src.replace(/^\/+/, ''));
    if (fs.existsSync(sourcePath)) return { sourcePath, mode: override.mode };
  }

  const sourcePath = path.join(THUMBNAIL_DIR, `${symbolId}.webp`);
  return fs.existsSync(sourcePath) ? { sourcePath, mode: 'card' } : null;
}

function seededPoints(symbolId, count = 28) {
  const digest = crypto.createHash('sha256').update(symbolId).digest();
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const offset = (index * 3) % digest.length;
    points.push({
      x: 36 + ((digest[offset] * 43 + index * 97) % (WIDTH - 72)),
      y: 28 + ((digest[(offset + 1) % digest.length] * 29 + index * 53) % (HEIGHT - 56)),
      radius: 1 + (digest[(offset + 2) % digest.length] % 3),
      opacity: 0.18 + (digest[offset] % 45) / 100,
    });
  }
  return points;
}

function renderAtmosphere(symbol) {
  const palette = CATEGORY_PALETTES[symbol.category] || CATEGORY_PALETTES.celestial;
  const stars = seededPoints(symbol.id)
    .map(
      ({ x, y, radius, opacity }) =>
        `<circle cx="${x}" cy="${y}" r="${radius}" fill="#ffe8dc" opacity="${opacity.toFixed(2)}"/>`
    )
    .join('');

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${palette[0]}"/>
        <stop offset="1" stop-color="${palette[1]}"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="42%" r="54%">
        <stop offset="0" stop-color="#fda481" stop-opacity=".34"/>
        <stop offset=".46" stop-color="#b99cff" stop-opacity=".14"/>
        <stop offset="1" stop-color="#08030f" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#08030f" stop-opacity=".08"/>
        <stop offset="1" stop-color="#08030f" stop-opacity=".78"/>
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <ellipse cx="600" cy="300" rx="520" ry="350" fill="url(#glow)"/>
    ${stars}
    <path d="M0 545 C210 475 365 610 570 535 C780 458 968 595 1200 505 L1200 675 L0 675 Z" fill="#08030f" opacity=".24"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#shade)"/>
  </svg>`);
}

function renderVignetteOverlay() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <defs>
      <radialGradient id="v" cx="50%" cy="42%" r="72%">
        <stop offset="45%" stop-color="#08030f" stop-opacity="0"/>
        <stop offset="100%" stop-color="#08030f" stop-opacity=".68"/>
      </radialGradient>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="48%" stop-color="#08030f" stop-opacity="0"/>
        <stop offset="100%" stop-color="#08030f" stop-opacity=".78"/>
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#v)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bottom)"/>
  </svg>`);
}

function renderFrame() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="304" height="304">
    <rect x="2" y="2" width="300" height="300" rx="54" fill="none" stroke="#fda481" stroke-opacity=".5" stroke-width="4"/>
    <rect x="9" y="9" width="286" height="286" rx="48" fill="none" stroke="#ffffff" stroke-opacity=".12" stroke-width="2"/>
  </svg>`);
}

function renderRoundedMask(size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="48" fill="#fff"/>
  </svg>`);
}

function renderIcon(symbol) {
  return Buffer.from(
    inlineLucideIcons(
      `<i data-lucide="${resolvePosterIcon(symbol)}" width="236" height="236" stroke="#ffd2bd" stroke-width="1.35"></i>`
    )
  );
}

async function renderPoster(symbol, source, outputPath) {
  const atmosphere = renderAtmosphere(symbol);
  const composites = [];

  if (source?.mode === 'full') {
    const fullBleed = await sharp(source.sourcePath)
      .resize(WIDTH, HEIGHT, { fit: 'cover' })
      .modulate({ brightness: 0.84, saturation: 1.06 })
      .toBuffer();
    composites.push({ input: fullBleed, blend: 'over' });
  } else if (source?.mode === 'card') {
    const blurred = await sharp(source.sourcePath)
      .resize(WIDTH, HEIGHT, { fit: 'cover' })
      .blur(30)
      .modulate({ brightness: 0.56, saturation: 1.18 })
      .toBuffer();
    const foreground = await sharp(source.sourcePath)
      .resize(300, 300, { fit: 'cover' })
      .sharpen()
      .composite([{ input: renderRoundedMask(300), blend: 'dest-in' }])
      .png()
      .toBuffer();
    composites.push({ input: blurred, blend: 'over' });
    composites.push({ input: atmosphere, blend: 'screen' });
    composites.push({ input: foreground, left: 450, top: 142 });
    composites.push({ input: renderFrame(), left: 448, top: 140 });
  } else {
    composites.push({ input: renderIcon(symbol), left: 482, top: 184 });
  }

  composites.push({ input: renderVignetteOverlay() });

  await sharp(atmosphere)
    .composite(composites)
    .webp({ quality: 86, effort: 5, smartSubsample: true })
    .toFile(outputPath);
}

async function generatePosters({ checkOnly = false } = {}) {
  const catalog = readJson(CATALOG_PATH);
  const primary = readJson(PRIMARY_EXTENDED_PATH);
  const tier3 = readJson(TIER3_EXTENDED_PATH);
  const registry = loadSymbolImageRegistry();
  const expected = [];
  const errors = [];

  if (!checkOnly) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const symbol of catalog.symbols || []) {
    if (hasEditorialIllustration(symbol.id, primary, tier3)) continue;
    const generatedAsset = getGeneratedSymbolImage(symbol.id, registry);
    if (generatedAsset) {
      const generatedPath = generatedSymbolImagePath(generatedAsset);
      if (!generatedPath || !fs.existsSync(generatedPath)) {
        errors.push(`${symbol.id}: missing generated source ${generatedAsset.src || '(empty)'}`);
      } else {
        const metadata = await sharp(generatedPath).metadata();
        if (
          metadata.width !== Number(generatedAsset.width) ||
          metadata.height !== Number(generatedAsset.height) ||
          metadata.format !== 'webp'
        ) {
          errors.push(
            `${symbol.id}: generated source metadata does not match registry ` +
              `(${metadata.width}x${metadata.height} ${metadata.format})`
          );
        }
      }
      continue;
    }
    if (registry.version) {
      errors.push(`${symbol.id}: missing dedicated image in symbol-image-assets.json`);
      continue;
    }
    const outputPath = path.join(OUTPUT_DIR, `${symbol.id}.webp`);
    const source = resolvePosterSource(symbol.id);
    expected.push({ symbol, outputPath, source });
    if (!checkOnly) await renderPoster(symbol, source, outputPath);
  }

  for (const { symbol, outputPath } of expected) {
    if (!fs.existsSync(outputPath)) {
      errors.push(`${symbol.id}: missing ${path.relative(ROOT_DIR, outputPath)}`);
      continue;
    }
    const metadata = await sharp(outputPath).metadata();
    if (metadata.width !== WIDTH || metadata.height !== HEIGHT || metadata.format !== 'webp') {
      errors.push(
        `${symbol.id}: expected ${WIDTH}x${HEIGHT} WebP, got ${metadata.width}x${metadata.height} ${metadata.format}`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid symbol hero posters:\n- ${errors.join('\n- ')}`);
  }

  return {
    totalSymbols: (catalog.symbols || []).length,
    posterCount: expected.length,
    artworkCount: expected.filter((entry) => Boolean(entry.source)).length,
    iconCount: expected.filter((entry) => !entry.source).length,
  };
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const result = await generatePosters({ checkOnly });
  console.log(
    `Symbol hero posters ${checkOnly ? 'checked' : 'generated'}: ` +
      `${result.posterCount} fallbacks (${result.artworkCount} artwork, ${result.iconCount} vector), ` +
      `${result.totalSymbols} total symbols.`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  generatePosters,
  hasEditorialIllustration,
  resolvePosterSource,
  resolvePosterIcon,
};
