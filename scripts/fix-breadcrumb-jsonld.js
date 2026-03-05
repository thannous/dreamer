#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { extractCanonicalUrl } = require('./lib/docs-seo-utils');

const DOCS_DIR = path.join(__dirname, '../docs');
const DRY_RUN = process.argv.includes('--dry-run');

function findHtmlFiles(dir, baseDir = '') {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      files.push(...findHtmlFiles(fullPath, relativePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(relativePath);
    }
  }

  return files;
}

function isBreadcrumbList(node) {
  const type = node?.['@type'];
  if (Array.isArray(type)) return type.includes('BreadcrumbList');
  return type === 'BreadcrumbList';
}

function normalizeBreadcrumbNode(node, canonicalUrl) {
  if (!node || typeof node !== 'object') return false;
  if (!canonicalUrl) return false;

  if (Array.isArray(node)) {
    return node.reduce((changed, item) => normalizeBreadcrumbNode(item, canonicalUrl) || changed, false);
  }

  if (Array.isArray(node['@graph'])) {
    return normalizeBreadcrumbNode(node['@graph'], canonicalUrl);
  }

  if (!isBreadcrumbList(node)) return false;
  if (!Array.isArray(node.itemListElement) || node.itemListElement.length === 0) return false;

  const lastItem = node.itemListElement[node.itemListElement.length - 1];
  if (!lastItem || typeof lastItem !== 'object' || lastItem.item) return false;

  lastItem.item = canonicalUrl;
  return true;
}

function rewriteJsonLdScripts(html, canonicalUrl) {
  const scriptRegex = /(^[ \t]*)<script\b[^>]*type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)\s*<\/script>/gim;
  let changed = false;

  const next = html.replace(scriptRegex, (full, indent, jsonText) => {
    let data;
    try {
      data = JSON.parse(jsonText.trim());
    } catch {
      return full;
    }

    if (!normalizeBreadcrumbNode(data, canonicalUrl)) {
      return full;
    }

    changed = true;
    const nestedIndent = `${indent}    `;
    const pretty = JSON.stringify(data, null, 4)
      .split('\n')
      .map((line) => `${nestedIndent}${line}`)
      .join('\n');

    return `${indent}<script type="application/ld+json">\n${pretty}\n${indent}</script>`;
  });

  return { html: next, changed };
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error('Missing `docs/` directory. Run from repo root.');
    process.exit(1);
  }

  const files = findHtmlFiles(DOCS_DIR);
  let updated = 0;

  for (const file of files) {
    const absPath = path.join(DOCS_DIR, file);
    const raw = fs.readFileSync(absPath, 'utf8');
    const canonicalUrl = extractCanonicalUrl(raw);
    const result = rewriteJsonLdScripts(raw, canonicalUrl);

    if (!result.changed) continue;
    updated += 1;
    if (!DRY_RUN) {
      fs.writeFileSync(absPath, result.html, 'utf8');
    }
  }

  console.log(`[fix-breadcrumb-jsonld] mode=${DRY_RUN ? 'dry-run' : 'write'} updated=${updated}`);
}

main();
