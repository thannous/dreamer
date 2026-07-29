#!/usr/bin/env node


'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  DOCS_BUILD_STATE_FILE,
  readDocsBuildState,
} = require('./lib/docs-check-helpers');

const ROOT_DIR = path.resolve(__dirname, '..');

function pad(number) {
  return String(number).padStart(2, '0');
}

function generateReleaseVersion(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function parseArgs(argv) {
  return {
    skipExternal: argv.includes('--skip-external'),
    allowDirty: argv.includes('--allow-dirty'),
    strictContent: argv.includes('--strict-content'),
    keepWorktree: argv.includes('--keep-worktree'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

function printHelp() {
  console.log(`Usage: node scripts/docs-release-check.js [options]

Runs a release-grade docs validation locally:
1. validates the current commit in a temporary clean git worktree
2. promotes that exact validated docs/ artifact to the local workspace

Options:
  --skip-external   Skip external link validation
  --strict-content  Fail on content-depth warnings
  --allow-dirty     Allow starting from a dirty worktree
  --keep-worktree   Keep the temporary worktree for debugging
  -h, --help        Show this help
`);
}

function run(command, args, options = {}) {
  const {
    cwd = ROOT_DIR,
    env = process.env,
    stdio = 'inherit',
    allowFailure = false,
  } = options;
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio,
    shell: process.platform === 'win32',
  });
  if (!allowFailure && result.status !== 0) {
    const rendered = [command, ...args].join(' ');
    throw new Error(`Command failed (${result.status ?? 'unknown'}): ${rendered}`);
  }
  return result;
}

function readGitStatus(cwd) {
  const result = run('git', ['status', '--short'], {
    cwd,
    stdio: 'pipe',
  });
  return String(result.stdout || '').trim();
}

function ensureCleanWorktree(options) {
  if (options.allowDirty) return;
  const status = readGitStatus(ROOT_DIR);
  if (!status) return;
  throw new Error(
    'Working tree is not clean. Commit or stash changes first, or re-run with --allow-dirty.'
  );
}

function ensureLocalDependencies() {
  const nodeModulesPath = path.join(ROOT_DIR, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    throw new Error('Missing node_modules/. Run `npm install` before docs:release-check.');
  }
}

function createTempWorkspace() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-release-'));
  const worktreeDir = path.join(tempRoot, 'repo');

  let mode = 'worktree';
  try {
    console.log(`[docs-release-check] Preparing worktree (detached HEAD ${readHeadShortSha(ROOT_DIR)})`);
    run('git', ['worktree', 'add', '--detach', worktreeDir, 'HEAD'], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
    });
  } catch {
    mode = 'archive';
    console.log('[docs-release-check] git worktree unavailable, falling back to git archive export.');
    fs.mkdirSync(worktreeDir, { recursive: true });
    exportHeadToDirectory(worktreeDir);
  }

  const sourceNodeModules = path.join(ROOT_DIR, 'node_modules');
  const targetNodeModules = path.join(worktreeDir, 'node_modules');
  fs.symlinkSync(
    sourceNodeModules,
    targetNodeModules,
    process.platform === 'win32' ? 'junction' : 'dir'
  );

  return { tempRoot, worktreeDir, mode };
}

function cleanupTempWorkspace(tempWorkspace, options) {
  if (!tempWorkspace) return;
  if (options.keepWorktree) {
    console.log(`[docs-release-check] Temporary worktree kept at ${tempWorkspace.worktreeDir}`);
    return;
  }

  if (tempWorkspace.mode === 'worktree') {
    run('git', ['worktree', 'remove', '--force', tempWorkspace.worktreeDir], {
      cwd: ROOT_DIR,
      allowFailure: true,
      stdio: 'pipe',
    });
  }
  fs.rmSync(tempWorkspace.tempRoot, { recursive: true, force: true });
}

function runChecksInDirectory(targetDir, releaseVersion, options, label) {
  const env = {
    ...process.env,
    DOCS_BUILD_VERSION: releaseVersion,
  };

  console.log(`\n[docs-release-check] ${label}: build`);
  run('npm', ['run', 'docs:build'], { cwd: targetDir, env });

  console.log(`\n[docs-release-check] ${label}: structural checks`);
  run('npm', ['run', 'docs:check'], { cwd: targetDir, env });

  console.log(`\n[docs-release-check] ${label}: clean deploy surface`);
  run('node', ['scripts/check-docs-deploy-surface.js'], { cwd: targetDir, env });

  if (!options.skipExternal) {
    console.log(`\n[docs-release-check] ${label}: external links`);
    run('node', ['scripts/check-docs-links.js', '--external'], { cwd: targetDir, env });
  }

  console.log(`\n[docs-release-check] ${label}: content depth`);
  run(
    'node',
    [
      'docs/scripts/check-content-depth.js',
      ...(options.strictContent ? ['--fail'] : []),
    ],
    { cwd: targetDir, env }
  );
}

function promoteValidatedDocs(sourceRoot, destinationRoot = ROOT_DIR) {
  const sourceDocs = path.join(sourceRoot, 'docs');
  const destinationDocs = path.join(destinationRoot, 'docs');
  const sourceState = path.join(sourceRoot, DOCS_BUILD_STATE_FILE);
  const destinationState = path.join(destinationRoot, DOCS_BUILD_STATE_FILE);
  const sourceBuildState = readDocsBuildState(sourceRoot);

  if (!fs.existsSync(sourceDocs)) {
    throw new Error(`Validated docs artifact is missing: ${sourceDocs}`);
  }
  if (sourceBuildState?.status !== 'ready') {
    throw new Error(
      `Validated docs artifact is not ready: ${sourceBuildState?.status || 'missing build state'}`
    );
  }

  const promotionRoot = fs.mkdtempSync(
    path.join(destinationRoot, '.docs-release-promotion-')
  );
  const stagedDocs = path.join(promotionRoot, 'docs');
  const previousDocs = path.join(promotionRoot, 'previous-docs');
  let movedPreviousDocs = false;

  try {
    fs.cpSync(sourceDocs, stagedDocs, { recursive: true });
    if (fs.existsSync(destinationDocs)) {
      fs.renameSync(destinationDocs, previousDocs);
      movedPreviousDocs = true;
    }

    try {
      fs.renameSync(stagedDocs, destinationDocs);
      fs.copyFileSync(sourceState, destinationState);
    } catch (error) {
      fs.rmSync(destinationDocs, { recursive: true, force: true });
      if (movedPreviousDocs && fs.existsSync(previousDocs)) {
        fs.renameSync(previousDocs, destinationDocs);
        movedPreviousDocs = false;
      }
      throw error;
    }
  } finally {
    fs.rmSync(promotionRoot, { recursive: true, force: true });
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  ensureCleanWorktree(options);
  ensureLocalDependencies();

  const releaseVersion = generateReleaseVersion();
  console.log(`[docs-release-check] Release version: ${releaseVersion}`);

  let tempWorkspace = null;
  try {
    tempWorkspace = createTempWorkspace();
    runChecksInDirectory(tempWorkspace.worktreeDir, releaseVersion, options, 'clean worktree');
    promoteValidatedDocs(tempWorkspace.worktreeDir);

    console.log('\n[docs-release-check] Success.');
    console.log('[docs-release-check] The validated clean-worktree docs/ artifact is ready locally.');
    if (options.skipExternal) {
      console.log('[docs-release-check] External links were skipped.');
    }
  } finally {
    cleanupTempWorkspace(tempWorkspace, options);
  }
}

function readHeadShortSha(cwd) {
  const result = run('git', ['rev-parse', '--short', 'HEAD'], {
    cwd,
    stdio: 'pipe',
  });
  return String(result.stdout || '').trim();
}

function exportHeadToDirectory(targetDir) {
  const escapedTargetDir = targetDir.replace(/'/g, `'\\''`);
  const result = spawnSync(
    'bash',
    ['-lc', `git archive --format=tar HEAD | tar -xf - -C '${escapedTargetDir}'`],
    {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'inherit', 'pipe'],
    }
  );
  if (result.status !== 0) {
    throw new Error(`git archive fallback failed: ${String(result.stderr || '').trim()}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`\n[docs-release-check] Failed: ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = {
  generateReleaseVersion,
  parseArgs,
  promoteValidatedDocs,
};
