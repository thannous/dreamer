#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Checks `docs/` for broken internal links (and optionally external links).
 *
 * Usage:
 *   node scripts/check-docs-links.js
 *   node scripts/check-docs-links.js --external
 *
 * Options:
 *   --docs-dir=path         Defaults to ./docs
 *   --external              Also checks http(s) external links
 *   --concurrency=N         External link concurrency (default: 8)
 *   --timeout-ms=N          External link timeout in ms (default: 10000)
 *   --max-external=N        Limit number of external URLs checked
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CONCURRENCY = 8;
const INTERNAL_HOSTS = new Set(['noctalia.app', 'www.noctalia.app']);

function parseArg(prefix) {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walkFiles(dirAbs) {
  const results = [];
  const stack = [dirAbs];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        stack.push(full);
        continue;
      }
      if (entry.isFile()) results.push(full);
    }
  }
  return results;
}

function stripQueryAndHash(raw) {
  const hashIndex = raw.indexOf('#');
  const queryIndex = raw.indexOf('?');
  const cut = Math.min(
    hashIndex === -1 ? raw.length : hashIndex,
    queryIndex === -1 ? raw.length : queryIndex
  );
  return raw.slice(0, cut);
}

function splitHash(raw) {
  const hashIndex = raw.indexOf('#');
  if (hashIndex === -1) return { withoutHash: raw, hash: '' };
  return { withoutHash: raw.slice(0, hashIndex), hash: raw.slice(hashIndex + 1) };
}

function isSkippableUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('mailto:')) return true;
  if (lower.startsWith('tel:')) return true;
  if (lower.startsWith('sms:')) return true;
  if (lower.startsWith('javascript:')) return true;
  if (lower.startsWith('data:')) return true;
  return false;
}

function hasExtension(posixPath) {
  const base = path.posix.basename(posixPath);
  return base.includes('.') && !base.startsWith('.');
}

function normalizeInternalPath(posixPath) {
  const cleaned = String(posixPath || '').replace(/\0/g, '');
  const normalized = path.posix.normalize(cleaned);
  if (normalized === '.') return '';
  return normalized;
}

function resolvePrettyUrlToFile(relativeFilesSet, urlPathPosix) {
  const urlPath = normalizeInternalPath(urlPathPosix);
  const withoutLeading = urlPath.replace(/^\/+/, '');

  if (!withoutLeading || withoutLeading === '') {
    return relativeFilesSet.has('index.html') ? 'index.html' : null;
  }

  if (urlPath.endsWith('/')) {
    const candidate = `${withoutLeading}index.html`;
    return relativeFilesSet.has(candidate) ? candidate : null;
  }

  if (hasExtension(urlPath)) {
    return relativeFilesSet.has(withoutLeading) ? withoutLeading : null;
  }

  const htmlCandidate = `${withoutLeading}.html`;
  if (relativeFilesSet.has(htmlCandidate)) return htmlCandidate;

  const indexCandidate = `${withoutLeading}/index.html`;
  if (relativeFilesSet.has(indexCandidate)) return indexCandidate;

  return null;
}

function isHttpUrl(raw) {
  const lower = String(raw || '').toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('//');
}

function toExternalUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

function classifyUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (isSkippableUrl(trimmed)) return { kind: 'skip' };
  if (trimmed.startsWith('#')) return { kind: 'internal-fragment', fragment: trimmed.slice(1) };
  if (isHttpUrl(trimmed)) {
    try {
      const u = new URL(toExternalUrl(trimmed));
      if (INTERNAL_HOSTS.has(u.hostname)) {
        const pathname = u.pathname || '/';
        const ext = path.posix.extname(pathname).toLowerCase();
        const looksLikePage = pathname.endsWith('/') || ext === '' || ext === '.html';
        if (looksLikePage) {
          return { kind: 'internal', path: pathname, fragment: (u.hash || '').replace(/^#/, '') };
        }
        return { kind: 'external', url: u.toString() };
      }
      return { kind: 'external', url: u.toString() };
    } catch {
      return { kind: 'invalid', raw: trimmed };
    }
  }
  const { withoutHash, hash } = splitHash(trimmed);
  const withoutQueryAndHash = stripQueryAndHash(withoutHash);
  return { kind: 'internal', path: withoutQueryAndHash, fragment: hash };
}

function extractLinksFromHtml(content) {
  const dom = new JSDOM(content);
  const { document } = dom.window;

  const links = [];

  const pushAttr = (selector, attr) => {
    for (const el of document.querySelectorAll(selector)) {
      const value = el.getAttribute(attr);
      if (value) links.push({ raw: value, tag: el.tagName.toLowerCase(), attr });
    }
  };

  pushAttr('a[href]', 'href');
  pushAttr('link[href]', 'href');
  pushAttr('script[src]', 'src');
  pushAttr('img[src]', 'src');
  pushAttr('source[src]', 'src');

  for (const el of document.querySelectorAll('img[srcset], source[srcset]')) {
    const srcset = el.getAttribute('srcset');
    if (!srcset) continue;
    const parts = srcset.split(',');
    for (const part of parts) {
      const candidate = part.trim().split(/\s+/)[0];
      if (candidate) links.push({ raw: candidate, tag: el.tagName.toLowerCase(), attr: 'srcset' });
    }
  }

  // Common social meta images
  for (const meta of document.querySelectorAll('meta[property="og:image"][content], meta[name="twitter:image"][content]')) {
    const value = meta.getAttribute('content');
    if (value) links.push({ raw: value, tag: 'meta', attr: 'content' });
  }

  return links;
}

function extractAnchorsFromHtml(content) {
  const dom = new JSDOM(content);
  const { document } = dom.window;
  const ids = new Set();
  for (const el of document.querySelectorAll('[id]')) {
    const id = el.getAttribute('id');
    if (id) ids.add(id);
  }
  for (const el of document.querySelectorAll('a[name]')) {
    const name = el.getAttribute('name');
    if (name) ids.add(name);
  }
  return ids;
}

async function checkExternalUrl(url, { timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (res.status === 405 || res.status === 501) {
      const res2 = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
      return { ok: res2.status < 400 || res2.status === 401 || res2.status === 403, status: res2.status };
    }
    return { ok: res.status < 400 || res.status === 401 || res.status === 403, status: res.status };
  } catch (error) {
    return { ok: false, status: 0, error: String(error && error.message ? error.message : error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const i = index++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.max(1, limit) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const docsDirArg = parseArg('--docs-dir=');
  const docsDirAbs = path.resolve(docsDirArg || path.join(__dirname, '../docs'));
  const checkExternal = process.argv.includes('--external');
  const timeoutMs = Number(parseArg('--timeout-ms=')) || DEFAULT_TIMEOUT_MS;
  const concurrency = Number(parseArg('--concurrency=')) || DEFAULT_CONCURRENCY;
  const maxExternalRaw = parseArg('--max-external=');
  const maxExternal = maxExternalRaw ? Math.max(0, Number(maxExternalRaw)) : Infinity;

  if (!fs.existsSync(docsDirAbs)) {
    console.error(`❌ docs dir not found: ${docsDirAbs}`);
    process.exit(1);
  }

  const allFilesAbs = walkFiles(docsDirAbs);
  const relativeFiles = allFilesAbs.map((abs) => toPosix(path.relative(docsDirAbs, abs)));
  const relativeFilesSet = new Set(relativeFiles);
  const htmlFiles = relativeFiles.filter((p) => p.toLowerCase().endsWith('.html'));

  console.log(`Scanning: ${docsDirAbs}`);
  console.log(`- HTML pages: ${htmlFiles.length}`);
  console.log(`- Total files: ${relativeFiles.length}`);
  console.log(`- External check: ${checkExternal ? 'ON' : 'OFF'}`);

  const anchorsCache = new Map(); // rel html path -> Set(ids)
  const readHtml = (rel) => fs.readFileSync(path.join(docsDirAbs, rel), 'utf8');
  const getAnchorsFor = (rel) => {
    if (!anchorsCache.has(rel)) anchorsCache.set(rel, extractAnchorsFromHtml(readHtml(rel)));
    return anchorsCache.get(rel);
  };

  const brokenInternal = [];
  const externalUrls = new Set();
  let totalLinkRefs = 0;

  for (const pageRel of htmlFiles) {
    const content = readHtml(pageRel);
    const pageDirPosix = path.posix.dirname(toPosix(pageRel));
    const pageAnchors = getAnchorsFor(pageRel);

    const extracted = extractLinksFromHtml(content);
    totalLinkRefs += extracted.length;

    for (const link of extracted) {
      const classified = classifyUrl(link.raw);
      if (classified.kind === 'skip') continue;

      if (classified.kind === 'invalid') {
        brokenInternal.push({
          type: 'invalid-url',
          from: pageRel,
          raw: link.raw
        });
        continue;
      }

      if (classified.kind === 'external') {
        if (checkExternal && externalUrls.size < maxExternal) externalUrls.add(classified.url);
        continue;
      }

      // Internal fragment on current page
      if (classified.kind === 'internal-fragment') {
        const fragment = classified.fragment;
        if (fragment && !pageAnchors.has(fragment)) {
          brokenInternal.push({
            type: 'missing-anchor',
            from: pageRel,
            raw: link.raw,
            target: pageRel,
            fragment
          });
        }
        continue;
      }

      // Internal link
      const internalPath = classified.path || '';
      const fragment = classified.fragment || '';

      const isRootRelative = internalPath.startsWith('/');
      const base = isRootRelative ? '' : pageDirPosix === '.' ? '' : `${pageDirPosix}/`;
      const combined = normalizeInternalPath(isRootRelative ? internalPath : `${base}${internalPath}`);

      const targetFileRel = resolvePrettyUrlToFile(relativeFilesSet, combined);
      if (!targetFileRel) {
        brokenInternal.push({
          type: 'missing-target',
          from: pageRel,
          raw: link.raw,
          resolvedPath: combined
        });
        continue;
      }

      if (fragment && targetFileRel.toLowerCase().endsWith('.html')) {
        const anchors = getAnchorsFor(targetFileRel);
        if (!anchors.has(fragment)) {
          brokenInternal.push({
            type: 'missing-anchor',
            from: pageRel,
            raw: link.raw,
            target: targetFileRel,
            fragment
          });
        }
      }
    }
  }

  // External checks
  const brokenExternal = [];
  if (checkExternal && externalUrls.size > 0) {
    const list = [...externalUrls];
    console.log(`\nChecking external URLs: ${list.length} (concurrency=${concurrency}, timeoutMs=${timeoutMs})`);

    const results = await mapLimit(list, concurrency, async (url) => {
      const res = await checkExternalUrl(url, { timeoutMs });
      return { url, ...res };
    });

    for (const r of results) {
      if (!r.ok) brokenExternal.push(r);
    }
  }

  // Report
  const missingTargets = brokenInternal.filter((b) => b.type === 'missing-target');
  const missingAnchors = brokenInternal.filter((b) => b.type === 'missing-anchor');
  const invalidUrls = brokenInternal.filter((b) => b.type === 'invalid-url');

  console.log('\nResults');
  console.log('-------');
  console.log(`Link references scanned: ${totalLinkRefs}`);
  console.log(`Broken internal: ${brokenInternal.length} (missing target=${missingTargets.length}, missing anchor=${missingAnchors.length}, invalid=${invalidUrls.length})`);
  if (checkExternal) {
    console.log(`Broken external: ${brokenExternal.length}`);
  }

  if (brokenInternal.length > 0) {
    console.log('\nBroken internal links');
    for (const b of brokenInternal.slice(0, 200)) {
      if (b.type === 'missing-target') {
        console.log(`- [missing target] from=${b.from} href=${b.raw} resolved=${b.resolvedPath}`);
      } else if (b.type === 'missing-anchor') {
        console.log(`- [missing anchor] from=${b.from} href=${b.raw} target=${b.target} #${b.fragment}`);
      } else {
        console.log(`- [invalid url] from=${b.from} href=${b.raw}`);
      }
    }
    if (brokenInternal.length > 200) console.log(`... ${brokenInternal.length - 200} more`);
  }

  if (checkExternal && brokenExternal.length > 0) {
    console.log('\nBroken external links');
    for (const b of brokenExternal.slice(0, 200)) {
      console.log(`- [${b.status || 'ERR'}] ${b.url}${b.error ? ` (${b.error})` : ''}`);
    }
    if (brokenExternal.length > 200) console.log(`... ${brokenExternal.length - 200} more`);
  }

  const shouldFail = brokenInternal.length > 0 || (checkExternal && brokenExternal.length > 0);
  if (shouldFail) process.exit(1);

  console.log('\n✅ No broken links detected.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
