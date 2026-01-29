#!/usr/bin/env node
/**
 * Static site checks for /docs output:
 * - Broken internal links (href/src) including clean URLs that map to .html files
 * - Missing symbol/category/curation pages based on data files
 * - Sitemap URLs that don't resolve to existing output files
 * - Basic canonical/hreflang and <html lang> consistency checks
 *
 * No network checks (external links are only reported, not validated).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DOCS_ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://noctalia.app';

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walkFiles(dirAbs, predicate) {
  const out = [];
  const stack = [dirAbs];
  const ignoreDirNames = new Set([
    // Not part of the published "output" site; contains placeholder tokens.
    'templates'
  ]);
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      // Skip typical noise
      if (ent.name === '.DS_Store') continue;
      if (ent.isDirectory() && ignoreDirNames.has(ent.name)) continue;
      const abs = path.join(current, ent.name);
      if (ent.isDirectory()) {
        stack.push(abs);
      } else if (!predicate || predicate(abs)) {
        out.push(abs);
      }
    }
  }
  return out;
}

function stripQueryAndHash(url) {
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  const end = Math.min(q === -1 ? url.length : q, h === -1 ? url.length : h);
  return url.slice(0, end);
}

function splitHash(url) {
  const idx = url.indexOf('#');
  if (idx === -1) return { base: url, hash: null };
  return { base: url.slice(0, idx), hash: url.slice(idx + 1) || null };
}

function isExternalUrl(url) {
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('//') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:') ||
    url.startsWith('data:') ||
    url.startsWith('javascript:')
  );
}

function isTemplateTokenUrl(url) {
  // Templates include {{...}} placeholders which shouldn't be validated as real links.
  return typeof url === 'string' && url.includes('{{');
}

function fileUrlPathFromRelHtml(relHtml) {
  // Convert a docs-relative file path to its clean URL path (no .html for content pages).
  // Examples:
  // - index.html -> /
  // - en/index.html -> /en/
  // - en/blog/index.html -> /en/blog/
  // - en/symbols/water.html -> /en/symbols/water
  const posix = toPosix(relHtml);
  if (!posix.endsWith('.html')) return null;

  if (posix === 'index.html') return '/';

  const parts = posix.split('/');
  const file = parts[parts.length - 1];
  const dir = parts.slice(0, -1).join('/');

  if (file === 'index.html') {
    return `/${dir}/`;
  }

  const baseName = file.replace(/\.html$/, '');
  return dir ? `/${dir}/${baseName}` : `/${baseName}`;
}

function resolveUrlPathToFileRel(urlPath) {
  // Map a clean URL path to an on-disk file path relative to DOCS_ROOT.
  // Supports:
  // - /en/symbols/water -> en/symbols/water.html
  // - /en/blog/ -> en/blog/index.html
  // - /css/styles.min.css -> css/styles.min.css
  // - / -> index.html
  // Returns null if it can't be mapped.
  if (!urlPath) return null;
  if (!urlPath.startsWith('/')) return null;

  const clean = urlPath.split('?')[0].split('#')[0];
  if (clean === '/') return 'index.html';

  // Remove leading slash for filesystem relative.
  const noLead = clean.replace(/^\/+/, '');

  // If trailing slash, prefer index.html under that directory.
  if (noLead.endsWith('/')) {
    return `${noLead}index.html`;
  }

  // If it already has an extension, treat as a direct file reference.
  if (path.posix.extname(noLead)) {
    return noLead;
  }

  // Clean URL: try .html first, then /index.html.
  const asHtml = `${noLead}.html`;
  const asIndex = `${noLead}/index.html`;

  if (fs.existsSync(path.join(DOCS_ROOT, asHtml))) return asHtml;
  if (fs.existsSync(path.join(DOCS_ROOT, asIndex))) return asIndex;

  // Could still be a file without extension (rare). Accept only if it exists.
  if (fs.existsSync(path.join(DOCS_ROOT, noLead))) return noLead;

  // Fall back to .html mapping even if it doesn't exist (caller will report missing)
  return asHtml;
}

function resolveRelativeUrl(fromFileRelHtml, relOrAbsUrl) {
  // Returns a clean URL path (leading slash), not including origin.
  if (!relOrAbsUrl) return null;

  if (relOrAbsUrl.startsWith('#')) {
    // Anchor-only link: base is current page.
    return fileUrlPathFromRelHtml(fromFileRelHtml) || null;
  }

  if (relOrAbsUrl.startsWith('/')) return relOrAbsUrl;

  // Relative to the current file's URL directory.
  const fromUrl = fileUrlPathFromRelHtml(fromFileRelHtml);
  if (!fromUrl) return null;
  const baseDir = fromUrl.endsWith('/') ? fromUrl : fromUrl.slice(0, fromUrl.lastIndexOf('/') + 1);
  return path.posix.resolve(baseDir, relOrAbsUrl);
}

function extractAttrUrls(html) {
  // Very small, dependency-free extraction.
  const urls = [];
  const re = /\s(?:href|src)=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) urls.push(m[1]);
  return urls;
}

function extractCanonicalUrl(html) {
  const m = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  return m ? m[1] : null;
}

function extractHtmlLang(html) {
  const m = html.match(/<html\s+[^>]*lang=["']([^"']+)["'][^>]*>/i);
  return m ? m[1] : null;
}

function isNoindex(html) {
  // Best-effort: treat any robots meta containing "noindex" as noindex.
  return /<meta\s+[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["'][^>]*>/i.test(html);
}

function extractHreflangAlternates(html) {
  const out = [];
  const re = /<link\s+[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) out.push({ hreflang: m[1], href: m[2] });
  return out;
}

function expectedCanonicalForFile(relHtml) {
  const urlPath = fileUrlPathFromRelHtml(relHtml);
  if (!urlPath) return null;
  return `${SITE_ORIGIN}${urlPath}`;
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(DOCS_ROOT, relPath), 'utf8'));
}

function readText(relPath) {
  return fs.readFileSync(path.join(DOCS_ROOT, relPath), 'utf8');
}

function existsRel(relPath) {
  return fs.existsSync(path.join(DOCS_ROOT, relPath));
}

function normalizeUrlToPathMaybe(url) {
  if (!url) return null;
  if (url.startsWith(SITE_ORIGIN)) {
    const u = new URL(url);
    return u.pathname + (u.search || '') + (u.hash || '');
  }
  if (url.startsWith('/')) return url;
  return null;
}

function main() {
  const htmlFilesAbs = walkFiles(DOCS_ROOT, (p) => p.endsWith('.html'));
  const htmlFilesRel = htmlFilesAbs.map((p) => path.relative(DOCS_ROOT, p)).sort();

  const errors = [];
  const warnings = [];

  const contentCache = new Map(); // fileRel -> string
  const anchorsCache = new Map(); // fileRel -> Set(ids/names)

  function getHtml(relFile) {
    if (!contentCache.has(relFile)) {
      contentCache.set(relFile, fs.readFileSync(path.join(DOCS_ROOT, relFile), 'utf8'));
    }
    return contentCache.get(relFile);
  }

  function getAnchors(relFile) {
    if (anchorsCache.has(relFile)) return anchorsCache.get(relFile);
    const html = getHtml(relFile);
    const ids = new Set();
    const idRe = /\sid=["']([^"']+)["']/g;
    const nameRe = /\sname=["']([^"']+)["']/g;
    let m;
    while ((m = idRe.exec(html))) ids.add(m[1]);
    while ((m = nameRe.exec(html))) ids.add(m[1]);
    anchorsCache.set(relFile, ids);
    return ids;
  }

  // 1) Per-page consistency + internal link checks
  let totalInternalLinks = 0;
  let totalExternalLinks = 0;

  for (const relHtml of htmlFilesRel) {
    const html = getHtml(relHtml);

    const declaredLang = extractHtmlLang(html);
    const topDir = toPosix(relHtml).split('/')[0];
    if (topDir === 'en' || topDir === 'fr' || topDir === 'es') {
      if (declaredLang && declaredLang !== topDir) {
        errors.push({
          type: 'lang-mismatch',
          file: relHtml,
          detail: `<html lang="${declaredLang}"> but file is under /${topDir}/`
        });
      }
    }

    const canonical = extractCanonicalUrl(html);
    const expectedCanonical = expectedCanonicalForFile(relHtml);
    if (canonical && expectedCanonical && canonical !== expectedCanonical) {
      errors.push({
        type: 'canonical-mismatch',
        file: relHtml,
        detail: `canonical="${canonical}" expected="${expectedCanonical}"`
      });
    }

    // Hreflang alternates should resolve to existing files (clean URL mapping).
    for (const alt of extractHreflangAlternates(html)) {
      const urlPath = normalizeUrlToPathMaybe(alt.href);
      if (!urlPath) continue;
      const targetRel = resolveUrlPathToFileRel(urlPath);
      if (targetRel && !existsRel(targetRel)) {
        errors.push({
          type: 'hreflang-missing',
          file: relHtml,
          detail: `hreflang="${alt.hreflang}" href="${alt.href}" -> missing "${targetRel}"`
        });
      }
    }

    const attrUrls = extractAttrUrls(html);
    for (const rawUrl of attrUrls) {
      if (!rawUrl) continue;
      if (isTemplateTokenUrl(rawUrl)) continue;

      if (isExternalUrl(rawUrl)) {
        totalExternalLinks += 1;
        continue;
      }

      totalInternalLinks += 1;

      // Anchor-only within current file
      if (rawUrl.startsWith('#')) {
        const anchor = rawUrl.slice(1);
        if (anchor) {
          const anchors = getAnchors(relHtml);
          if (!anchors.has(anchor)) {
            warnings.push({
              type: 'missing-anchor',
              file: relHtml,
              detail: `#${anchor}`
            });
          }
        }
        continue;
      }

      const { base, hash } = splitHash(rawUrl);
      const baseNoQuery = stripQueryAndHash(base);
      const urlPath = resolveRelativeUrl(relHtml, baseNoQuery);
      if (!urlPath) continue;
      const targetRel = resolveUrlPathToFileRel(urlPath);
      if (targetRel && !existsRel(targetRel)) {
        errors.push({
          type: 'broken-link',
          file: relHtml,
          detail: `${rawUrl} -> ${targetRel}`
        });
        continue;
      }

      // If there's an anchor, verify it exists in the target (best-effort).
      if (hash && targetRel && existsRel(targetRel)) {
        const anchors = getAnchors(targetRel);
        if (!anchors.has(hash)) {
          warnings.push({
            type: 'missing-anchor',
            file: relHtml,
            detail: `${rawUrl} -> ${targetRel} missing #${hash}`
          });
        }
      }
    }
  }

  // 2) Data-driven checks
  const symbols = readJson('data/dream-symbols.json');
  const i18n = readJson('data/symbol-i18n.json');
  const curation = readJson('data/curation-pages.json');

  const symbolList = symbols.symbols || [];
  const expectedSymbolFiles = [];
  const slugSets = { en: new Set(), fr: new Set(), es: new Set() };

  for (const s of symbolList) {
    for (const lang of ['en', 'fr', 'es']) {
      const slug = s?.[lang]?.slug;
      if (!slug) {
        errors.push({
          type: 'missing-symbol-slug',
          file: 'data/dream-symbols.json',
          detail: `symbol id="${s.id}" missing ${lang}.slug`
        });
        continue;
      }
      if (slugSets[lang].has(slug)) {
        errors.push({
          type: 'duplicate-symbol-slug',
          file: 'data/dream-symbols.json',
          detail: `duplicate ${lang}.slug="${slug}"`
        });
      }
      slugSets[lang].add(slug);
    }
  }

  for (const s of symbolList) {
    expectedSymbolFiles.push(`en/symbols/${s.en.slug}.html`);
    expectedSymbolFiles.push(`fr/symboles/${s.fr.slug}.html`);
    expectedSymbolFiles.push(`es/simbolos/${s.es.slug}.html`);
  }

  for (const rel of expectedSymbolFiles) {
    if (!existsRel(rel)) {
      errors.push({ type: 'missing-symbol-page', file: rel, detail: 'expected symbol page missing' });
    }
  }

  // Category pages (8 categories per lang)
  for (const lang of ['en', 'fr', 'es']) {
    const slugs = i18n?.[lang]?.category_slugs;
    if (!slugs || typeof slugs !== 'object') continue;
    const outDir = lang === 'en' ? 'en/symbols' : lang === 'fr' ? 'fr/symboles' : 'es/simbolos';
    for (const catId of Object.keys(slugs)) {
      const slug = slugs[catId];
      const rel = `${outDir}/${slug}.html`;
      if (!existsRel(rel)) {
        errors.push({
          type: 'missing-category-page',
          file: rel,
          detail: `missing category page for ${lang} category "${catId}" slug="${slug}"`
        });
      }
    }
  }

  // Curation guide pages
  const symbolIds = new Set(symbolList.map((s) => s.id));
  for (const page of curation.pages || []) {
    // Ensure referenced symbols exist
    for (const id of page.symbols || []) {
      if (!symbolIds.has(id)) {
        errors.push({
          type: 'curation-unknown-symbol',
          file: 'data/curation-pages.json',
          detail: `curation id="${page.id}" references unknown symbol id="${id}"`
        });
      }
    }
    const relEn = `en/guides/${page.slugs.en}.html`;
    const relFr = `fr/guides/${page.slugs.fr}.html`;
    const relEs = `es/guides/${page.slugs.es}.html`;
    for (const rel of [relEn, relFr, relEs]) {
      if (!existsRel(rel)) {
        errors.push({ type: 'missing-curation-page', file: rel, detail: `missing curation page for "${page.id}"` });
      }
    }
  }

  // 3) Sitemap URLs resolve to existing files
  const sitemap = readText('sitemap.xml');
  const locRe = /<loc>([^<]+)<\/loc>/g;
  let m;
  let sitemapCount = 0;
  while ((m = locRe.exec(sitemap))) {
    sitemapCount += 1;
    const loc = m[1].trim();
    if (!loc.startsWith(SITE_ORIGIN)) continue;
    const u = new URL(loc);
    const urlPath = u.pathname.endsWith('/') ? u.pathname : u.pathname;
    const rel = resolveUrlPathToFileRel(urlPath);
    if (rel && !existsRel(rel)) {
      errors.push({
        type: 'sitemap-missing',
        file: 'sitemap.xml',
        detail: `${loc} -> missing "${rel}"`
      });
    }
  }

  // 4) Quick orphan check (optional): pages that exist but aren't in sitemap.
  // This is only a warning because the sitemap may intentionally omit pages.
  const sitemapUrlPaths = new Set();
  locRe.lastIndex = 0;
  while ((m = locRe.exec(sitemap))) {
    const loc = m[1].trim();
    if (!loc.startsWith(SITE_ORIGIN)) continue;
    const u = new URL(loc);
    sitemapUrlPaths.add(u.pathname);
  }

  const sitemapMissingPages = [];
  for (const relHtml of htmlFilesRel) {
    const urlPath = fileUrlPathFromRelHtml(relHtml);
    if (!urlPath) continue;
    // Skip obvious utility pages.
    if (relHtml === '404.html') continue;
    // Skip pages that explicitly opt out of indexing (common for auth flows and root redirect stubs).
    if (isNoindex(getHtml(relHtml))) continue;
    // Canonical paths sometimes include trailing slash for index.html.
    const p1 = urlPath.endsWith('/') ? urlPath : urlPath;
    const p2 = urlPath.endsWith('/') ? urlPath.slice(0, -1) : `${urlPath}/`;
    if (!sitemapUrlPaths.has(p1) && !sitemapUrlPaths.has(p2)) {
      sitemapMissingPages.push(relHtml);
    }
  }
  if (sitemapMissingPages.length) {
    warnings.push({
      type: 'not-in-sitemap',
      file: 'sitemap.xml',
      detail: `${sitemapMissingPages.length} HTML pages not found in sitemap (example: ${sitemapMissingPages[0]})`
    });
  }

  // Output
  const summary = {
    htmlPages: htmlFilesRel.length,
    internalLinks: totalInternalLinks,
    externalLinks: totalExternalLinks,
    sitemapUrls: sitemapCount,
    errors: errors.length,
    warnings: warnings.length
  };

  console.log('Noctalia docs site check');
  console.log(JSON.stringify(summary, null, 2));

  function printItems(title, items, limit = 50) {
    if (!items.length) return;
    console.log(`\n${title} (${items.length})`);
    for (const it of items.slice(0, limit)) {
      console.log(`- [${it.type}] ${it.file}: ${it.detail}`);
    }
    if (items.length > limit) {
      console.log(`... and ${items.length - limit} more`);
    }
  }

  printItems('Errors', errors);
  printItems('Warnings', warnings);

  if (errors.length) process.exit(1);
}

main();
