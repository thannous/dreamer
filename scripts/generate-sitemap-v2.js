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
 * Extract hreflang links from HTML file
 */
function extractHreflangs(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Match hreflang link tags
    const hreflangRegex = /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"/g;
    const hreflangs = {};
    let match;

    while ((match = hreflangRegex.exec(content)) !== null) {
      const [, hreflang, href] = match;
      hreflangs[hreflang] = href;
    }

    return hreflangs;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return {};
  }
}

/**
 * Convert relative path to URL
 */
function pathToUrl(filePath) {
  return `${DOMAIN}/${filePath.replace(/\\/g, '/')}`;
}

/**
 * Group URLs by their canonical relationship (same content in different languages)
 */
function groupUrlsByContent(files) {
  const urlToHreflangs = new Map();
  const processedUrls = new Set();

  for (const file of files) {
    const fullPath = path.join(DOCS_DIR, file);
    const hreflangs = extractHreflangs(fullPath);
    const url = pathToUrl(file);

    if (hreflangs && Object.keys(hreflangs).length > 0) {
      // Store the hreflang data we found
      urlToHreflangs.set(url, hreflangs);
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
