#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Adds/updates a `?v=` cache-busting query param for CSS/JS assets in `docs/`.
 *
 * This is required when using aggressive caching headers (e.g., immutable) on `/css/*` and `/js/*`.
 *
 * Usage:
 *   node scripts/cache-bust-docs-assets.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const VERSION_PATH = path.join(DOCS_DIR, 'version.txt');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function findHtmlFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      out.push(...findHtmlFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(fullPath);
    }
  }

  return out;
}

function updateAssetQueryParams(html, version) {
  let next = html;

  // Stylesheets in /css/
  next = next.replace(/href="(\/css\/[^"]+?\.css)(?:\?v=[^"]*)?"/g, `href="$1?v=${version}"`);

  // Scripts in /js/
  next = next.replace(/src="(\/js\/[^"]+?\.js)(?:\?v=[^"]*)?"/g, `src="$1?v=${version}"`);

  return next;
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error('Missing `docs/` directory. Run from repo root.');
    process.exit(1);
  }
  if (!fs.existsSync(VERSION_PATH)) {
    console.error('Missing `docs/version.txt` (needed for cache-busting).');
    process.exit(1);
  }

  const version = fs.readFileSync(VERSION_PATH, 'utf8').trim();
  if (!version) {
    console.error('Empty `docs/version.txt` (needed for cache-busting).');
    process.exit(1);
  }

  const files = findHtmlFiles(DOCS_DIR);
  let updated = 0;

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const next = updateAssetQueryParams(raw, version);
    if (next === raw) continue;

    updated += 1;
    if (!DRY_RUN) fs.writeFileSync(filePath, next, 'utf8');
  }

  const mode = DRY_RUN ? 'dry-run' : 'write';
  console.log(`[cache-bust-docs-assets] mode=${mode} version=${version} updated=${updated}`);
}

main();

