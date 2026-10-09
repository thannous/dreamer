#!/usr/bin/env node
'use strict';

/**
 * Writes the app's copy of the symbol dictionary with only the fields the app reads.
 *
 * `data/dream-symbols*.json` also feed the marketing site, which needs the FAQ, SEO
 * titles, meta descriptions and illustration records (about 1.2 MB of the 6 MB the
 * app used to bundle). The app bundles `data/app/dream-symbols.json`; the extended
 * file is bundled on web only, and the native app downloads the same content per
 * language from the site (see buildSymbolContentByLanguage). Re-run after editing the
 * dictionary sources:
 *
 *   npm run symbols:dictionary:sync            # write data/app/
 *   npm run symbols:dictionary:sync -- --check # fail if data/app/ is stale
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'app');
const OUTPUTS = {
  symbols: path.join(OUT_DIR, 'dream-symbols.json'),
  extended: path.join(OUT_DIR, 'dream-symbols-extended.json'),
};
const LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt'];

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

// Mirrors LocalizedSymbolContent / DreamSymbol / ExtendedSymbolContent in lib/symbolTypes.ts.
const pickLocalized = ({ slug, name, shortDescription, askYourself }) => ({
  slug,
  name,
  shortDescription,
  askYourself,
});

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

function buildAppDictionary() {
  const source = readJson('data/dream-symbols.json');
  const symbols = {
    categories: source.categories,
    symbols: source.symbols.map((symbol) => ({
      id: symbol.id,
      category: symbol.category,
      priority: symbol.priority,
      ...Object.fromEntries(LANGUAGES.map((language) => [language, pickLocalized(symbol[language])])),
      relatedSymbols: symbol.relatedSymbols,
      relatedArticles: symbol.relatedArticles,
    })),
  };

  return {
    symbols: `${JSON.stringify(symbols)}\n`,
    extended: `${JSON.stringify(buildExtendedMap())}\n`,
  };
}

function main() {
  const built = buildAppDictionary();
  const stale = Object.keys(OUTPUTS).filter(
    (key) => !fs.existsSync(OUTPUTS[key]) || fs.readFileSync(OUTPUTS[key], 'utf8') !== built[key],
  );

  if (process.argv.includes('--check')) {
    if (stale.length) {
      console.error('data/app/ is stale. Run npm run symbols:dictionary:sync.');
      process.exit(1);
    }
    console.log('App symbol dictionary up to date.');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const key of Object.keys(OUTPUTS)) fs.writeFileSync(OUTPUTS[key], built[key]);
  console.log(`Wrote ${Object.values(OUTPUTS).map((file) => path.relative(ROOT, file)).join(', ')}.`);
}

if (require.main === module) main();

module.exports = { buildAppDictionary, buildSymbolContentByLanguage, LANGUAGES, OUTPUTS };
