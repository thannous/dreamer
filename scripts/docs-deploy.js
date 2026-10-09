#!/usr/bin/env node


'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  createDeployStaging,
  summarizeDeployStaging,
} = require('./lib/docs-deploy-staging');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join('docs-src', 'config', 'cloudflare-pages.json');

function loadCloudflarePagesConfig(rootDir = ROOT_DIR) {
  const configPath = path.join(rootDir, CONFIG_PATH);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing Cloudflare Pages config: ${CONFIG_PATH}`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  for (const key of [
    'projectName',
    'previewBranch',
    'productionBranch',
    'buildCommand',
    'buildOutputDirectory',
  ]) {
    if (typeof config[key] !== 'string' || config[key].trim() === '') {
      throw new Error(`Invalid Cloudflare Pages config: "${key}" must be a non-empty string.`);
    }
  }

  if (typeof config.rootDirectory !== 'string') {
    throw new Error('Invalid Cloudflare Pages config: "rootDirectory" must be a string.');
  }

  return {
    projectName: config.projectName.trim(),
    previewBranch: config.previewBranch.trim(),
    productionBranch: config.productionBranch.trim(),
    rootDirectory: config.rootDirectory.trim(),
    buildCommand: config.buildCommand.trim(),
    buildOutputDirectory: config.buildOutputDirectory.trim(),
  };
}

function buildWranglerDeployArgs(config, target, deployDir = 'docs', commitHash) {
  const branch = target === 'prod' ? config.productionBranch : config.previewBranch;
  const args = [
    'wrangler',
    'pages',
    'deploy',
    deployDir,
    '--project-name',
    config.projectName,
    '--branch',
    branch,
  ];
  if (commitHash) {
    args.push('--commit-hash', commitHash);
  }
  return args;
}

function readHeadCommit(rootDir = ROOT_DIR) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error('Cloudflare publish requires a git checkout so --commit-hash can record the SHA.');
  }
  const hash = String(result.stdout || '').trim();
  if (!/^[0-9a-f]{40}$/i.test(hash)) {
    throw new Error(`Cloudflare publish requires a full 40-character commit SHA (got "${hash}").`);
  }
  return hash;
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

Runs the docs checks, creates a clean allowlisted staging directory, and uploads
that runtime-only directory to Cloudflare Pages. The upload records git HEAD
with --commit-hash. Configuration lives in ${CONFIG_PATH}.`);
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

  const staging = createDeployStaging();
  try {
    const summary = summarizeDeployStaging(staging.deployDir);
    console.log(
      `[docs-deploy] Clean staging: ${summary.files} runtime files, ${summary.bytes} bytes.`
    );
    const commitHash = readHeadCommit();
    const wranglerArgs = buildWranglerDeployArgs(config, target, staging.deployDir, commitHash);
    run('npx', wranglerArgs);
  } finally {
    staging.cleanup();
  }
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
  readHeadCommit,
};
