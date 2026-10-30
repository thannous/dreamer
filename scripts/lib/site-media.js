'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { walkFiles } = require('./docs-source-utils');

const MANIFEST = 'docs-src/config/site-media.json';
const CONFIG = 'docs-src/config/site-media-storage.json';
const STATIC = 'docs-src/static';
const MIME = { '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function localPath(root, relative) {
  // A media manifest can never name application data, a credential or an arbitrary URL.
  if (!/^img\/[a-zA-Z0-9._/-]+$/.test(relative) || relative.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error(`Invalid media path: ${relative}`);
  }
  const base = path.resolve(fs.realpathSync(root), STATIC);
  const target = path.join(base, relative);
  let current = base;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Media paths cannot use symlinks');
  }
  if (fs.existsSync(base) && fs.realpathSync(base) !== base) throw new Error('Static directory cannot use symlinks');
  return target;
}

function entriesDigest(entries) { return sha256(JSON.stringify(entries)); }

function readMedia(root) {
  const configFile = path.join(root, CONFIG);
  if (!fs.existsSync(configFile)) return null;
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  if (config.schema !== 1 || !['local', 'cdn'].includes(config.delivery)) throw new Error('Invalid media delivery configuration');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, MANIFEST), 'utf8'));
  if (manifest.schema !== 1 || !Array.isArray(manifest.files) || !manifest.files.length ||
      manifest.release !== entriesDigest(manifest.files)) throw new Error('Invalid media manifest digest');
  const seen = new Set();
  for (const [relative, bytes, digest] of manifest.files) {
    localPath(root, relative);
    if (seen.has(relative) || !Number.isSafeInteger(bytes) || bytes <= 0 || !/^[a-f0-9]{64}$/.test(digest) || !MIME[path.extname(relative)]) {
      throw new Error(`Invalid media entry: ${relative}`);
    }
    seen.add(relative);
  }
  if (config.bundledPaths !== undefined && (!Array.isArray(config.bundledPaths) ||
      new Set(config.bundledPaths).size !== config.bundledPaths.length ||
      config.bundledPaths.some(relative => !seen.has(relative)))) throw new Error('Bundled media must name distinct manifest entries');
  if (config.publicOrigin) {
    const url = new URL(config.publicOrigin);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.hostname.endsWith('.r2.dev')) {
      throw new Error('A production HTTPS media origin is required (not r2.dev)');
    }
  } else if (config.delivery === 'cdn') throw new Error('CDN delivery requires a public origin');
  return { config, manifest, paths: seen };
}

function inventory(root) {
  const base = path.join(root, STATIC);
  const files = walkFiles(path.join(base, 'img')).map(file => {
    const relative = path.relative(base, file).split(path.sep).join('/');
    localPath(root, relative);
    if (!MIME[path.extname(file)]) throw new Error(`Unexpected file in media: ${relative}`);
    const data = fs.readFileSync(file);
    return [relative, data.length, sha256(data)];
  }).sort((a, b) => a[0].localeCompare(b[0], 'en'));
  if (!files.length) throw new Error('No media to inventory');
  return { schema: 1, release: entriesDigest(files), files };
}

function publicUrl(media, relative) {
  return `${media.config.publicOrigin.replace(/\/$/, '')}/releases/${media.manifest.release}/${relative}`;
}


// Only rewrite inventoried site assets. Source catalogs and the native atlas keep
// their historical paths; published web documents resolve them to one verified release.
function mediaUrl(media, value, baseUrl = 'https://noctalia.app/') {
  if (!media || media.config.delivery !== 'cdn') return value;
  let url;
  try { url = new URL(value, baseUrl); } catch { return value; }
  if (url.username || url.password || url.origin !== new URL(baseUrl).origin || !media.paths.has(url.pathname.slice(1))) return value;
  return publicUrl(media, url.pathname.slice(1)) + url.search + url.hash;
}

function mediaRelativePath(media, value) {
  if (!media || media.config.delivery !== 'cdn') return null;
  const url = new URL(value);
  const base = new URL(publicUrl(media, ''));
  if (url.username || url.password || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
  const relative = url.pathname.slice(base.pathname.length);
  return relative.startsWith('img/') ? relative : null;
}

function rewriteMediaReferences(content, media, baseUrl) {
  // Consume the whole URL so another host's /img/ and an already-versioned URL
  // cannot be mistaken for a root-relative reference. Queries/fragments stay intact.
  return content.replace(/(?<![A-Za-z0-9_/:.\\-])(?:(?:https?:)?\/\/|(?:\.\.?\/)+img\/|\/img\/)(?:(?!&(?:quot|apos|#0?39|#x27);)[^\s"'`<>\\)])+/g,
    value => mediaUrl(media, value, baseUrl));
}

function rewriteWebMedia(root, docsDir, siteOrigin = 'https://noctalia.app') {
  const media = readMedia(root);
  if (!media || media.config.delivery !== 'cdn') return;
  assertRemoteReceipt(root, media);
  for (const file of walkFiles(docsDir, file => /\.(?:html|css)$/.test(file) || file === path.join(docsDir, 'sitemap.xml'))) {
    const relative = path.relative(docsDir, file).split(path.sep).join('/');
    const original = fs.readFileSync(file, 'utf8');
    const rendered = file.endsWith('.html') ? mediaCorsHtml(original) : original;
    const published = rewriteMediaReferences(rendered, media, new URL(relative, siteOrigin + '/').href);
    if (published !== original) fs.writeFileSync(file, published);
  }
}

function validLocal(root, entry) {
  const file = localPath(root, entry[0]);
  if (!fs.existsSync(file)) return false;
  return fs.statSync(file).size === entry[1] && sha256(fs.readFileSync(file)) === entry[2];
}

async function parallel(items, run, count = 8) {
  let index = 0;
  let failure;
  await Promise.all(Array.from({ length: Math.min(count, items.length) }, async () => {
    while (!failure && index < items.length) {
      const item = items[index++];
      try { await run(item); } catch (error) { failure ??= error; }
    }
  }));
  if (failure) throw failure;
}

async function download(media, entry, fetcher = fetch, url = publicUrl(media, entry[0])) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(60_000) });
      if (response.status === 429 || response.status >= 500) {
        await response.body?.cancel?.();
        if (attempt < 3) { await new Promise(resolve => setTimeout(resolve, attempt * 250)); continue; }
      }
      if (!response.ok || (response.headers.get('content-type') || '').split(';')[0] !== MIME[path.extname(entry[0])]) {
        throw new Error(`Media response invalid (${response.status}): ${entry[0]}`);
      }
      const length = response.headers.get('content-length');
      if (!response.headers.get('content-encoding') && length !== null && Number(length) !== entry[1]) throw new Error(`Media length mismatch: ${entry[0]}`);
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > entry[1]) throw new Error(`Media response too large: ${entry[0]}`);
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (size !== entry[1] || sha256(bytes) !== entry[2]) throw new Error(`Media digest mismatch: ${entry[0]}`);
      return bytes;
    } catch (error) {
      // Retry transport interruptions, never a missing/corrupt or incorrectly typed image.
      if (!['TypeError', 'TimeoutError', 'AbortError'].includes(error.name)) throw error;
      if (attempt < 3) { await new Promise(resolve => setTimeout(resolve, attempt * 250)); continue; }
      const code = String(error.cause?.code || error.name).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
      throw new Error(`Media transport failed after ${attempt} attempts (${code}): ${entry[0]}`);
    }
  }
}

async function hydrate(root, { fetcher = fetch, log = console.log } = {}) {
  const media = readMedia(root);
  if (!media) return;
  // A changed local illustration must be explicitly inventoried/published. Never overwrite it.
  const missing = [];
  for (const entry of media.manifest.files) {
    if (validLocal(root, entry)) continue;
    if (fs.existsSync(localPath(root, entry[0]))) throw new Error(`Local media changed; publish a new inventory: ${entry[0]}`);
    missing.push(entry);
  }
  if (missing.length && !media.config.publicOrigin) throw new Error('Missing media; CDN not yet configured');
  await parallel(missing, async entry => {
    const bytes = await download(media, entry, fetcher);
    const file = localPath(root, entry[0]);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(temporary, bytes, { flag: 'wx' });
      // Another worktree/process must never have its different edit replaced.
      fs.linkSync(temporary, file);
    } finally { fs.rmSync(temporary, { force: true }); }
  });
  log(`[site-media] ${media.manifest.files.length} checked, ${missing.length} restored without re-encoding.`);
}

function verifyLocal(root) {
  const media = readMedia(root);
  if (!media) return;
  for (const entry of media.manifest.files) if (!validLocal(root, entry)) throw new Error(`Media missing or changed: ${entry[0]}`);
  // Otherwise a new local asset would disappear when /img/* goes to the CDN.
  if (media.config.delivery === 'cdn' && inventory(root).release !== media.manifest.release) {
    throw new Error('Media inventory changed; upload and verify the new release before CDN delivery');
  }
}

function assertRemoteReceipt(root, media) {
  const file = path.join(root, 'docs-src/config/site-media-verification.json');
  if (!fs.existsSync(file)) throw new Error('Full CDN verification is required before CDN deployment');
  const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (receipt.release !== media.manifest.release || receipt.origin !== media.config.publicOrigin ||
      receipt.checked !== media.manifest.files.length || receipt.bytes !== media.manifest.files.reduce((s, row) => s + row[1], 0)) {
    throw new Error('A complete, matching CDN verification receipt is required');
  }
}

// CDN redirects make pixel-reading canvases and alpha masks cross-origin.
// Keep image requests and their preloads in the same anonymous CORS mode.
function mediaCorsHtml(html) {
  const annotate = (tag, kind, managedPicture = false) => {
    if (/\bcrossorigin\s*=/i.test(tag) || (!managedPicture && !/\/img\//.test(tag))) return tag;
    if (kind.toLowerCase() === 'link' && !/\bas=["']image["']/i.test(tag)) return tag;
    return tag.replace(/^(<(?:img|link))\b/i, '$1 crossorigin="anonymous"');
  };
  return html.replace(/<!--[\s\S]*?-->|<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)\s*>|<picture\b[^>]*>[\s\S]*?<\/picture\s*>|<(img|link)\b[^>]*>/gi, (tag, kind) => {
    if (kind) return annotate(tag, kind);
    // A picture may select CDN sources while its img fallback is an inline GIF.
    if (/^<picture\b/i.test(tag) && /\/img\//.test(tag)) {
      return tag.replace(/<img\b[^>]*>/gi, image => annotate(image, 'img', true));
    }
    return tag;
  });
}

function cdnRedirect(media) {
  return `/img/* ${media.config.publicOrigin.replace(/\/$/, '')}/releases/${media.manifest.release}/img/:splat 302`;
}

function publishedMediaPaths(root, docsDir) {
  const media = readMedia(root);
  if (!media || media.config.delivery !== 'cdn') return new Set();
  const lines = fs.readFileSync(path.join(docsDir, '_redirects'), 'utf8').split(/\r?\n/);
  return lines.includes(cdnRedirect(media)) ? media.paths : new Set();
}

module.exports = { CONFIG, MANIFEST, STATIC, MIME, sha256, readMedia, inventory, localPath,
  entriesDigest, publicUrl, mediaUrl, mediaRelativePath, rewriteMediaReferences, rewriteWebMedia, validLocal, parallel, download, hydrate, verifyLocal, assertRemoteReceipt, mediaCorsHtml, cdnRedirect, publishedMediaPaths };
