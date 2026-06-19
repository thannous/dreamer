#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { DOCS_DIR, ROOT_DIR } = require('./lib/docs-site-config');

const LEGACY_NAV_CLASS =
  'fixed w-full z-50 top-0 left-0 px-4 md:px-6 py-4 md:py-6 transition-all duration-300';

function walkHtmlFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(filePath, files);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(filePath);
    }
  }

  return files;
}

function normalizeRelativePath(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function isUtilityPage(relativePath) {
  return (
    relativePath === '404.html' ||
    relativePath.startsWith('auth/') ||
    relativePath.startsWith('templates/')
  );
}

function isNoIndex(html) {
  const robotsMatch = html.match(/<meta\s+[^>]*name=["']robots["'][^>]*>/i);
  return robotsMatch ? /content=["'][^"']*noindex/i.test(robotsMatch[0]) : false;
}

function auditDocsShell(docsDir = DOCS_DIR) {
  const errors = [];
  let checked = 0;

  for (const filePath of walkHtmlFiles(docsDir)) {
    const relativePath = normalizeRelativePath(docsDir, filePath);
    const html = fs.readFileSync(filePath, 'utf8');

    if (isUtilityPage(relativePath) || isNoIndex(html)) continue;

    checked += 1;
    const pageErrors = [];

    if (!/<nav\b[^>]*\bid=["']navbar["'][^>]*>/i.test(html)) {
      pageErrors.push('missing nav#navbar');
    }

    if (!/<footer\b[^>]*\bclass=["'][^"']*\bsite-footer\b/i.test(html)) {
      pageErrors.push('missing .site-footer');
    }

    if (!/\/js\/language-dropdown\.js(?:\?|["'])/i.test(html)) {
      pageErrors.push('missing /js/language-dropdown.js');
    }

    if (!/\/js\/site-shell\.js(?:\?|["'])/i.test(html)) {
      pageErrors.push('missing /js/site-shell.js');
    }

    if (!/\/js\/mobile-menu\.js(?:\?|["'])/i.test(html)) {
      pageErrors.push('missing /js/mobile-menu.js');
    }

    if (html.includes(LEGACY_NAV_CLASS)) {
      pageErrors.push('legacy navbar classes');
    }

    if (pageErrors.length > 0) {
      errors.push(`${relativePath}: ${pageErrors.join(', ')}`);
    }
  }

  return {
    ok: errors.length === 0,
    checked,
    errors,
  };
}

function main() {
  const result = auditDocsShell(DOCS_DIR);

  if (!result.ok) {
    console.error('[docs-shell] Shared shell check failed:');
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log(`[docs-shell] Shared shell check passed (${result.checked} pages).`);
}

if (require.main === module) {
  main();
}

module.exports = {
  auditDocsShell,
};
