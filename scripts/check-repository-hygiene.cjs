#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
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

// The symbol rollout registry counts a QA, approval or publication stage only
// while the evidence file it names is present with its sha256
// (scripts/symbol-rollout-report.mjs), and keeps its compacted history in an
// archive: removing one of those files silently empties the ledger. Each must
// stay tracked. The hash stays the report's concern.
const EVIDENCE_REGISTRY = 'docs-src/config/symbol-rollout.json';

function registryEvidencePaths(document) {
  const records = Array.isArray(document?.records) ? document.records : [];
  const archives = Array.isArray(document?.recordArchives) ? document.recordArchives : [];
  return [...records.map(record => record?.evidence?.path), ...archives.map(archive => archive?.path)]
    .filter(file => typeof file === 'string' && file !== '');
}

function missingEvidence(root, files) {
  if (!files.includes(EVIDENCE_REGISTRY)) return [];
  const document = JSON.parse(fs.readFileSync(path.join(root, EVIDENCE_REGISTRY), 'utf8'));
  const tracked = new Set(files);
  return [...new Set(registryEvidencePaths(document))].sort()
    .filter(file => !tracked.has(file))
    .map(file => ({ path: file, rule: 'registry-evidence-missing' }));
}

function checkRepositoryHygiene(root) {
  const files = indexPaths(root);
  return [...inspectPaths(files), ...missingEvidence(root, files)];
}

function main(root = path.resolve(__dirname, '..')) {
  try {
    const violations = checkRepositoryHygiene(root);
    if (violations.length) {
      const missing = violations.filter(violation => violation.rule === 'registry-evidence-missing');
      const refused = violations.filter(violation => violation.rule !== 'registry-evidence-missing');
      if (refused.length) {
        console.error('Repository hygiene refused these tracked paths:');
        for (const violation of refused) console.error(`  ${violation.path} [${violation.rule}]`);
        console.error('Keep local files on disk; remove them from the Git index. Put public assets and redacted durable QA in their source folders.');
      }
      if (missing.length) {
        console.error(`Repository hygiene found evidence files that ${EVIDENCE_REGISTRY} names but Git does not track:`);
        for (const violation of missing) console.error(`  ${violation.path} [${violation.rule}]`);
        console.error('Restore each file, or move it and repoint the registry with the same sha256.');
      }
      process.exitCode = 1;
    } else console.log('Repository hygiene passed (Git index paths).');
  } catch {
    console.error('Repository hygiene could not inspect the Git index.');
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { ruleFor, inspectPaths, indexPaths, registryEvidencePaths, missingEvidence, checkRepositoryHygiene };
