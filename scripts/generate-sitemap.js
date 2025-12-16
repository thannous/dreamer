#!/usr/bin/env node

/**
 * Sitemap Generator Script
 * Automatically generates sitemap.xml by scanning docs/ directory
 * Maintains hreflang tags for multilingual content (FR, EN, ES)
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const SITEMAP_PATH = path.join(DOCS_DIR, 'sitemap.xml');
const DOMAIN = 'https://noctalia.app';
const TODAY = new Date().toISOString().split('T')[0];

// Directories to exclude from sitemap
const EXCLUDED_DIRS = ['node_modules', '.git', 'auth'];

// File to exclude (like callbacks that shouldn't be indexed)
const EXCLUDED_FILES = ['callback', 'auth'];

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
        // Skip excluded directories
        if (EXCLUDED_DIRS.includes(entry.name)) {
          continue;
        }
        files.push(...findHtmlFiles(fullPath, relativePath));
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        // Skip excluded files
        if (EXCLUDED_FILES.some(excluded => relativePath.includes(excluded))) {
          continue;
        }
        files.push(relativePath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return files;
}

/**
 * Group files by their language-neutral path
 * Example: fr/blog/comment-se-souvenir-de-ses-reves.html and en/blog/how-to-remember-dreams.html
 * should be grouped together for hreflang alternates
 */
function groupFilesByContent(files) {
  const groups = new Map();

  files.forEach(file => {
    // Extract language (first component of path)
    const parts = file.split(path.sep);
    const lang = parts[0];

    // Skip non-language directories
    if (!['fr', 'en', 'es'].includes(lang)) {
      return;
    }

    // Get the rest of the path without language
    const contentPath = parts.slice(1).join('/');

    if (!groups.has(contentPath)) {
      groups.set(contentPath, {});
    }

    groups.get(contentPath)[lang] = file;
  });

  return groups;
}

/**
 * Get all languages available for a content piece
 */
function getAvailableLanguages(group) {
  return Object.keys(group).sort();
}

/**
 * Generate hreflang links for a URL group
 */
function generateHreflangs(group, contentPath) {
  const langs = getAvailableLanguages(group);
  const hreflangs = [];

  // Add hreflangs for all available languages
  langs.forEach(lang => {
    const filePath = group[lang];
    const url = `${DOMAIN}/${filePath.replace(/\\/g, '/')}`;
    hreflangs.push({
      rel: 'alternate',
      hreflang: lang,
      href: url
    });
  });

  // Add x-default pointing to English (or first available)
  const defaultLang = langs.includes('en') ? 'en' : langs[0];
  const defaultUrl = `${DOMAIN}/${group[defaultLang].replace(/\\/g, '/')}`;
  hreflangs.push({
    rel: 'alternate',
    hreflang: 'x-default',
    href: defaultUrl
  });

  return hreflangs;
}

/**
 * Generate XML for a single URL entry
 */
function generateUrlEntry(url, hreflangs) {
  let xml = '  <url>\n';
  xml += `    <loc>${escapeXml(url)}</loc>\n`;
  xml += `    <lastmod>${TODAY}</lastmod>\n`;

  // Add hreflang alternate links
  hreflangs.forEach(link => {
    xml += `    <xhtml:link rel="${link.rel}" hreflang="${link.hreflang}" href="${escapeXml(link.href)}"/>\n`;
  });

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
function generateSitemap(groups) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  // Sort content paths for consistent output
  const sortedPaths = Array.from(groups.keys()).sort();

  sortedPaths.forEach(contentPath => {
    const group = groups.get(contentPath);
    const langs = getAvailableLanguages(group);

    // Use the first available language's path as the main URL
    const mainLang = langs.includes('en') ? 'en' : (langs.includes('fr') ? 'fr' : langs[0]);
    const mainUrl = `${DOMAIN}/${group[mainLang].replace(/\\/g, '/')}`;

    // Generate hreflang links
    const hreflangs = generateHreflangs(group, contentPath);

    // Only add one entry per content piece (will have all hreflang alternatives)
    xml += generateUrlEntry(mainUrl, hreflangs);
  });

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

  // Group files by content (matching language versions)
  const groups = groupFilesByContent(files);
  console.log(`✅ Grouped into ${groups.size} unique content pieces`);

  // Generate sitemap
  const sitemap = generateSitemap(groups);

  // Write sitemap
  fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');
  console.log(`✅ Sitemap generated successfully!`);
  console.log(`📍 Location: ${SITEMAP_PATH}`);
  console.log(`📊 URLs in sitemap: ${groups.size}`);

  // Count by language
  const langs = {};
  groups.forEach(group => {
    Object.keys(group).forEach(lang => {
      langs[lang] = (langs[lang] || 0) + 1;
    });
  });

  console.log('\n📈 Language breakdown:');
  Object.entries(langs).sort().forEach(([lang, count]) => {
    console.log(`   ${lang.toUpperCase()}: ${count} pages`);
  });
}

// Run the script
main();
