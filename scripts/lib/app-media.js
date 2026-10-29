'use strict';

// Mobile-only media the Dreamer app shows from the site's CDN instead of bundling them
// (owner decision, 2026-10-29): the same R2 bucket and public origin as the site media,
// under their own immutable, content-addressed namespace `app/v1/<sha256>.<ext>`. A key is
// never overwritten nor deleted, so every installed version keeps finding its files.

const fs = require('node:fs');
const path = require('node:path');
const { CONFIG, MIME, sha256 } = require('./site-media');

const APP_MEDIA = 'assets/remote/app-media.json';
const APP_RECEIPT = 'assets/remote/app-media-verification.json';
const OBJECT_PREFIX = 'app/v1/';

/**
 * What leaves the bundle, by namespace: the full badge paintings. Their small exports stay
 * bundled as the stand-in while loading, offline and on error.
 */
const SOURCES = [
  { namespace: 'badges', dir: 'assets/images/badges/app', include: (name) => name.endsWith('.webp') && !name.endsWith('-small.webp') },
];
const SOURCE_PATH = /^assets\/images\/badges\/app\/[a-z0-9-]+\.webp$/;
const KEY = /^[a-z0-9-]+\/[a-z0-9-]+$/;

function appSourcePath(root, relative) {
  // A manifest row can only name a committed app export, never a credential or a URL.
  if (!SOURCE_PATH.test(relative)) throw new Error(`Invalid app media path: ${relative}`);
  const base = fs.realpathSync(root);
  let current = base;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('App media paths cannot use symlinks');
  }
  return path.join(base, relative);
}

const objectKey = (entry) => `${OBJECT_PREFIX}${entry[2]}${path.extname(entry[0])}`;
const appMediaUrl = (origin, entry) => `${origin.replace(/\/$/, '')}/${objectKey(entry)}`;

/** Every app media file now on disk, keyed `<namespace>/<file name without extension>`. */
function appInventory(root) {
  const rows = [];
  for (const source of SOURCES) {
    for (const name of fs.readdirSync(path.join(root, source.dir)).filter(source.include)) {
      const relative = `${source.dir}/${name}`;
      const data = fs.readFileSync(appSourcePath(root, relative));
      rows.push([`${source.namespace}/${path.basename(name, path.extname(name))}`, [relative, data.length, sha256(data)]]);
    }
  }
  if (!rows.length) throw new Error('No app media to inventory');
  return Object.fromEntries(rows.sort((a, b) => a[0].localeCompare(b[0], 'en')));
}

function writeAppManifest(root, manifest) {
  const rows = Object.entries(manifest).map(([key, entry]) => `  ${JSON.stringify(key)}: ${JSON.stringify(entry)}`);
  fs.mkdirSync(path.join(root, path.dirname(APP_MEDIA)), { recursive: true });
  fs.writeFileSync(path.join(root, APP_MEDIA), `{\n${rows.join(',\n')}\n}\n`);
}

/** The committed manifest and the site's storage configuration, both validated. */
function readAppMedia(root) {
  const config = JSON.parse(fs.readFileSync(path.join(root, CONFIG), 'utf8'));
  const url = new URL(config.publicOrigin);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.hostname.endsWith('.r2.dev')) {
    throw new Error('A production HTTPS media origin is required (not r2.dev)');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, APP_MEDIA), 'utf8'));
  const entries = Object.entries(manifest);
  if (!entries.length) throw new Error('Empty app media manifest');
  for (const [key, entry] of entries) {
    if (!KEY.test(key) || !Array.isArray(entry) || entry.length !== 3) throw new Error(`Invalid app media entry: ${key}`);
    const [relative, bytes, digest] = entry;
    appSourcePath(root, relative);
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || !/^[a-f0-9]{64}$/.test(digest) || !MIME[path.extname(relative)]) {
      throw new Error(`Invalid app media entry: ${key}`);
    }
  }
  return { config, manifest, entries };
}

/** The committed files must be the bytes the manifest names: those are the ones uploaded. */
function verifyAppLocal(root, media = readAppMedia(root)) {
  for (const [key, [relative, bytes, digest]] of media.entries) {
    const data = fs.readFileSync(appSourcePath(root, relative));
    if (data.length !== bytes || sha256(data) !== digest) throw new Error(`App media changed; run app-inventory: ${key}`);
  }
}

/**
 * Release gate: every object the manifest names was read back from the public CDN with its
 * exact bytes. A key the app references before it exists would be cached as a 404 by the CDN.
 */
function missingFromAppReceipt(root, media = readAppMedia(root)) {
  const file = path.join(root, APP_RECEIPT);
  const receipt = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const verified = new Set(receipt && receipt.schema === 1 && receipt.origin === media.config.publicOrigin && Array.isArray(receipt.objects)
    ? receipt.objects : []);
  return media.entries.filter(([, entry]) => !verified.has(objectKey(entry))).map(([key]) => key);
}

module.exports = { APP_MEDIA, APP_RECEIPT, OBJECT_PREFIX, appSourcePath, objectKey, appMediaUrl, appInventory,
  writeAppManifest, readAppMedia, verifyAppLocal, missingFromAppReceipt };
