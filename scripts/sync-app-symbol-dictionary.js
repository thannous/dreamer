#!/usr/bin/env node
'use strict';

/**
 * Writes the app's copy of the symbol dictionary with only the fields the app reads.
 *
 * `data/dream-symbols*.json` also feed the marketing site, which needs the FAQ, SEO
 * titles, meta descriptions and illustration records (about 1.2 MB of the 6 MB the
 * app used to bundle). The app bundles `data/app/dream-symbols.json`, an index with
 * each symbol's category, priority, related symbols and names. The short descriptions
 * and questions are one bundled asset per language, `data/app/symbol-content/<lang>.txt`
 * (JSON under an asset extension, so Metro copies it instead of compiling it into the
 * JavaScript bundle), read on first use by services/symbolContent.ts. The extended
 * file is bundled on web only, and the native app downloads the same content per
 * language from the site (see buildSymbolContentByLanguage). The atlas (living paintings
 * and painted scenes of the symbols that have them) is read the same way, from
 * data/app/symbol-atlas.json on web and from the site on native (see buildSymbolAtlas).
 * The app's symbol guides are the site's featured curation pages, without their slugs
 * (data/app/dream-guides.json, see buildAppGuides).
 * Re-run after editing the dictionary sources or the atlas config:
 *
 *   npm run symbols:dictionary:sync            # write data/app/ and the analysis symbol ids
 *   npm run symbols:dictionary:sync -- --check # fail if either is stale
 */

const fs = require('fs');
const path = require('path');

const { ATLAS_SIX_IMAGES, atlasSixBox, atlasSixLayerSrc } = require('./lib/atlas-motion');
const { catalogKey } = require('./lib/symbol-locales');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'app');
const LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt'];
const CONTENT_DIR = path.join(OUT_DIR, 'symbol-content');
const OUTPUTS = {
  symbols: path.join(OUT_DIR, 'dream-symbols.json'),
  guides: path.join(OUT_DIR, 'dream-guides.json'),
  ...Object.fromEntries(LANGUAGES.map((language) => [`content:${language}`, path.join(CONTENT_DIR, `${language}.txt`)])),
  extended: path.join(OUT_DIR, 'dream-symbols-extended.json'),
  atlas: path.join(OUT_DIR, 'symbol-atlas.json'),
  // The analysis links each symbol it names to one of these ids (supabase/functions).
  symbolIds: path.join(ROOT, 'supabase', 'functions', 'api', 'lib', 'dreamSymbolIds.ts'),
};

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

// Mirrors DreamSymbol / SymbolContent / ExtendedSymbolContent in lib/symbolTypes.ts.
const pickContent = ({ shortDescription, askYourself }) => ({ shortDescription, askYourself });

const pickExtended = ({ fullInterpretation, variations }) => ({ fullInterpretation, variations });

// id -> language -> { fullInterpretation, variations }. The tier-3 file only fills
// languages the main extended file lacks.
function buildExtendedMap() {
  const layers = [readJson('data/dream-symbols-extended.json').symbols, readJson('data/dream-symbols-extended-tier3.json')];
  const extended = {};
  for (const layer of layers) {
    for (const [id, locales] of Object.entries(layer)) {
      for (const [language, content] of Object.entries(locales)) {
        if (!LANGUAGES.includes(language) || extended[id]?.[language]) continue;
        extended[id] = { ...extended[id], [language]: pickExtended(content) };
      }
    }
  }
  return extended;
}

/**
 * One id -> content file per language. The marketing site publishes these under
 * /content/symbols/ and the native app downloads the reader's language on first
 * use (services/symbolExtendedContent.ts) instead of bundling all six.
 */
function buildSymbolContentByLanguage() {
  const extended = buildExtendedMap();
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const content = {};
      for (const [id, locales] of Object.entries(extended)) {
        if (locales[language]) content[id] = locales[language];
      }
      return [language, `${JSON.stringify(content)}\n`];
    }),
  );
}

// The site's own matching of a scene to its variation card (generate-symbol-pages.js).
const plainContext = (html) =>
  String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/[ \t\r\n\f\v]+/g, ' ')
    .replace(/[  ]/g, ' ')
    .trim();

/**
 * The atlas as the app reads it (lib/symbolAtlas.ts): per symbol with its paintings, the
 * portrait painting the detail opens on and its two textures, then its three painted
 * scenes, each with its two textures and the context of the variation card it paints in
 * every language. Files are named relative to `<base>/<id>/`; a texture's box is already
 * placed on its painting by the site's own geometry (lib/atlas-motion.js), so the app
 * never recomputes it. The site's motion runs in a loop; the app plays it for a few
 * seconds, flow copies included, then rests (components/symbols/LivingPainting.tsx). A
 * symbol still waiting for its paintings, or a scene for its own, is skipped.
 */
function buildSymbolAtlas(extended = buildExtendedMap()) {
  const pilots = readJson('docs-src/config/symbol-atlas-pilots.json');
  const assets = readJson('docs-src/config/symbol-atlas-six-assets.json');
  const locales = readJson('docs-src/config/symbol-atlas-locales.json').symbols;

  const symbols = {};
  for (const [id, pilot] of Object.entries(pilots)) {
    const files = assets[id];
    if (!files?.portrait || !files.layer || !files.accent) continue;
    const prefix = `${ATLAS_SIX_IMAGES}/${id}/`;
    const fileName = (url) => {
      if (!url.startsWith(prefix)) throw new Error(`Atlas ${id}: ${url} is not under ${prefix}`);
      return url.slice(prefix.length);
    };
    const picture = (asset) => ({
      width: asset.width,
      height: asset.height,
      files: Object.fromEntries(Object.entries(asset.webp).map(([width, url]) => [width, fileName(url)])),
    });
    const layers = (effects, painting) =>
      effects.map(({ texture, place, motion, move, dur, op, blend, copies }) => ({
        file: fileName(atlasSixLayerSrc(files[texture], 960)),
        box: atlasSixBox(place, painting, files[texture]),
        motion,
        ...(move ? { move } : {}),
        dur,
        op,
        ...(blend ? { blend } : {}),
        ...(motion === 'flow' && copies > 1 ? { copies } : {}),
      }));

    const scenes = pilot.scenes
      .filter((scene) => files[`scene-${scene.id}`])
      .map((scene) => {
        const image = files[`scene-${scene.id}`];
        const variation = {};
        for (const [locale, entry] of Object.entries(locales[id] || {})) {
          const language = catalogKey(locale);
          const context = entry.scenes?.[scene.id]?.variation;
          if (!LANGUAGES.includes(language) || !context) continue;
          const card = (extended[id]?.[language]?.variations || []).find(
            (candidate) => plainContext(candidate.context) === context,
          );
          if (!card) throw new Error(`Atlas ${id}.${scene.id}: no ${language} variation "${context}"`);
          // The card's own spelling, so the app finds it in whatever copy of the content it holds.
          variation[language] = card.context;
        }
        // A scene may have its own motion; the others move as the thumbnails do on the site.
        const effects = pilot.motion.scenes?.[scene.id] ?? pilot.motion.thumb;
        return { id: scene.id, image: picture(image), layers: layers(effects, image), variation };
      });

    symbols[id] = {
      portrait: { ...picture(files.portrait), position: pilot.portraitPosition },
      layers: layers(pilot.motion.hero.portrait, files.portrait),
      scenes,
    };
  }
  return { version: 1, base: ATLAS_SIX_IMAGES, symbols };
}

/**
 * The symbol guides the app shows (services/dreamGuideService.ts): the site's featured
 * guides, in the same order, with only the fields the app reads.
 */
function buildAppGuides() {
  const featured = readJson('docs-src/config/site.config.json').seoLinking.featuredGuideEntries;
  const pages = new Map(readJson('docs-src/static/data/curation-pages.json').pages.map((page) => [page.id, page]));
  return {
    pages: featured.map((entry) => {
      const id = entry.replace(/^guide\./, '');
      const page = pages.get(id);
      if (!page) throw new Error(`Featured guide ${id} is missing from docs-src/static/data/curation-pages.json`);
      return {
        id,
        symbols: page.symbols,
        ...Object.fromEntries(LANGUAGES.map((language) => {
          const { title, metaDescription, intro, outro } = page[language];
          return [language, { title, metaDescription, intro, outro }];
        })),
      };
    }),
  };
}

function buildSymbolIdsModule(ids) {
  return [
    '// Generated by scripts/sync-app-symbol-dictionary.js from data/dream-symbols.json. Do not edit by hand.',
    '// The ids of the symbol dictionary, which the analysis may link a dream\'s symbols to.',
    `export const DREAM_SYMBOL_IDS: readonly string[] = ${JSON.stringify(ids)};`,
    '',
  ].join('\n');
}

function buildAppDictionary() {
  const source = readJson('data/dream-symbols.json');
  const symbols = {
    categories: source.categories,
    symbols: source.symbols.map((symbol) => ({
      id: symbol.id,
      category: symbol.category,
      priority: symbol.priority,
      names: Object.fromEntries(LANGUAGES.map((language) => [language, symbol[language].name])),
      relatedSymbols: symbol.relatedSymbols,
    })),
  };
  const content = Object.fromEntries(LANGUAGES.map((language) => [
    `content:${language}`,
    `${JSON.stringify(Object.fromEntries(source.symbols.map((symbol) => [symbol.id, pickContent(symbol[language])])))}\n`,
  ]));

  const extended = buildExtendedMap();
  return {
    symbols: `${JSON.stringify(symbols)}\n`,
    guides: `${JSON.stringify(buildAppGuides())}\n`,
    ...content,
    extended: `${JSON.stringify(extended)}\n`,
    atlas: `${JSON.stringify(buildSymbolAtlas(extended))}\n`,
    symbolIds: buildSymbolIdsModule(source.symbols.map((symbol) => symbol.id)),
  };
}

function main() {
  const built = buildAppDictionary();
  const stale = Object.keys(OUTPUTS).filter(
    (key) => !fs.existsSync(OUTPUTS[key]) || fs.readFileSync(OUTPUTS[key], 'utf8') !== built[key],
  );

  if (process.argv.includes('--check')) {
    if (stale.length) {
      console.error('The app copy of the symbol dictionary is stale. Run npm run symbols:dictionary:sync.');
      process.exit(1);
    }
    console.log('App symbol dictionary up to date.');
    return;
  }

  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  for (const key of Object.keys(OUTPUTS)) fs.writeFileSync(OUTPUTS[key], built[key]);
  console.log(`Wrote ${Object.values(OUTPUTS).map((file) => path.relative(ROOT, file)).join(', ')}.`);
}

if (require.main === module) main();

module.exports = { buildAppDictionary, buildSymbolAtlas, buildSymbolContentByLanguage, LANGUAGES, OUTPUTS };
