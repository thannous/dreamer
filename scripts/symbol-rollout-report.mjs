#!/usr/bin/env node
// Rollout report of the 240 dream symbols: for each id, its lot (docs-src/config/symbol-rollout.json),
// then what the repository shows: the catalog in each published language, the atlas (tiger or pilot)
// and the languages that have its words (symbol-atlas-locales.json), each scene's card in each
// language, the eight paintings of the shared manifest, then three recorded stages: QA and approval
// of each language on desktop and on mobile, and publication of each language. A stage is reached
// only through a record of the registry whose evidence file is present with its sha256; nothing is
// deduced from the files lying around (a screenshot never validates, a build never publishes).
// Each language has a source identity (sha256 of its content, its atlas words, its paintings and the
// engine that renders it); a record names the identity it qualified, and once any of them changes the
// record stays as history ("stale") instead of counting as the current qualification.
//
//   node scripts/symbol-rollout-report.mjs --out <dir> [--manifest <assets.json>] [--evidence-root <dir>]
//     [--repo-root <dir>]
//
// Writes <dir>/symbol-rollout.json and <dir>/symbol-rollout.csv, the same for the same inputs.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { catalogKey } = require('./lib/symbol-locales.js');

const SCHEMA = 'noctalia.symbol-rollout-report/1';
const SCRIPT = fileURLToPath(import.meta.url);
const SURFACES = ['desktop', 'mobile'];
// QA and approval are recorded per language and surface; publication per language (surface "all").
const STAGES = { qa: SURFACES, approval: SURFACES, publication: ['all'] };
const VERDICTS = ['accepted', 'changes'];
const ATLAS_ROLES = ['hero', 'portrait', 'plate', 'layer', 'accent'];
const TIGER_SCENES = ['poursuite', 'calme', 'cage'];
const fromCaller = (file) => path.resolve(process.env.INIT_CWD || process.cwd(), file);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const SOURCE_PARTS = ['content', 'atlas', 'assets', 'engine'];
const identity = (value) => (value == null ? null : sha256(JSON.stringify(value)));
const pick = (object, keys) => Object.fromEntries(keys.filter((key) => Object.hasOwn(object, key)).map((key) => [key, object[key]]));

class ReportError extends Error {}

function parseArgs(argv) {
  const options = {};
  const valued = { '--out': 'out', '--manifest': 'manifest', '--evidence-root': 'evidenceRoot', '--repo-root': 'repoRoot' };
  for (let index = 0; index < argv.length; index += 1) {
    const key = valued[argv[index]];
    if (!key || !argv[index + 1]) throw new ReportError(`unknown or incomplete argument ${argv[index]}`);
    options[key] = argv[index + 1];
    index += 1;
  }
  if (!options.out) throw new ReportError('--out <dir> is required');
  return options;
}

// The generator's own comparison of a scene with a published card (generate-symbol-pages.js).
const plainText = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/[ \t\r\n\f\v]+/g, ' ').trim();
const looseSpaces = (text) => text.replace(/[  ]/g, ' ');

function readJson(file, what) {
  try {
    return { value: JSON.parse(fs.readFileSync(file, 'utf8')), sha256: sha256(fs.readFileSync(file)) };
  } catch (error) {
    throw new ReportError(`${what} (${file}): ${error.message}`);
  }
}

export function buildReport(options) {
  const repoRoot = fs.realpathSync(options.repoRoot ? fromCaller(options.repoRoot) : path.join(path.dirname(SCRIPT), '..'));
  const at = (...parts) => path.join(repoRoot, ...parts);
  const siteConfig = readJson(at('docs-src', 'config', 'site.config.json'), 'the site config');
  const site = siteConfig.value;
  const languages = site.collections?.symbols?.languages ?? site.languages;
  const catalog = readJson(at('data', 'dream-symbols.json'), 'the catalog');
  const extendedFile = readJson(at('data', 'dream-symbols-extended.json'), 'the extended catalog');
  const tier3File = readJson(at('data', 'dream-symbols-extended-tier3.json'), 'the tier-3 catalog');
  const extended = extendedFile.value;
  const tier3 = tier3File.value;
  const registry = readJson(at('docs-src', 'config', 'symbol-rollout.json'), 'the rollout registry');
  const pilots = readJson(at('docs-src', 'config', 'symbol-atlas-pilots.json'), 'the pilots config');
  const locales = readJson(at('docs-src', 'config', 'symbol-atlas-locales.json'), 'the atlas locales');
  const manifestFile = options.manifest ? fromCaller(options.manifest) : at('docs-src', 'config', 'symbol-atlas-six-assets.json');
  const manifest = fs.existsSync(manifestFile) ? readJson(manifestFile, 'the assets manifest') : null;
  const evidenceRoot = options.evidenceRoot ? fromCaller(options.evidenceRoot) : repoRoot;
  // The engine: the page generator and the motion scripts it serves (every hashed folder); a page
  // without a pack also takes the phone framing of its hero from the generator's framing file.
  const engineFiles = (...dirs) => dirs.flatMap((dir) => {
    const root = at(...dir.split('/'));
    if (!fs.existsSync(root)) return [];
    if (fs.statSync(root).isFile()) return [dir];
    return fs.readdirSync(root, { recursive: true }).map((name) => `${dir}/${String(name).split(path.sep).join('/')}`)
      .filter((file) => fs.statSync(at(...file.split('/'))).isFile());
  }).sort();
  const engineIdentity = (files) => identity(files.map((file) => [file, sha256(fs.readFileSync(at(...file.split('/'))))]));
  const generator = 'docs-src/static/scripts/generate-symbol-pages.js';
  const framingFile = 'docs-src/config/symbol-hero-portrait.json';
  const engines = {
    page: engineIdentity(engineFiles(generator, framingFile)),
    pilot: engineIdentity(engineFiles(generator, 'docs-src/static/js/symbol-living')),
    tiger: engineIdentity(engineFiles(generator, 'docs-src/static/js/tiger-living')),
  };

  // Each page without a pack carries the generator and its own framing only: re-cropping one symbol
  // leaves the other pages' qualifications reusable.
  const framing = fs.existsSync(at(...framingFile.split('/'))) ? readJson(at(...framingFile.split('/')), 'the hero framing').value : {};
  const generatorEngine = engineIdentity(engineFiles(generator));
  const textEngine = (id) => identity({ generator: generatorEngine, framing: framing[id] ?? null });

  // The registry names every catalog id exactly once, each with a known lot or none.
  const problems = [];
  const ids = catalog.value.symbols.map((symbol) => symbol.id);
  const entries = registry.value.symbols ?? {};
  const lots = registry.value.lots ?? {};
  for (const id of ids) if (!Object.hasOwn(entries, id)) problems.push(`${id} is missing from the registry`);
  for (const id of Object.keys(entries)) if (!ids.includes(id)) problems.push(`${id} is in the registry but not in data/dream-symbols.json`);
  for (const [id, entry] of Object.entries(entries)) if (entry.lot !== null && !Object.hasOwn(lots, entry.lot)) problems.push(`${id}: unknown lot ${entry.lot}`);
  const records = Array.isArray(registry.value.records) ? registry.value.records : (problems.push('records must be a list'), []);
  records.forEach((record, index) => {
    const where = `records[${index}]`;
    if (!ids.includes(record?.id)) problems.push(`${where}: unknown symbol ${record?.id}`);
    if (!languages.includes(record?.lang)) problems.push(`${where}: language ${record?.lang} is not published`);
    if (!Object.hasOwn(STAGES, record?.stage)) problems.push(`${where}: stage must be ${Object.keys(STAGES).join(', ')}`);
    else if (!STAGES[record.stage].includes(record?.surface)) problems.push(`${where}: a ${record.stage} record covers ${STAGES[record.stage].join(' or ')}`);
    if (!VERDICTS.includes(record?.verdict)) problems.push(`${where}: verdict must be ${VERDICTS.join(' or ')}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record?.date ?? '')) problems.push(`${where}: date must be YYYY-MM-DD`);
    if (typeof record?.evidence?.path !== 'string' || !/^[0-9a-f]{64}$/.test(record?.evidence?.sha256 ?? '')) problems.push(`${where}: evidence needs a path and its sha256`);
    const source = record?.source;
    if (!source || typeof source !== 'object' || Object.keys(source).sort().join() !== [...SOURCE_PARTS].sort().join()
      || SOURCE_PARTS.some((part) => source[part] !== null && !/^[0-9a-f]{64}$/.test(source[part] ?? ''))) {
      problems.push(`${where}: source needs the ${SOURCE_PARTS.join(', ')} identities the report gave for that symbol and language (sha256 or null)`);
    }
  });
  if (problems.length) throw new ReportError(`the registry is not usable:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);

  const evidenceState = (record) => {
    const file = path.resolve(evidenceRoot, record.evidence.path);
    if (!fs.existsSync(file)) return 'evidence-missing';
    return sha256(fs.readFileSync(file)) === record.evidence.sha256 ? 'present' : 'evidence-mismatch';
  };
  // The latest record decides; an accepted one counts only for the sources it names.
  const stageState = (stage, id, lang, surface, source) => {
    const latest = records.filter((record) => record.stage === stage && record.id === id && record.lang === lang && record.surface === surface).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    if (!latest) return { state: 'not-recorded', changed: [] };
    if (latest.verdict === 'changes') return { state: 'changes-requested', changed: [] };
    const evidence = evidenceState(latest);
    if (evidence !== 'present') return { state: evidence, changed: [] };
    const changed = SOURCE_PARTS.filter((part) => latest.source[part] !== source[part]);
    return { state: changed.length ? 'stale' : 'accepted', changed, date: latest.date };
  };

  const symbols = catalog.value.symbols.map((symbol) => {
    const { id } = symbol;
    const lot = entries[id].lot;
    const equipped = id === 'tiger' ? 'tiger' : Object.hasOwn(pilots.value, id) ? 'pilot' : null;
    const sceneIds = equipped === 'tiger' ? TIGER_SCENES : equipped === 'pilot' ? pilots.value[id].scenes.map((scene) => scene.id) : [];
    const perLanguage = Object.fromEntries(languages.map((lang) => {
      const key = catalogKey(lang);
      const content = extended.symbols?.[id]?.[key] ?? tier3?.[id]?.[key];
      const cards = (content?.variations ?? []).map((variation) => looseSpaces(plainText(variation.context)));
      const locale = locales.value.symbols?.[id]?.[lang] ?? null;
      const scenes = Object.fromEntries(sceneIds.map((sceneId) => {
        const variation = locale?.scenes?.[sceneId]?.variation;
        return [sceneId, !variation ? 'no-words' : cards.includes(variation) ? 'card' : 'card-missing'];
      }));
      // What a QA of this language looks at: its words, its atlas, its paintings and the engine. A
      // record copies this source; a later change to any part makes that record stale.
      // A page without a pack reads in the same article and prints these words of the language's shared
      // copy (renderAtlasArticle without scenes): its index label, detailed reading, app kicker and anchors.
      const languageCopy = locales.value.copy?.[lang] ?? null;
      const pageCopy = languageCopy && {
        ...pick(languageCopy, ['navLabel', 'continuationTitle', 'keepKicker']),
        anchors: pick(languageCopy.anchors ?? {}, ['keepInline', 'keepFinal', 'reading', 'further', 'related']),
      };
      const source = {
        content: identity({ catalog: symbol[key] ?? null, extended: content ?? null }),
        atlas: equipped
          ? identity({ copy: languageCopy, locale, pilot: pilots.value[id] ?? null })
          : identity({ copy: pageCopy }),
        assets: equipped === 'pilot' ? identity(manifest?.value[id] ?? null) : null,
        engine: equipped ? engines[equipped] : textEngine(id),
      };
      const stages = Object.fromEntries(Object.entries(STAGES).map(([stage, surfaces]) => [stage, Object.fromEntries(surfaces.map((surface) => [surface, stageState(stage, id, lang, surface, source)]))]));
      return [lang, {
        catalog: Boolean(symbol[key]?.name) && Boolean(content?.fullInterpretation),
        variations: cards.length,
        atlas: Boolean(locale),
        scenes,
        source,
        stages: Object.fromEntries(Object.entries(stages).map(([stage, surfaces]) => [stage, Object.fromEntries(Object.entries(surfaces).map(([surface, result]) => [surface, result.state]))])),
        stale: Object.entries(stages).flatMap(([stage, surfaces]) => Object.entries(surfaces).filter(([, result]) => result.state === 'stale')
          .map(([surface, result]) => ({ stage, surface, date: result.date, changed: result.changed }))),
      }];
    }));

    // The eight paintings of a pilot (the tiger has its own engine and files).
    let assets = { state: 'none', missing: [] };
    if (equipped === 'tiger') assets = { state: 'tiger-engine', missing: [] };
    if (equipped === 'pilot') {
      const roles = [...ATLAS_ROLES.slice(0, 3), ...sceneIds.map((sceneId) => `scene-${sceneId}`), ...ATLAS_ROLES.slice(3)];
      if (!manifest) assets = { state: 'manifest-unavailable', missing: roles };
      else {
        const entry = manifest.value[id] ?? {};
        const missing = roles.filter((role) => !entry[role]?.webp);
        const sceneImages = sceneIds.map((sceneId) => JSON.stringify(entry[`scene-${sceneId}`]?.webp ?? null));
        const sameImage = missing.length === 0 && new Set(sceneImages).size !== sceneImages.length;
        assets = { state: missing.length ? 'incomplete' : sameImage ? 'same-image-scenes' : 'complete', missing };
      }
    }

    const reasons = [];
    for (const lang of languages) {
      const state = perLanguage[lang];
      if (!state.catalog) reasons.push(`${lang}: catalog incomplete`);
      if (!equipped) continue;
      if (!state.atlas) reasons.push(`${lang}: no atlas words`);
      for (const [sceneId, scene] of Object.entries(state.scenes)) if (scene === 'card-missing') reasons.push(`${lang}: scene ${sceneId} names no published card`);
      for (const [stage, surfaces] of Object.entries(state.stages)) {
        for (const [surface, value] of Object.entries(surfaces)) {
          if (value === 'accepted') continue;
          const stale = state.stale.find((item) => item.stage === stage && item.surface === surface);
          reasons.push(`${lang} ${stage}${surface === 'all' ? '' : ` ${surface}`}: ${value}${stale ? ` (${stale.changed.join(', ')} changed since ${stale.date})` : ''}`);
        }
      }
    }
    if (equipped && !['complete', 'tiger-engine'].includes(assets.state)) reasons.push(`paintings ${assets.state}${assets.missing.length ? ` (${assets.missing.join(', ')})` : ''}`);
    if (lot && !equipped) reasons.push('in a lot but not equipped yet');
    const state = !lot && !equipped ? 'remaining' : reasons.length ? 'in-progress' : 'done';
    return { id, category: symbol.category, lot, equipped, state, assets, languages: perLanguage, reasons };
  });

  const count = (filter) => symbols.filter(filter).length;
  return {
    schema: SCHEMA,
    inputs: {
      siteConfig: siteConfig.sha256,
      catalog: catalog.sha256,
      extended: extendedFile.sha256,
      tier3: tier3File.sha256,
      registry: registry.sha256,
      pilots: pilots.sha256,
      locales: locales.sha256,
      manifest: manifest ? manifest.sha256 : null,
      engines,
    },
    languages,
    stages: STAGES,
    totals: { symbols: symbols.length, done: count((s) => s.state === 'done'), inProgress: count((s) => s.state === 'in-progress'), remaining: count((s) => s.state === 'remaining') },
    lots: Object.fromEntries(Object.entries(lots).map(([lot, def]) => [lot, { ...def, symbols: symbols.filter((s) => s.lot === lot).map((s) => s.id) }])),
    symbols,
  };
}

const csvCell = (value) => (/[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value));

export function toCsv(report) {
  const stageColumns = Object.entries(report.stages).flatMap(([stage, surfaces]) => surfaces.map((surface) => [stage, surface]));
  const header = ['id', 'category', 'lot', 'equipped', 'state', 'paintings', 'missing_paintings', ...report.languages.flatMap((lang) => [`${lang}_atlas`, `${lang}_scenes`, ...stageColumns.map(([stage, surface]) => `${lang}_${stage}${surface === 'all' ? '' : `_${surface}`}`)]), 'reasons'];
  const rows = report.symbols.map((symbol) => [
    symbol.id, symbol.category, symbol.lot ?? '', symbol.equipped ?? '', symbol.state, symbol.assets.state, symbol.assets.missing.join(' '),
    ...report.languages.flatMap((lang) => {
      const state = symbol.languages[lang];
      const scenes = Object.values(state.scenes);
      return [state.atlas ? 'yes' : 'no', scenes.length ? `${scenes.filter((scene) => scene === 'card').length}/${scenes.length}` : '', ...stageColumns.map(([stage, surface]) => state.stages[stage][surface])];
    }),
    symbol.reasons.join('; '),
  ]);
  return `${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = buildReport(options);
    const out = fromCaller(options.out);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'symbol-rollout.json'), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(out, 'symbol-rollout.csv'), toCsv(report));
    const { totals } = report;
    console.log(`symbol-rollout: ${totals.symbols} symbols, ${totals.done} done, ${totals.inProgress} in progress, ${totals.remaining} remaining; ${report.languages.length} languages; stages ${Object.keys(report.stages).join(', ')}`);
    console.log(`symbol-rollout: ${path.join(out, 'symbol-rollout.json')} and symbol-rollout.csv${report.inputs.manifest ? '' : ' (no assets manifest: paintings reported as manifest-unavailable)'}`);
  } catch (error) {
    if (!(error instanceof ReportError)) throw error;
    console.error(`symbol-rollout: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) main();
