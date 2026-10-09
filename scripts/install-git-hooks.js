'use strict';

// npm `prepare` step: point Git at the tracked hooks in .githooks/ so every
// checkout that installs dependencies runs the pre-push check. It never fails
// the install: builders without a Git work tree (EAS, hosting providers) and
// a deliberately customized core.hooksPath are left untouched.

const { spawnSync } = require('node:child_process');
const { existsSync, readdirSync, realpathSync } = require('node:fs');
const path = require('node:path');

const HOOKS_PATH = '.githooks';
const root = path.resolve(__dirname, '..');

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.error || result.status !== 0 ? null : result.stdout.trim();
}

function installGitHooks() {
  if (!existsSync(path.join(root, HOOKS_PATH, 'pre-push'))) return;
  const top = git(['rev-parse', '--show-toplevel']);
  // Configure only the repository that owns this package.
  if (!top || realpathSync(top) !== realpathSync(root)) return;

  const current = git(['config', '--get', 'core.hooksPath']);
  if (current === HOOKS_PATH) return;
  if (current) {
    console.warn(`Git hooks: core.hooksPath is "${current}"; left unchanged. ` +
      `Run \`git config core.hooksPath ${HOOKS_PATH}\` to enable the pre-push check.`);
    return;
  }

  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const legacyDir = commonDir && path.join(commonDir, 'hooks');
  const legacy = legacyDir && existsSync(legacyDir)
    ? readdirSync(legacyDir).filter(name => !name.endsWith('.sample'))
    : [];

  if (git(['config', 'core.hooksPath', HOOKS_PATH]) === null) {
    console.warn(`Git hooks: could not set core.hooksPath; run \`git config core.hooksPath ${HOOKS_PATH}\`.`);
    return;
  }
  console.log(`Git hooks: core.hooksPath=${HOOKS_PATH}; pushes now run \`npm run verify:fast\`.`);
  if (legacy.length) {
    console.warn(`Git hooks: ${legacyDir} (${legacy.join(', ')}) no longer runs; move needed hooks to ${HOOKS_PATH}/.`);
  }
}

try {
  installGitHooks();
} catch (error) {
  console.warn(`Git hooks: not installed (${error instanceof Error ? error.message : error}).`);
}
