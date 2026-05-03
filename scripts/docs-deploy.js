#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join('docs-src', 'config', 'cloudflare-pages.json');

function loadCloudflarePagesConfig(rootDir = ROOT_DIR) {
  const configPath = path.join(rootDir, CONFIG_PATH);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing Cloudflare Pages config: ${CONFIG_PATH}`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  for (const key of ['projectName', 'previewBranch', 'productionBranch']) {
    if (typeof config[key] !== 'string' || config[key].trim() === '') {
      throw new Error(`Invalid Cloudflare Pages config: "${key}" must be a non-empty string.`);
    }
  }

  return {
    projectName: config.projectName.trim(),
    previewBranch: config.previewBranch.trim(),
    productionBranch: config.productionBranch.trim(),
  };
}

function buildWranglerDeployArgs(config, target) {
  const branch = target === 'prod' ? config.productionBranch : config.previewBranch;
  return [
    'wrangler',
    'pages',
    'deploy',
    'docs',
    '--project-name',
    config.projectName,
    '--branch',
    branch,
  ];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    shell: process.platform === 'win32',
    stdio: 'inherit',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status ?? 'unknown'}): ${[command, ...args].join(' ')}`);
  }
}

function printHelp() {
  console.log(`Usage: node scripts/docs-deploy.js <preview|prod>

Runs the docs checks and uploads the generated docs/ directory to Cloudflare Pages.
Configuration lives in ${CONFIG_PATH}.`);
}

function parseTarget(argv = process.argv.slice(2)) {
  const target = argv[0];
  if (target === 'preview' || target === 'prod') return target;
  if (target === '-h' || target === '--help') return 'help';
  throw new Error('Expected deployment target: preview or prod.');
}

function main() {
  const target = parseTarget();
  if (target === 'help') {
    printHelp();
    return;
  }

  const config = loadCloudflarePagesConfig();

  if (target === 'preview') {
    run('npm', ['run', 'docs:build']);
    run('npm', ['run', 'docs:check']);
  } else {
    run('npm', ['run', 'docs:release-check']);
  }

  const wranglerArgs = buildWranglerDeployArgs(config, target);
  run('npx', wranglerArgs);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[docs-deploy] Failed: ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = {
  buildWranglerDeployArgs,
  loadCloudflarePagesConfig,
  parseTarget,
};
