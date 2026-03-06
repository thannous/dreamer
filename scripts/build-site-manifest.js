#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./lib/docs-site-config');
const { buildSiteManifest } = require('./lib/site-manifest');

const OUTPUT_PATH = path.join(DATA_DIR, 'site-manifest.json');
const CHECK_ONLY = process.argv.includes('--check');

function main() {
  const manifest = buildSiteManifest();
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

  if (CHECK_ONLY) {
    if (!fs.existsSync(OUTPUT_PATH)) {
      console.error(`[build-site-manifest] Missing file: ${OUTPUT_PATH}`);
      process.exit(2);
    }

    const current = fs.readFileSync(OUTPUT_PATH, 'utf8');
    if (current !== serialized) {
      console.error('[build-site-manifest] site-manifest.json is out of date.');
      process.exit(2);
    }

    console.log('[build-site-manifest] OK: site-manifest.json is up to date.');
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, serialized, 'utf8');
  console.log(`[build-site-manifest] Wrote ${OUTPUT_PATH}`);
}

main();
