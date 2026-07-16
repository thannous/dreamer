#!/usr/bin/env node

/**
 * Sitemap Generator v2
 * Reads hreflang links from HTML files to map multilingual content.
 * For blog URLs, applies canonical hreflang relationships from
 * `data/content-manifest.json` when available.
 * Generates accurate sitemap.xml with proper hreflang relationships
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  getResponsiveImageData,
  readImageAssetRegistry,
} = require('./lib/image-seo-assets');

const REPO_ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(__dirname, '../docs');
const DOCS_SRC_DIR = path.join(REPO_ROOT, 'docs-src');
const SITEMAP_PATH = path.join(DOCS_DIR, 'sitemap.xml');
const CONTENT_MANIFEST_PATH = path.join(REPO_ROOT, 'data', 'content-manifest.json');
const SITE_MANIFEST_PATH = path.join(REPO_ROOT, 'data', 'site-manifest.json');
const SYMBOL_I18N_PATH = path.join(DOCS_DIR, 'data', 'symbol-i18n.json');
const IMAGE_ASSET_REGISTRY_PATH = path.join(DOCS_SRC_DIR, 'config', 'image-assets.json');
const DOMAIN = 'https://noctalia.app';

// Directories to exclude from sitemap
const EXCLUDED_DIRS = ['node_modules', '.git', 'auth'];

function formatIsoDate(date) {
  return date.toISOString().split('T')[0];
}

function toPosixPath(p) {
  return p.split(path.sep).join('/');
}

let cachedHeadLastmod = undefined;

function readGitIsoDate(args) {
  try {
    const out = execFileSync('git', args, {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    }).trim();
    if (!out) return null;
    return out;
  } catch (error) {
    const stdout =
      error && typeof error === 'object'
        ? typeof error.stdout === 'string'
          ? error.stdout
          : Buffer.isBuffer(error.stdout)
            ? error.stdout.toString('utf8')
            : null
        : null;

    const out = (stdout || '').trim();
    if (out) return out;
    return null;
  }
}

function getGitHeadLastmod() {
  if (cachedHeadLastmod !== undefined) return cachedHeadLastmod;
  const iso = readGitIsoDate(['log', '-1', '--format=%cI']);
  cachedHeadLastmod = iso ? iso.split('T')[0] : null;
  return cachedHeadLastmod;
}

function getLastmodFromFilesystem(fullPath) {
  try {
    const stats = fs.statSync(fullPath);
    return formatIsoDate(stats.mtime);
  } catch {
    return formatIsoDate(new Date());
  }
}

function getLastmodFromFilePath(fullPath) {
  const relPath = toPosixPath(path.relative(REPO_ROOT, fullPath));
  const iso = readGitIsoDate(['log', '-1', '--format=%cI', '--', relPath]);
  if (iso) return iso.split('T')[0];
  const head = getGitHeadLastmod();
  if (head) return head;
  return getLastmodFromFilesystem(fullPath);
}

/**
 * Recursively find all HTML files in docs directory
 */
function findHtmlFiles(dir, baseDir = '') {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(baseDir, entry.name);

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.includes(entry.name)) {
          continue;
        }
        files.push(...findHtmlFiles(fullPath, relativePath));
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        // Skip callback files
        if (!relativePath.includes('callback')) {
          files.push(relativePath);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return files;
}

/**
 * Normalize URLs to avoid index.html duplicates
 */
function normalizeUrl(url) {
  return url
    // Convert trailing /index.html to just /
    .replace(/\/index\.html$/, '/')
    // Convert trailing .html to clean URL
    .replace(/\.html$/, '');
}

function normalizeContentDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/);
  return match ? match[1] : null;
}

function normalizeManifestPathToUrl(manifestPath) {
  if (typeof manifestPath !== 'string' || manifestPath.trim() === '') return null;
  const normalizedPath = manifestPath.startsWith('/') ? manifestPath : `/${manifestPath}`;
  return normalizeUrl(`${DOMAIN}${normalizedPath}`);
}

function normalizeImageUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const imageUrl = value.trim();
  if (/^https:\/\//i.test(imageUrl)) return imageUrl;
  if (/^http:\/\//i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith('//')) return `https:${imageUrl}`;
  return `${DOMAIN}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}

function isGenericFallbackAsset(assetId, asset) {
  if (!asset || typeof asset !== 'object') return true;
  if (asset.genericFallback === true || asset.isFallback === true) return true;
  if (asset.purpose === 'fallback' || asset.role === 'fallback') return true;
  return /(?:^|[._-])(fallback|generic|default-og)(?:$|[._-])/i.test(assetId);
}

function getSitemapImageSource(registry, assetId, imageRef) {
  if (!registry || !assetId || !imageRef?.aspect) return null;
  const image = getResponsiveImageData(registry, assetId, imageRef.aspect);
  return normalizeImageUrl(image.src);
}

/**
 * Load the source image registry used by the HTML generators. Only assets that
 * are explicitly visible and eligible for sitemap submission are associated
 * with their canonical page URL. Missing registries keep the historical
 * sitemap behavior unchanged.
 */
function loadImageSitemapEntries(registryPath = IMAGE_ASSET_REGISTRY_PATH) {
  const result = {
    loaded: false,
    map: new Map(),
    pageCount: 0,
    imageCount: 0,
    error: null,
  };

  if (!fs.existsSync(registryPath)) return result;

  try {
    const registry = readImageAssetRegistry(registryPath);
    const assets = registry?.assets;
    const pages = registry?.pages;
    if (!assets || typeof assets !== 'object' || !pages || typeof pages !== 'object') {
      throw new Error('invalid assets or pages map');
    }

    for (const [pagePath, page] of Object.entries(pages)) {
      if (!page || typeof page !== 'object' || !page.images || typeof page.images !== 'object') {
        continue;
      }

      const pageUrl = normalizeManifestPathToUrl(pagePath);
      if (!pageUrl) continue;

      const imageUrls = new Set();
      for (const imageRef of Object.values(page.images)) {
        const assetId = typeof imageRef === 'string' ? imageRef : imageRef?.assetId;
        if (!assetId || (typeof imageRef === 'object' && imageRef?.visible === false)) continue;

        const asset = assets[assetId];
        if (
          !asset ||
          asset.visible !== true ||
          asset.sitemap !== true ||
          isGenericFallbackAsset(assetId, asset)
        ) {
          continue;
        }

        const imageUrl = getSitemapImageSource(registry, assetId, imageRef);
        if (imageUrl) imageUrls.add(imageUrl);
      }

      if (imageUrls.size > 0) {
        const images = Array.from(imageUrls);
        result.map.set(pageUrl, images);
        result.pageCount += 1;
        result.imageCount += images.length;
      }
    }

    result.loaded = true;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

function loadBlogManifestHreflangs() {
  const result = {
    loaded: false,
    map: new Map(),
    entryCount: 0,
    localizedUrlCount: 0,
    error: null,
  };

  if (!fs.existsSync(CONTENT_MANIFEST_PATH)) {
    return result;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(CONTENT_MANIFEST_PATH, 'utf8'));
    const entries = manifest?.collections?.blog?.entries;
    const languages = Array.isArray(manifest?.languages) ? manifest.languages : [];
    if (!entries || typeof entries !== 'object' || languages.length === 0) {
      throw new Error('invalid collections.blog.entries or languages');
    }

    for (const entry of Object.values(entries)) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.type !== 'blogArticle' && entry.type !== 'blogIndex') continue;

      const hreflangs = {};
      for (const lang of languages) {
        const href = normalizeManifestPathToUrl(entry?.locales?.[lang]?.path);
        if (href) {
          hreflangs[lang] = href;
        }
      }

      const xDefault = hreflangs.en || Object.values(hreflangs)[0];
      if (xDefault) {
        hreflangs['x-default'] = xDefault;
      }

      if (Object.keys(hreflangs).length === 0) continue;
      result.entryCount += 1;

      for (const lang of languages) {
        const pageUrl = hreflangs[lang];
        if (!pageUrl) continue;
        result.map.set(pageUrl, hreflangs);
        result.localizedUrlCount += 1;
      }
    }

    result.loaded = true;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

function loadManagedSourceLastmodPaths() {
  const result = {
    loaded: false,
    map: new Map(),
    error: null,
  };

  if (!fs.existsSync(SITE_MANIFEST_PATH)) {
    return result;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(SITE_MANIFEST_PATH, 'utf8'));
    const collections = [
      { entries: manifest?.collections?.pages?.entries, kind: 'pages' },
      { entries: manifest?.collections?.blog?.entries, kind: 'blog' },
    ];

    for (const { entries, kind } of collections) {
      if (!entries || typeof entries !== 'object') continue;

      for (const entry of Object.values(entries)) {
        if (!entry || typeof entry !== 'object') continue;

        for (const [lang, locale] of Object.entries(entry.locales || {})) {
          const pageUrl = normalizeManifestPathToUrl(locale?.path);
          if (!pageUrl) continue;

          const sourcePath = path.join(
            DOCS_SRC_DIR,
            'content',
            kind,
            entry.id,
            `${lang}.md`,
          );
          if (fs.existsSync(sourcePath)) {
            result.map.set(pageUrl, sourcePath);
          }
        }
      }
    }

    const guideSourcePath = path.join(REPO_ROOT, 'scripts', 'build-guides-pages.js');
    if (fs.existsSync(guideSourcePath)) {
      const symbolI18n = fs.existsSync(SYMBOL_I18N_PATH)
        ? JSON.parse(fs.readFileSync(SYMBOL_I18N_PATH, 'utf8'))
        : {};
      const languages = Array.isArray(manifest?.languages) ? manifest.languages : [];
      for (const lang of languages) {
        const guidePaths = [`/${lang}/guides/`];
        if (symbolI18n?.[lang]?.dictionary_slug) {
          guidePaths.push(`/${lang}/guides/${symbolI18n[lang].dictionary_slug}`);
        }

        for (const guidePath of guidePaths) {
          const pageUrl = normalizeManifestPathToUrl(guidePath);
          if (pageUrl) {
            result.map.set(pageUrl, guideSourcePath);
          }
        }
      }
    }

    result.loaded = true;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

/**
 * Extract hreflang links from HTML content
 */
function extractHreflangsFromContent(content) {
  // Match <link> tags that contain both hreflang and rel="alternate" in any attribute order
  const linkTagRegex = /<link\s[^>]*hreflang[^>]*>/gi;
  const hreflangs = {};
  let match;

  while ((match = linkTagRegex.exec(content)) !== null) {
    const tag = match[0];
    // Verify it's an alternate link
    if (!/rel=(["'])alternate\1/i.test(tag)) continue;
    // Extract hreflang value
    const hreflangMatch = tag.match(/hreflang=(["'])([^"']+)\1/i);
    // Extract href value
    const hrefMatch = tag.match(/href=(["'])([^"']+)\1/i);
    if (hreflangMatch && hrefMatch) {
      hreflangs[hreflangMatch[2]] = normalizeUrl(hrefMatch[2]);
    }
  }

  return hreflangs;
}

/**
 * Extract canonical URL from HTML content
 */
function extractCanonicalFromContent(content) {
  // Match <link> tags with rel="canonical" in any attribute order
  const linkTagRegex = /<link\s[^>]*rel=(["'])canonical\1[^>]*>/i;
  const match = content.match(linkTagRegex);
  if (!match) return null;
  const hrefMatch = match[0].match(/href=(["'])([^"']+)\1/i);
  return hrefMatch ? normalizeUrl(hrefMatch[2]) : null;
}

/**
 * Extract a page-owned modified date before falling back to generated file history.
 */
function extractLastmodFromContent(content) {
  const metaTagMatch = content.match(/<meta\s[^>]*property=(["'])article:modified_time\1[^>]*>/i);
  if (metaTagMatch) {
    const contentMatch = metaTagMatch[0].match(/content=(["'])([^"']+)\1/i);
    const metaDate = normalizeContentDate(contentMatch?.[2]);
    if (metaDate) return metaDate;
  }

  const jsonLdMatch = content.match(/"dateModified"\s*:\s*"([^"]+)"/);
  return normalizeContentDate(jsonLdMatch?.[1]);
}

function extractSymbolHeroImageFromContent(content) {
  const figureMatch = content.match(
    /<figure\b[^>]*data-image-seo-role=(['"])symbol-hero\1[^>]*>([\s\S]*?)<\/figure>/i
  );
  if (!figureMatch) return null;
  const imageMatch = figureMatch[2].match(/<img\b[^>]*\bsrc=(['"])([^'"]+)\1/i);
  return normalizeImageUrl(imageMatch?.[2]);
}

/**
 * Determine whether a page is indexable (so it can appear in sitemap)
 */
function isIndexable(content) {
  // Exclude meta refresh redirects (typically non-canonical stubs)
  if (/<meta\s+http-equiv=(["'])refresh\1/i.test(content)) {
    return false;
  }

  const robotsMatch = content.match(/<meta\s+name=(["'])robots\1\s+content=(["'])([^"']+)\2/i);
  if (!robotsMatch) {
    return true;
  }

  return !robotsMatch[3].toLowerCase().includes('noindex');
}

/**
 * Convert relative path to URL
 * Normalize index.html files to root paths to avoid duplicates
 */
function pathToUrl(filePath) {
  let urlPath = filePath.replace(/\\/g, '/');
  // Convert index.html to directory path (e.g., en/index.html → en/)
  urlPath = urlPath.replace(/index\.html$/, '');
  // Convert other .html pages to clean URLs (e.g., en/privacy-policy.html → en/privacy-policy)
  urlPath = urlPath.replace(/\.html$/, '');
  // Ensure we don't have double slashes
  urlPath = urlPath.replace(/\/+/g, '/');
  // Remove trailing slash for consistency, then it becomes the root
  if (urlPath === '/' || urlPath === '') {
    urlPath = '';
  }
  return normalizeUrl(`${DOMAIN}/${urlPath}`);
}

/**
 * Group URLs by their canonical relationship (same content in different languages)
 */
function groupUrlsByContent(files, sourceLastmodPaths = new Map()) {
  const urlToMeta = new Map();

  for (const file of files) {
    const fullPath = path.join(DOCS_DIR, file);
    let content = '';

    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch (error) {
      console.error(`Error reading file ${fullPath}:`, error.message);
      continue;
    }

    if (!isIndexable(content)) {
      continue;
    }

    const urlFromPath = pathToUrl(file);
    const canonical = extractCanonicalFromContent(content);

    // Only include canonical pages (sitemap, canonical and hreflang must tell the same story)
    if (!canonical || canonical !== urlFromPath) {
      continue;
    }

    const hreflangs = extractHreflangsFromContent(content);
    if (hreflangs && Object.keys(hreflangs).length > 0) {
      const sourceLastmodPath = sourceLastmodPaths.get(canonical);
      const symbolHeroImage = extractSymbolHeroImageFromContent(content);
      urlToMeta.set(canonical, {
        hreflangs,
        lastmod:
          extractLastmodFromContent(content) ||
          (sourceLastmodPath ? getLastmodFromFilePath(sourceLastmodPath) : getLastmodFromFilePath(fullPath)),
        images: symbolHeroImage ? [symbolHeroImage] : undefined,
      });
    }
  }

  return urlToMeta;
}

/**
 * Determine priority for a URL based on its type
 * @returns {string} Priority value (0.0 - 1.0)
 */
function getPriority(url) {
  // Homepage gets highest priority
  if (url.match(/^https:\/\/noctalia\.app\/(en|fr|es|de|it)\/?$/)) {
    return '1.0';
  }

  // Dictionary/guide hub pages get high priority
  if (url.includes('/guides/')) {
    return '0.8';
  }

  // About pages get medium-high priority
  if (url.includes('/about') || url.includes('/a-propos') || url.includes('/sobre') ||
      url.includes('/ueber-uns') || url.includes('/chi-siamo') || url.includes('/acerca-de')) {
    return '0.7';
  }

  // Blog posts get medium priority
  if (url.includes('/blog/')) {
    return '0.6';
  }

  // Symbol pages get medium priority
  if (url.includes('/symbols/') || url.includes('/symboles/') || url.includes('/simbolos/') ||
      url.includes('/traumsymbole/') || url.includes('/simboli/')) {
    return '0.6';
  }

  // Legal pages get lower priority
  if (url.includes('privacy') || url.includes('terms') || url.includes('legal') ||
      url.includes('politique') || url.includes('cgu') || url.includes('politica') ||
      url.includes('datenschutz') || url.includes('/agb') || url.includes('impressum') ||
      url.includes('note-legali') || url.includes('/termini') ||
      url.includes('account-deletion') || url.includes('suppression-compte') ||
      url.includes('eliminacion-cuenta') || url.includes('eliminazione-account') ||
      url.includes('konto')) {
    return '0.3';
  }

  // Default priority
  return '0.5';
}

/**
 * Generate XML for a URL entry with its hreflangs
 */
function generateUrlEntry(url, hreflangs, lastmod, images = []) {
  let xml = '  <url>\n';
  xml += `    <loc>${escapeXml(url)}</loc>\n`;
  if (lastmod) {
    xml += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
  }

  // Add priority hint to help crawlers prioritize pages
  const priority = getPriority(url);
  xml += `    <priority>${priority}</priority>\n`;

  // Add hreflang alternate links from the HTML file
  // Only add hreflangs that point to valid URLs
  if (hreflangs && typeof hreflangs === 'object') {
    for (const [hreflang, href] of Object.entries(hreflangs)) {
      if (href && href.startsWith('https://')) {
        xml += `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>\n`;
      }
    }
  }

  for (const imageUrl of new Set(Array.isArray(images) ? images : [])) {
    if (typeof imageUrl !== 'string' || !/^https?:\/\//i.test(imageUrl)) continue;
    xml += '    <image:image>\n';
    xml += `      <image:loc>${escapeXml(imageUrl)}</image:loc>\n`;
    xml += '    </image:image>\n';
  }

  xml += '  </url>\n';
  return xml;
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Generate the complete sitemap XML
 */
function generateSitemap(urlToMeta) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  const hasImages = Array.from(urlToMeta.values()).some(
    (meta) => Array.isArray(meta?.images) && meta.images.length > 0,
  );
  const imageNamespace = hasImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '';
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"${imageNamespace}>\n`;

  // Sort URLs for consistent output
  const sortedUrls = Array.from(urlToMeta.keys()).sort();

  for (const url of sortedUrls) {
    const meta = urlToMeta.get(url);
    xml += generateUrlEntry(url, meta?.hreflangs, meta?.lastmod, meta?.images);
  }

  xml += '</urlset>\n';
  return xml;
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Scanning docs directory for HTML files...');

  const files = findHtmlFiles(DOCS_DIR);
  console.log(`✅ Found ${files.length} HTML files`);

  const managedSources = loadManagedSourceLastmodPaths();
  if (managedSources.error) {
    console.warn(`⚠️  Could not load managed source paths: ${managedSources.error}`);
  } else if (managedSources.loaded) {
    console.log(`✅ Loaded managed source lastmod paths for ${managedSources.map.size} URLs`);
  }

  // Group URLs by their hreflang relationships
  const urlToMeta = groupUrlsByContent(files, managedSources.map);
  console.log(`✅ Extracted hreflang data from ${urlToMeta.size} URLs`);
  const renderedSymbolImageCount = [...urlToMeta.values()].filter(
    (meta) => Array.isArray(meta.images) && meta.images.length > 0
  ).length;
  if (renderedSymbolImageCount > 0) {
    console.log(`✅ Applied ${renderedSymbolImageCount} rendered symbol hero images to the sitemap`);
  }

  // Prefer canonical blog hreflangs from content-manifest when available
  const manifestBlog = loadBlogManifestHreflangs();
  if (manifestBlog.error) {
    console.warn(`⚠️  Could not load content manifest: ${manifestBlog.error}`);
  } else if (manifestBlog.loaded) {
    let appliedCount = 0;
    let missingInDocsCount = 0;

    for (const [blogUrl, hreflangs] of manifestBlog.map.entries()) {
      const meta = urlToMeta.get(blogUrl);
      if (!meta) {
        missingInDocsCount += 1;
        continue;
      }
      meta.hreflangs = hreflangs;
      appliedCount += 1;
    }

    console.log(
      `✅ Loaded blog hreflangs from content-manifest.json (${manifestBlog.entryCount} entries, ${manifestBlog.localizedUrlCount} localized URLs)`,
    );
    console.log(
      `✅ Applied canonical blog hreflangs to ${appliedCount} URLs (${missingInDocsCount} manifest URLs missing in docs scan)`,
    );
  } else {
    console.log('ℹ️  content-manifest.json not found, keeping HTML-derived hreflangs only');
  }

  const imageEntries = loadImageSitemapEntries();
  if (imageEntries.error) {
    console.warn(`⚠️  Could not load image asset registry: ${imageEntries.error}`);
  } else if (imageEntries.loaded) {
    let appliedPages = 0;
    let appliedImages = 0;
    for (const [pageUrl, images] of imageEntries.map.entries()) {
      const meta = urlToMeta.get(pageUrl);
      if (!meta) continue;
      meta.images = images;
      appliedPages += 1;
      appliedImages += images.length;
    }
    console.log(
      `✅ Applied ${appliedImages} sitemap images to ${appliedPages} canonical URLs from image-assets.json`,
    );
  }

  // Generate sitemap
  const sitemap = generateSitemap(urlToMeta);

  // Write sitemap
  fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');
  console.log(`✅ Sitemap generated successfully!`);
  console.log(`📍 Location: ${SITEMAP_PATH}`);
  console.log(`📊 URLs in sitemap: ${urlToMeta.size}`);

  // Analyze hreflang distribution
  let urlsWithHreflangs = 0;
  let multilingualCount = 0;
  const langCounts = {};

  for (const { hreflangs } of urlToMeta.values()) {
    if (Object.keys(hreflangs).length > 0) {
      urlsWithHreflangs++;
      const langCount = Object.keys(hreflangs).filter(h => h !== 'x-default').length;
      if (langCount > 1) {
        multilingualCount++;
      }
    }

    // Count languages
    for (const lang of Object.keys(hreflangs)) {
      if (lang !== 'x-default') {
        langCounts[lang] = (langCounts[lang] || 0) + 1;
      }
    }
  }

  console.log('\n📈 Hreflang Statistics:');
  console.log(`   URLs with hreflang data: ${urlsWithHreflangs}`);
  console.log(`   Multilingual URLs (2+ languages): ${multilingualCount}`);
  console.log(`   Language breakdown:`);
  Object.entries(langCounts).sort().forEach(([lang, count]) => {
    console.log(`      ${lang.toUpperCase()}: ${count} pages`);
  });
}

const legacyEntrypoint = path.join(__dirname, 'generate-sitemap.js');
if (require.main === module || require.main?.filename === legacyEntrypoint) {
  main();
}

module.exports = {
  extractSymbolHeroImageFromContent,
  generateSitemap,
  generateUrlEntry,
  getSitemapImageSource,
  isGenericFallbackAsset,
  loadImageSitemapEntries,
  normalizeImageUrl,
};
