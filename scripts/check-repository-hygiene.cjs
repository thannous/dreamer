#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const path = require('node:path');

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
    || ['.env.real', '.env.supabase', 'credentials.json'].includes(name)) return 'private-local-configuration';
  if (localRoots.some(prefix => file.startsWith(prefix))
    || /(^|\/)(?:node_modules|\.auth|\.e2e|\.expo|\.cache|coverage)\//.test(file)) return 'local-or-generated-output';
  if (retiredDiagnostics.has(file) || /^[^/]+\.log$/.test(file) || /^\.tmp[-.]/.test(file)) return 'temporary-root-artifact';
  return null;
}

function inspectPaths(files) {
  return [...new Set(files)].sort().flatMap(file => {
    const rule = ruleFor(file);
    return rule ? [{ path: file, rule }] : [];
  });
}

function indexPaths(root) {
  return execFileSync('git', ['ls-files', '--cached', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  }).split('\0').filter(Boolean);
}

function checkRepositoryHygiene(root) {
  return inspectPaths(indexPaths(root));
}

function main(root = path.resolve(__dirname, '..')) {
  try {
    const violations = checkRepositoryHygiene(root);
    if (violations.length) {
      console.error('Repository hygiene refused these tracked paths:');
      for (const violation of violations) console.error(`  ${violation.path} [${violation.rule}]`);
      console.error('Keep local files on disk; remove them from the Git index. Put public assets and redacted durable QA in their source folders.');
      process.exitCode = 1;
    } else console.log('Repository hygiene passed (Git index paths).');
  } catch {
    console.error('Repository hygiene could not inspect the Git index.');
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { ruleFor, inspectPaths, indexPaths, checkRepositoryHygiene };
