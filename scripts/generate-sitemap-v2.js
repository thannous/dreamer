#!/usr/bin/env node

/**
 * Sitemap Generator v2
 * Reads hreflang links from HTML files to map multilingual content
 * Generates accurate sitemap.xml with proper hreflang relationships
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const SITEMAP_PATH = path.join(DOCS_DIR, 'sitemap.xml');
const DOMAIN = 'https://noctalia.app';
const TODAY = new Date().toISOString().split('T')[0];

// Directories to exclude from sitemap
const EXCLUDED_DIRS = ['node_modules', '.git', 'auth'];

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

/**
 * Extract hreflang links from HTML content
 */
function extractHreflangsFromContent(content) {
  // Match hreflang link tags (support single or double quotes)
  const hreflangRegex = /<link\s+rel=(["'])alternate\1\s+hreflang=(["'])([^"']+)\2\s+href=(["'])([^"']+)\4/gi;
  const hreflangs = {};
  let match;

  while ((match = hreflangRegex.exec(content)) !== null) {
    const [, , , hreflang, , href] = match;
    hreflangs[hreflang] = normalizeUrl(href);
  }

  return hreflangs;
}

/**
 * Extract canonical URL from HTML content
 */
function extractCanonicalFromContent(content) {
  const canonicalRegex = /<link\s+rel=(["'])canonical\1\s+href=(["'])([^"']+)\2/i;
  const match = content.match(canonicalRegex);
  return match ? normalizeUrl(match[3]) : null;
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
function groupUrlsByContent(files) {
  const urlToHreflangs = new Map();

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
      urlToHreflangs.set(canonical, hreflangs);
    }
  }

  return urlToHreflangs;
}

/**
 * Generate XML for a URL entry with its hreflangs
 */
function generateUrlEntry(url, hreflangs) {
  let xml = '  <url>\n';
  xml += `    <loc>${escapeXml(url)}</loc>\n`;
  xml += `    <lastmod>${TODAY}</lastmod>\n`;

  // Add hreflang alternate links from the HTML file
  // Only add hreflangs that point to valid URLs
  if (hreflangs && typeof hreflangs === 'object') {
    for (const [hreflang, href] of Object.entries(hreflangs)) {
      if (href && href.startsWith('https://')) {
        xml += `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>\n`;
      }
    }
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
function generateSitemap(urlToHreflangs) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  // Sort URLs for consistent output
  const sortedUrls = Array.from(urlToHreflangs.keys()).sort();

  for (const url of sortedUrls) {
    const hreflangs = urlToHreflangs.get(url);
    xml += generateUrlEntry(url, hreflangs);
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

  // Group URLs by their hreflang relationships
  const urlToHreflangs = groupUrlsByContent(files);
  console.log(`✅ Extracted hreflang data from ${urlToHreflangs.size} URLs`);

  // Generate sitemap
  const sitemap = generateSitemap(urlToHreflangs);

  // Write sitemap
  fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');
  console.log(`✅ Sitemap generated successfully!`);
  console.log(`📍 Location: ${SITEMAP_PATH}`);
  console.log(`📊 URLs in sitemap: ${urlToHreflangs.size}`);

  // Analyze hreflang distribution
  let urlsWithHreflangs = 0;
  let multilingualCount = 0;
  const langCounts = {};

  for (const hreflangs of urlToHreflangs.values()) {
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

// Run the script
main();
