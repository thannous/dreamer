#!/usr/bin/env node
// Imports one atlas asset pack (the eight paintings and textures of one symbol page) into the
// site: validates every file, then encodes the sizes the site serves as AVIF and WebP under
// /img/symbols/atlas-six-v2/<symbolId>/, named after their content, and writes a receipt with
// the delta of the shared manifest docs-src/config/symbol-atlas-six-assets.json.
//
//   node scripts/atlas-pack.mjs --pack <pack.json> [--dry-run] [--merge-manifest]
//     [--repo-root <dir>] [--input-root <dir>] [--output-root <dir>] [--receipt <file>]
//
// Nothing is written unless every file of the pack passes (contract: scripts/lib/atlas-pack-contract.mjs,
// example: scripts/atlas-pack.example.json). A role whose source and recipe are unchanged since the
// last import (per-symbol cache in .cache/atlas-pack/) is neither re-encoded nor rewritten. Files are
// never deleted: outputs no longer referenced are listed as superseded in the receipt.
// --merge-manifest also replaces the symbol's entry in the shared manifest; it requires the symbol to
// be allowlisted in symbol-atlas-pilots.json, since the site build refuses any other.

import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALPHA_LIMITS, CATALOG, ID_PATTERN, IMAGE_PREFIX, OUTPUT_FORMATS, PACK_SCHEMA, PILOTS_CONFIG,
  RECEIPT_SCHEMA, SHARED_MANIFEST, SOURCE_FORMATS, outputUrl, rolesOf, ruleOf,
} from './lib/atlas-pack-contract.mjs';
import { inside, unsafeDestination } from './lib/atlas-paths.mjs';

const require = createRequire(import.meta.url);
const sharp = require('../apps/site/dependencies')('sharp');
const SCRIPT = fileURLToPath(import.meta.url);
const CONTRACT = path.join(path.dirname(SCRIPT), 'lib', 'atlas-pack-contract.mjs');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const toPosix = (file) => file.split(path.sep).join('/');
// Paths given on the command line are read from where the command was typed (npm --prefix moves the cwd).
const fromCaller = (file) => path.resolve(process.env.INIT_CWD || process.cwd(), file);

class UsageError extends Error {}
class PackError extends Error {
  constructor(problems) {
    super(`The pack is refused; nothing was written:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    this.problems = problems;
  }
}

function parseArgs(argv) {
  const options = { dryRun: false, mergeManifest: false };
  const valued = { '--pack': 'pack', '--repo-root': 'repoRoot', '--input-root': 'inputRoot', '--output-root': 'outputRoot', '--receipt': 'receipt' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--merge-manifest') options.mergeManifest = true;
    else if (valued[arg]) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new UsageError(`${arg} needs a value`);
      options[valued[arg]] = value;
      index += 1;
    } else throw new UsageError(`unknown argument ${arg}`);
  }
  if (!options.pack) throw new UsageError('--pack <pack.json> is required');
  if (options.dryRun && options.mergeManifest) throw new UsageError('--dry-run and --merge-manifest exclude each other');
  return options;
}

function readJson(file, what) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new PackError([`${what} (${file}) is unreadable: ${error.message}`]);
  }
}

function validateShape(pack, problems) {
  const text = (value) => typeof value === 'string' && value.trim().length > 0;
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return problems.push('the pack is not a JSON object');
  const known = ['schema', 'symbolId', 'sceneIds', 'provenance', 'roles'];
  for (const key of Object.keys(pack)) if (!known.includes(key)) problems.push(`unknown key "${key}"`);
  if (pack.schema !== PACK_SCHEMA) problems.push(`schema must be "${PACK_SCHEMA}"`);
  if (typeof pack.symbolId !== 'string' || !ID_PATTERN.test(pack.symbolId)) problems.push(`symbolId must match ${ID_PATTERN}`);
  if (!Array.isArray(pack.sceneIds) || pack.sceneIds.length !== 3) problems.push('sceneIds must list exactly three scenes');
  else {
    pack.sceneIds.forEach((id) => { if (typeof id !== 'string' || !ID_PATTERN.test(id)) problems.push(`scene id "${id}" must match ${ID_PATTERN}`); });
    if (new Set(pack.sceneIds).size !== 3) problems.push('sceneIds must be distinct');
  }
  const provenance = pack.provenance;
  if (!provenance || typeof provenance !== 'object') problems.push('provenance is required');
  else for (const key of ['author', 'tool', 'createdAt']) if (!text(provenance[key])) problems.push(`provenance.${key} is required`);
  if (!pack.roles || typeof pack.roles !== 'object' || Array.isArray(pack.roles)) return problems.push('roles is required');
  if (!Array.isArray(pack.sceneIds) || pack.sceneIds.length !== 3) return undefined;
  const expected = rolesOf(pack.sceneIds);
  for (const role of expected) if (!pack.roles[role]) problems.push(`role ${role} is missing`);
  for (const role of Object.keys(pack.roles)) if (!expected.includes(role)) problems.push(`role ${role} is not one of ${expected.join(', ')}`);
  for (const [role, entry] of Object.entries(pack.roles)) {
    if (!entry || typeof entry !== 'object') { problems.push(`${role}: expected { file, sha256, prompt }`); continue; }
    for (const key of Object.keys(entry)) if (!['file', 'sha256', 'prompt'].includes(key)) problems.push(`${role}: unknown key "${key}"`);
    if (!text(entry.file)) problems.push(`${role}.file is required`);
    if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256)) problems.push(`${role}.sha256 must be 64 lowercase hex`);
    if (!text(entry.prompt)) problems.push(`${role}.prompt is required`);
  }
  return undefined;
}

// The symbol exists in the catalogue; an allowlisted page keeps its own three scenes.
function validateAgainstRepo(pack, repoRoot, problems) {
  const catalog = readJson(path.join(repoRoot, CATALOG), 'the catalogue');
  if (!(catalog.symbols || []).some((symbol) => symbol.id === pack.symbolId)) problems.push(`symbolId "${pack.symbolId}" is not in ${CATALOG}`);
  const pilotsFile = path.join(repoRoot, PILOTS_CONFIG);
  const pilots = fs.existsSync(pilotsFile) ? readJson(pilotsFile, 'the pilots config') : {};
  const pilot = pilots[pack.symbolId];
  if (pilot) {
    const configured = pilot.scenes.map((scene) => scene.id);
    if (configured.join() !== pack.sceneIds.join()) problems.push(`sceneIds ${pack.sceneIds.join(', ')} differ from the allowlisted ${configured.join(', ')}`);
  }
  return { allowlisted: Boolean(pilot) };
}

async function alphaStats(bytes, info) {
  const alpha = await sharp(bytes).ensureAlpha().extractChannel(3).raw().toBuffer();
  let transparent = 0;
  let translucent = 0;
  for (const value of alpha) {
    if (value === 0) transparent += 1;
    else if (value < 255) translucent += 1;
  }
  const pixels = info.width * info.height;
  const round = (value) => Number(value.toFixed(6));
  return { channel: info.hasAlpha, transparent: round(transparent / pixels), translucent: round(translucent / pixels) };
}

async function readSource(role, entry, inputRoot, problems) {
  const file = entry.file;
  if (path.isAbsolute(file) || /^[a-zA-Z]:/.test(file) || file.includes('\\') || file.split('/').includes('..')) {
    problems.push(`${role}: ${file} must be a relative POSIX path inside the input root`);
    return null;
  }
  const full = path.resolve(inputRoot, file);
  if (!inside(inputRoot, full)) { problems.push(`${role}: ${file} leaves the input root`); return null; }
  let stat;
  try { stat = fs.lstatSync(full); } catch { problems.push(`${role}: ${file} is missing`); return null; }
  if (stat.isSymbolicLink() || !stat.isFile() || fs.realpathSync(full) !== full) { problems.push(`${role}: ${file} is not a plain file (links are refused)`); return null; }
  const bytes = fs.readFileSync(full);
  const actual = sha256(bytes);
  if (actual !== entry.sha256) { problems.push(`${role}: ${file} has sha256 ${actual}, the pack says ${entry.sha256}`); return null; }
  let info;
  try { info = await sharp(bytes).metadata(); } catch (error) { problems.push(`${role}: ${file} is not a readable image (${error.message})`); return null; }
  const rule = ruleOf(role);
  if (!SOURCE_FORMATS.includes(info.format)) problems.push(`${role}: format ${info.format} is not one of ${SOURCE_FORMATS.join(', ')}`);
  if (rule.alpha && info.format === 'jpeg') problems.push(`${role}: a JPEG has no alpha`);
  const width = info.autoOrient?.width ?? info.width;
  const height = info.autoOrient?.height ?? info.height;
  const [lowest, highest] = rule.ratio;
  const ratio = width / height;
  if (ratio < lowest || ratio > highest) problems.push(`${role}: ratio ${ratio.toFixed(4)} (${width}×${height}) is outside its orientation range ${lowest}–${highest}`);
  if (width < rule.minWidth) problems.push(`${role}: ${width}px wide, at least ${rule.minWidth}px are needed`);
  const alpha = await alphaStats(bytes, { ...info, width: info.width, height: info.height });
  if (rule.alpha) {
    if (!alpha.channel) problems.push(`${role}: no alpha channel`);
    else {
      if (alpha.transparent < ALPHA_LIMITS.minTransparent) problems.push(`${role}: ${(alpha.transparent * 100).toFixed(2)}% transparent, at least ${ALPHA_LIMITS.minTransparent * 100}% expected`);
      if (alpha.transparent > ALPHA_LIMITS.maxTransparent) problems.push(`${role}: ${(alpha.transparent * 100).toFixed(2)}% transparent, at most ${ALPHA_LIMITS.maxTransparent * 100}% (an empty texture)`);
      if (alpha.translucent < ALPHA_LIMITS.minTranslucent) problems.push(`${role}: ${(alpha.translucent * 100).toFixed(3)}% translucent, at least ${ALPHA_LIMITS.minTranslucent * 100}% expected (no soft edge)`);
    }
  } else if (alpha.transparent + alpha.translucent > ALPHA_LIMITS.maxOpaqueRoleNonOpaque) {
    problems.push(`${role}: ${((alpha.transparent + alpha.translucent) * 100).toFixed(2)}% of pixels are not opaque; this role must be opaque`);
  }
  return { role, file, bytes, sha256: actual, format: info.format, width, height, alpha };
}

function servedWidths(rule, sourceWidth) {
  const widths = rule.widths.map((width) => (width === 'native' ? sourceWidth : width)).filter((width) => width <= sourceWidth);
  return [...new Set(widths)].sort((a, b) => a - b);
}

async function encode(source, rule, format, width) {
  let pipeline = sharp(source.bytes).rotate();
  pipeline = rule.alpha ? pipeline.ensureAlpha() : pipeline.removeAlpha();
  if (width !== source.width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
  const { data, info } = await pipeline.toFormat(format, rule.quality[format]).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function writeAtomically(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, { flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export async function importPack(options) {
  const repoRoot = fs.realpathSync(options.repoRoot ? fromCaller(options.repoRoot) : path.join(path.dirname(SCRIPT), '..'));
  const packFile = fromCaller(options.pack);
  const pack = readJson(packFile, 'the pack');
  const inputRoot = fs.realpathSync(options.inputRoot ? fromCaller(options.inputRoot) : path.dirname(packFile));
  const canonicalOutput = path.join(repoRoot, 'docs-src', 'static');
  const outputRoot = options.outputRoot ? fromCaller(options.outputRoot) : canonicalOutput;
  if (unsafeDestination(repoRoot, outputRoot)) throw new PackError([`the output root ${outputRoot} must lie inside the repository, without links (${unsafeDestination(repoRoot, outputRoot)})`]);
  const cacheDir = path.join(repoRoot, '.cache', 'atlas-pack');

  const problems = [];
  validateShape(pack, problems);
  if (problems.length) throw new PackError(problems);
  const { allowlisted } = validateAgainstRepo(pack, repoRoot, problems);
  if (options.mergeManifest && !allowlisted) problems.push(`--merge-manifest: ${pack.symbolId} is not allowlisted in ${PILOTS_CONFIG}; the site build would refuse the manifest`);
  // The manifest names site URLs: it may only describe files written where the site serves them.
  if (options.mergeManifest && outputRoot !== canonicalOutput) problems.push(`--merge-manifest needs the site's own output root ${toPosix(path.relative(repoRoot, canonicalOutput))}, not a staging one`);
  const symbolDir = path.join(outputRoot, ...IMAGE_PREFIX.split('/').filter(Boolean), pack.symbolId);
  const manifestFile = path.join(repoRoot, SHARED_MANIFEST);
  const cacheFile = path.join(cacheDir, `${pack.symbolId}.json`);
  // Two imports within the same second keep two receipts: milliseconds and a random suffix.
  const stamp = `${new Date().toISOString().replace(/[-:.]/g, '')}-${randomBytes(3).toString('hex')}`;
  const receiptFile = options.receipt ? fromCaller(options.receipt) : path.join(cacheDir, 'receipts', `${pack.symbolId}-${stamp}.json`);
  if (!options.dryRun) {
    // Every destination: the images, the cache, the receipt and, with --merge-manifest, the manifest.
    const destinations = [['the output folder', symbolDir], ['the cache', cacheFile], ['the receipt', receiptFile], ...(options.mergeManifest ? [['the shared manifest', manifestFile]] : [])];
    for (const [what, target] of destinations) {
      const reason = unsafeDestination(repoRoot, target);
      if (reason) problems.push(`${what}: ${reason}`);
    }
    if (fs.existsSync(receiptFile)) problems.push(`the receipt ${receiptFile} already exists`);
  }

  const roles = rolesOf(pack.sceneIds);
  const sources = [];
  for (const role of roles) sources.push(await readSource(role, pack.roles[role], inputRoot, problems));
  if (problems.length) throw new PackError(problems);

  // Everything is valid: plan, then encode only what the per-symbol cache does not already hold.
  const code = sha256(Buffer.concat([fs.readFileSync(SCRIPT), fs.readFileSync(CONTRACT)]));
  const cache = fs.existsSync(cacheFile) ? readJson(cacheFile, 'the cache') : { schema: 1, entries: {} };
  const entries = {};
  const delta = {};
  const report = {};
  for (const source of sources) {
    const rule = ruleOf(source.role);
    // The manifest keeps the source's native size for every role; the served sizes are in the maps.
    const asset = { width: source.width, height: source.height, avif: {}, webp: {} };
    report[source.role] = { source: { file: source.file, sha256: source.sha256, format: source.format, width: source.width, height: source.height, alpha: source.alpha, prompt: pack.roles[source.role].prompt }, outputs: [] };
    for (const width of servedWidths(rule, source.width)) {
      for (const format of OUTPUT_FORMATS) {
        const key = `${source.role}/${format}/${width}`;
        const input = sha256(stableJson({ code, sharp: sharp.versions, source: source.sha256, format, width, options: rule.quality[format], alpha: rule.alpha }));
        const cached = cache.entries?.[key];
        const cachedFile = cached && path.join(outputRoot, ...cached.url.split('/').filter(Boolean));
        let output;
        if (cached && cached.input === input && fs.existsSync(cachedFile) && sha256(fs.readFileSync(cachedFile)) === cached.sha256) {
          output = { ...cached, status: 'unchanged' };
        } else if (options.dryRun) {
          output = { status: 'to-encode', width, url: null, sha256: null, height: null, bytes: null };
        } else {
          const encoded = await encode(source, rule, format, width);
          const hash = sha256(encoded.data);
          const url = outputUrl(pack.symbolId, source.role, width, hash.slice(0, 12), format);
          const file = path.join(outputRoot, ...url.split('/').filter(Boolean));
          let status = 'written';
          if (unsafeDestination(repoRoot, file)) throw new PackError([`${url}: ${unsafeDestination(repoRoot, file)}`]);
          if (fs.existsSync(file)) {
            if (sha256(fs.readFileSync(file)) !== hash) throw new PackError([`${url} exists with other content; it is never overwritten`]);
            status = 'reused';
          } else {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, encoded.data, { flag: 'wx' });
          }
          output = { status, input, url, sha256: hash, width: encoded.width, height: encoded.height, bytes: encoded.data.length };
        }
        if (output.url) {
          entries[key] = { input, url: output.url, sha256: output.sha256, width: output.width, height: output.height, bytes: output.bytes };
          asset[format][String(width)] = output.url;
        }
        report[source.role].outputs.push({ format, width, status: output.status, url: output.url, sha256: output.sha256, bytes: output.bytes });
      }
    }
    if (!options.dryRun) delta[source.role] = asset;
  }

  // Files of the symbol that the new delta no longer references stay in place, reported.
  const referenced = new Set(Object.values(entries).map((entry) => entry.url));
  const superseded = options.dryRun ? null : fs.existsSync(symbolDir)
    ? fs.readdirSync(symbolDir).map((name) => `${IMAGE_PREFIX}/${pack.symbolId}/${name}`).filter((url) => !referenced.has(url)).sort()
    : [];

  const receipt = {
    schema: RECEIPT_SCHEMA,
    createdAt: new Date().toISOString(),
    dryRun: options.dryRun,
    pack: { file: path.basename(packFile), sha256: sha256(fs.readFileSync(packFile)), symbolId: pack.symbolId, sceneIds: pack.sceneIds, provenance: pack.provenance },
    encoder: { sharp: sharp.versions, code },
    outputFolder: toPosix(path.relative(repoRoot, symbolDir)),
    roles: report,
    superseded,
    manifestDelta: options.dryRun ? null : { [pack.symbolId]: delta },
    mergedInto: null,
  };
  if (options.dryRun) return { receipt, receiptFile: null };

  writeAtomically(cacheFile, `${JSON.stringify({ schema: 1, entries }, null, 2)}\n`);
  if (options.mergeManifest) {
    const manifest = fs.existsSync(manifestFile) ? readJson(manifestFile, 'the shared manifest') : {};
    manifest[pack.symbolId] = delta;
    writeAtomically(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    receipt.mergedInto = SHARED_MANIFEST;
  }
  fs.mkdirSync(path.dirname(receiptFile), { recursive: true });
  fs.writeFileSync(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
  return { receipt, receiptFile };
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`atlas-pack: ${error.message}`);
    process.exit(2);
  }
  try {
    const { receipt, receiptFile } = await importPack(options);
    const counts = {};
    for (const role of Object.values(receipt.roles)) for (const output of role.outputs) counts[output.status] = (counts[output.status] ?? 0) + 1;
    console.log(`atlas-pack: ${receipt.pack.symbolId}: ${Object.entries(counts).map(([status, count]) => `${count} ${status}`).join(', ')}${receipt.superseded?.length ? `; ${receipt.superseded.length} superseded file(s) kept` : ''}.`);
    if (receiptFile) console.log(`atlas-pack: receipt ${receiptFile}${receipt.mergedInto ? `; merged into ${receipt.mergedInto}` : '; shared manifest untouched (delta in the receipt)'}`);
    else console.log(JSON.stringify(receipt, null, 2));
  } catch (error) {
    if (error instanceof PackError) {
      console.error(`atlas-pack: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) await main();
