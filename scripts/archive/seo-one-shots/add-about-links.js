#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Adds an "About" link in the footer of docs HTML pages (FR/EN/ES).
 *
 * Goal: strengthen E-E-A-T by making the About page easily discoverable site-wide,
 * without having to update all templates manually.
 *
 * Usage:
 *   node scripts/add-about-links.js
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const EXCLUDED_DIRS = new Set(['node_modules', '.git']);

const ABOUT_BY_LANG = {
  en: { href: '/en/about', label: 'About' },
  fr: { href: '/fr/a-propos', label: 'À propos' },
  es: { href: '/es/sobre', label: 'Sobre' },
};

const LEGAL_HEADING_BY_LANG = {
  en: 'Legal',
  fr: 'Légal',
  es: 'Legal',
};

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function walk(dir, baseDir = '') {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      out.push(...walk(full, rel));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) out.push(rel);
  }
  return out;
}

function getLangFromRelativePath(relPath) {
  const first = relPath.split(path.sep)[0];
  return first === 'fr' || first === 'en' || first === 'es' ? first : null;
}

function insertAboutInFooter(footerHtml, lang) {
  const about = ABOUT_BY_LANG[lang];
  if (!about) return { footerHtml, changed: false };

  if (footerHtml.includes(`href="${about.href}"`)) return { footerHtml, changed: false };

  const legalHeading = LEGAL_HEADING_BY_LANG[lang] ?? LEGAL_HEADING_BY_LANG.en;
  const h5Regex = new RegExp(`<h5[^>]*>\\s*${escapeRegExp(legalHeading)}\\s*<\\/h5>`, 'i');
  const h5Match = footerHtml.match(h5Regex);
  if (!h5Match || h5Match.index == null) return { footerHtml, changed: false };

  const afterH5 = h5Match.index + h5Match[0].length;
  const ulIndex = footerHtml.indexOf('<ul', afterH5);
  if (ulIndex === -1) return { footerHtml, changed: false };
  const ulEnd = footerHtml.indexOf('>', ulIndex);
  if (ulEnd === -1) return { footerHtml, changed: false };

  const firstLiIndex = footerHtml.indexOf('<li', ulEnd);
  if (firstLiIndex === -1) return { footerHtml, changed: false };

  const prefixWhitespace = footerHtml.slice(ulEnd + 1, firstLiIndex);
  const aboutLine = `<li><a href="${about.href}" class="hover:text-dream-salmon transition-colors">${about.label}</a></li>`;
  const insertion = `${aboutLine}${prefixWhitespace}`;

  const nextFooterHtml =
    footerHtml.slice(0, firstLiIndex) + insertion + footerHtml.slice(firstLiIndex);
  return { footerHtml: nextFooterHtml, changed: true };
}

function processFile(relPath) {
  const lang = getLangFromRelativePath(relPath);
  if (!lang) return false;

  const absPath = path.join(DOCS_DIR, relPath);
  const original = fs.readFileSync(absPath, 'utf8');

  const footerIndex = original.lastIndexOf('<footer');
  if (footerIndex === -1) return false;

  const head = original.slice(0, footerIndex);
  const footer = original.slice(footerIndex);

  const res = insertAboutInFooter(footer, lang);
  if (!res.changed) return false;

  fs.writeFileSync(absPath, head + res.footerHtml, 'utf8');
  return true;
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`Missing docs directory: ${DOCS_DIR}`);
    process.exitCode = 1;
    return;
  }

  const files = walk(DOCS_DIR);
  let updated = 0;

  for (const relPath of files) {
    if (processFile(relPath)) updated++;
  }

  console.log(`Done. Updated ${updated} file(s).`);
}

main();

