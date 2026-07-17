#!/usr/bin/env node

/**
 * Bundles the landing experience layer (docs-src/experience/) with esbuild.
 *
 * Output goes to docs-src/static/js/experience/ so it is copied to docs/ and
 * covered by the global asset hash (resolveBuildVersion). The WebGL scene
 * (three.js) is code-split into its own chunk and only ever downloaded on
 * devices whose tier justifies it.
 *
 * Runs inside `npm run docs:build` (before the version hash) and standalone
 * via `npm run docs:build:experience`.
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENTRY_POINT = path.join(ROOT_DIR, 'docs-src', 'experience', 'experience.js');
const OUT_DIR = path.join(ROOT_DIR, 'docs-src', 'static', 'js', 'experience');

async function buildExperience() {
  // Stale hashed chunks must not survive a rebuild.
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const result = await esbuild.build({
    entryPoints: [ENTRY_POINT],
    bundle: true,
    minify: true,
    format: 'esm',
    splitting: true,
    target: 'es2020',
    outdir: OUT_DIR,
    sourcemap: false,
    logLevel: 'warning',
    metafile: true,
  });

  for (const [file, info] of Object.entries(result.metafile.outputs)) {
    if (info.entryPoint || info.imports.length === 0 || file.endsWith('.js')) {
      const kb = (info.bytes / 1024).toFixed(1);
      console.log(`[build-experience] ${path.relative(ROOT_DIR, file)} (${kb} kB)`);
    }
  }
}

if (require.main === module) {
  buildExperience().catch((error) => {
    console.error('[build-experience] failed:', error.message);
    process.exit(1);
  });
}

module.exports = { buildExperience };
