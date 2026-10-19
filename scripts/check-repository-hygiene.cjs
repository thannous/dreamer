#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const legacyRoots = ['outputs/', 'screenshots/', 'tmp-stage/'];
const localRoots = [
  'docs/', 'output/', 'outputs/', 'screenshots/', 'tmp-stage/', 'tmp-stage-index/',
  'test-results/', 'playwright-report/', 'dogfood-output/', '.tmp/', 'dist/', 'web-build/',
  'android/', 'ios/', 'apps/meditation/android/', 'apps/meditation/ios/',
  'apps/meditation/dist/', 'apps/meditation/web-build/', 'supabase/.temp/',
];
const retiredDiagnostics = new Set(['response.json', 'sample.wav', 'sample.flac', 'sample.b64']);

// Paths only: this guard never opens settings, credentials, captures or evidence.
function ruleFor(file) {
  const name = path.posix.basename(file);
  if (name === 'settings.local.json' || name === 'CLAUDE.local.md' || name.endsWith('.local.json')
    || name === '.env' || /^\.env.*\.local$/.test(name)
    || ['.env.real', '.env.supabase', 'credentials.json'].includes(file)) return 'private-local-configuration';
  if (localRoots.some(prefix => file.startsWith(prefix))
    || /(^|\/)(?:node_modules|\.auth|\.e2e|\.expo|\.cache|coverage)\//.test(file)) return 'local-or-generated-output';
  if (retiredDiagnostics.has(file) || /^[^/]+\.log$/.test(file) || /^\.tmp[-.]/.test(file)) return 'temporary-root-artifact';
  return null;
}

function legacyPathsFrom(document) {
  if (document?.schemaVersion !== 1 || !Array.isArray(document.legacyPaths)) throw new Error('Invalid repository hygiene baseline.');
  const unique = new Set();
  for (const file of document.legacyPaths) {
    if (typeof file !== 'string' || !legacyRoots.some(prefix => file.startsWith(prefix))
      || path.posix.normalize(file) !== file || file.includes('\\') || file.includes('\0')
      || ruleFor(file) !== 'local-or-generated-output' || unique.has(file)) {
      throw new Error('Invalid historical artifact exception.');
    }
    unique.add(file);
  }
  return unique;
}

function inspectPaths(files, legacyPaths = new Set()) {
  return [...new Set(files)].sort().flatMap(file => {
    const rule = ruleFor(file);
    return rule && !legacyPaths.has(file) ? [{ path: file, rule }] : [];
  });
}

function indexPaths(root) {
  return execFileSync('git', ['ls-files', '--cached', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  }).split('\0').filter(Boolean);
}

function checkRepositoryHygiene(root) {
  const document = JSON.parse(fs.readFileSync(path.join(root, 'data/repository-hygiene-baseline.json'), 'utf8'));
  return inspectPaths(indexPaths(root), legacyPathsFrom(document));
}

function main(root = path.resolve(__dirname, '..')) {
  try {
    const violations = checkRepositoryHygiene(root);
    if (violations.length) {
      console.error('Repository hygiene refused these tracked paths:');
      for (const violation of violations) console.error(`  ${violation.path} [${violation.rule}]`);
      console.error('Keep local files on disk; remove them from the Git index. Put public assets and redacted durable QA in their source folders.');
      process.exitCode = 1;
    } else console.log('Repository hygiene passed (Git index paths; historical evidence preserved).');
  } catch {
    console.error('Repository hygiene could not inspect the Git index or validate its historical baseline.');
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { ruleFor, legacyPathsFrom, inspectPaths, indexPaths, checkRepositoryHygiene };
