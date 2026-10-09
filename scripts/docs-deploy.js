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
with --commit-hash. Configuration lives in ${CONFIG_PATH}.

prod refuses unless HEAD is the fetched origin/master, the checkout is clean,
and \`npm run verify:release\` passed on HEAD (scripts/check-site-publish-proof.mjs).
There is no override. preview is not guarded.`);
}

function parseTarget(argv = process.argv.slice(2)) {
  const target = argv[0];
  if (target === 'preview' || target === 'prod') return target;
  if (target === '-h' || target === '--help') return 'help';
  throw new Error('Expected deployment target: preview or prod.');
}

// The production guard (scripts/check-site-publish-proof.mjs): HEAD is the
// fetched origin/master, the checkout is clean, and a passed `release` proof
// of `npm run verify:release` exists for HEAD. It throws the refusal. There is
// no override. Preview uploads are not guarded.
async function guardProductionPublish() {
  const { assertSitePublishProof } = await import('./check-site-publish-proof.mjs');
  return assertSitePublishProof({ root: ROOT_DIR });
}

async function main(argv = process.argv.slice(2), deps = {}) {
  const {
    guardProduction = guardProductionPublish,
    runCommand = run,
    loadConfig = loadCloudflarePagesConfig,
    createStaging = createDeployStaging,
    summarizeStaging = summarizeDeployStaging,
    readHead = readHeadCommit,
    log = console.log,
  } = deps;
  const target = parseTarget(argv);
  if (target === 'help') {
    printHelp();
    return;
  }

  if (target === 'prod') {
    // Before anything else: a refused publish builds and uploads nothing.
    log(await guardProduction());
  }

  const config = loadConfig();

  if (target === 'preview') {
    runCommand('npm', ['run', 'docs:build']);
    runCommand('npm', ['run', 'docs:check']);
  } else {
    runCommand('npm', ['run', 'docs:release-check']);
  }

  const staging = createStaging();
  try {
    const summary = summarizeStaging(staging.deployDir);
    log(
      `[docs-deploy] Clean staging: ${summary.files} runtime files, ${summary.bytes} bytes.`
    );
    const commitHash = readHead();
    const wranglerArgs = buildWranglerDeployArgs(config, target, staging.deployDir, commitHash);
    runCommand('npx', wranglerArgs);
  } finally {
    staging.cleanup();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[docs-deploy] Failed: ${error.message || error}`);
    process.exit(1);
  });
}

module.exports = {
  buildWranglerDeployArgs,
  loadCloudflarePagesConfig,
  main,
  parseTarget,
  readHeadCommit,
};
