const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { TARGETS, BASELINE } = require('./check-lint-warnings');

const script = path.join(__dirname, 'check-lint-warnings.js');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-warning-guard-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

async function fixture(source) {
  fs.writeFileSync(path.join(root, 'eslint.config.cjs'), "module.exports = [{ rules: { 'no-unused-vars': 'warn', 'no-undef': 'error' } }];\n");
  for (const target of TARGETS) {
    fs.mkdirSync(path.join(root, target), { recursive: true });
    fs.writeFileSync(path.join(root, target, 'empty.js'), 'export {};\n');
  }
  fs.writeFileSync(path.join(root, 'app', 'example.js'), source);
  const seeded = spawnSync(process.execPath, ['-e', `
    const fs = require('node:fs');
    const { ESLint } = require(process.argv[1]);
    const { TARGETS, BASELINE, collectWarnings } = require(process.argv[2]);
    (async () => {
      const results = await new ESLint({ cwd: process.cwd() }).lintFiles(TARGETS);
      fs.writeFileSync(BASELINE, JSON.stringify({ schemaVersion: 1, targets: TARGETS, warnings: collectWarnings(results, process.cwd()) }, null, 2));
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, require.resolve('eslint'), script], { cwd: root, encoding: 'utf8' });
  expect(seeded.error).toBeUndefined(); expect(seeded.status).toBe(0);
}
function run(...args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  expect(result.error).toBeUndefined();
  return { status: result.status, output: result.stdout + result.stderr };
}

// A UI journey cannot detect CLI fingerprint identity, scope or allowance reuse.
test('real ESLint accepts known warnings after line-only moves, rejects a new warning even when the total falls', async () => {
  await fixture('const known = 1;\nconst retired = 2;\nconst former = 3;\n');
  expect(run().status).toBe(0);
  fs.writeFileSync(path.join(root, 'app', 'example.js'), '// An unrelated comment shifts diagnostic locations.\n\nconst known = 1;\nconst retired = 2;\nconst former = 3;\n');
  expect(run().status).toBe(0);
  fs.writeFileSync(path.join(root, 'app', 'example.js'), 'const known = 1;\n');
  fs.writeFileSync(path.join(root, 'components', 'new.js'), 'const surprise = 4;\n');
  const prior = fs.readFileSync(path.join(root, BASELINE), 'utf8');
  const result = run('--prune');
  expect(result.status).toBe(1); expect(result.output).toContain('New ESLint warnings');
  expect(fs.readFileSync(path.join(root, BASELINE), 'utf8')).toBe(prior);
});

test('resolving warnings requires pruning and the removed allowance cannot accept a reintroduced warning', async () => {
  await fixture('const known = 1;\nconst retired = 2;\n');
  fs.writeFileSync(path.join(root, 'app', 'example.js'), 'const known = 1;\n');
  expect(run().status).toBe(1);
  expect(run('--prune').status).toBe(0);
  expect(JSON.parse(fs.readFileSync(path.join(root, BASELINE), 'utf8')).warnings).toHaveLength(1);
  expect(run().status).toBe(0);
  fs.writeFileSync(path.join(root, 'app', 'example.js'), 'const known = 1;\nconst retired = 2;\n');
  expect(run().status).toBe(1);
});

test('warning multiplicity and ESLint errors cannot use an existing warning fingerprint', async () => {
  await fixture('export function first() { const unused = 1; }\n');
  fs.writeFileSync(path.join(root, 'app', 'example.js'), 'export function first() { const unused = 1; }\nexport function second() { const unused = 1; }\n');
  expect(run().status).toBe(1);
  fs.writeFileSync(path.join(root, 'app', 'example.js'), 'export function first() { const unused = 1; missingGlobal(); }\n');
  const prior = fs.readFileSync(path.join(root, BASELINE), 'utf8');
  const result = run('--prune');
  expect(result.status).toBe(1); expect(result.output).toContain('ESLint errors remain fatal');
  expect(fs.readFileSync(path.join(root, BASELINE), 'utf8')).toBe(prior);
});

describe('--changed', () => {
  const { lintScope, WHOLE_SCOPE } = require('./check-lint-warnings');
  const sources = {
    'components/Card.tsx': "import { tone } from '@/constants/tone';\nexport const Card = () => tone;\n",
    'components/index.ts': "export * from './Card';\n",
    'app/home.tsx': "import { Card } from '../components';\n",
    'app/settings.tsx': "const Legacy = require('../lib/legacy');\n",
    'app/about.tsx': "import Icon from './icon.web';\n",
    'app/icon.web.tsx': 'export default function Icon() {}\n',
    'constants/tone.ts': "export const tone = 'night';\n",
    'lib/unrelated.ts': "import { tone } from 'tone-package';\n",
    'docs/readme.md': '# Not code\n',
  };
  const scope = (changed) => lintScope({ changed, files: Object.keys(sources), read: (file) => sources[file] });

  it('lints the changed files and the files importing them, through re-exports', () => {
    expect(scope(['constants/tone.ts'])).toEqual(['components/Card.tsx', 'constants/tone.ts']);
    expect(scope(['components/Card.tsx'])).toEqual(['app/home.tsx', 'components/Card.tsx', 'components/index.ts']);
    expect(scope(['app/icon.web.tsx'])).toEqual(['app/about.tsx', 'app/icon.web.tsx']);
    expect(scope(['docs/readme.md'])).toEqual([]);
  });

  it('lints the importers of a deleted file, and everything after a change every result depends on', () => {
    expect(scope(['lib/legacy.js'])).toEqual(['app/settings.tsx']);
    for (const file of WHOLE_SCOPE) expect(scope([file])).toBeNull();
  });

  it('checks only the changed files in a PR, every file in a release', async () => {
    await fixture('const known = 1;\n');
    const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    git('init', '-q', '-b', 'master');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@noctalia.invalid', 'commit', '--allow-empty', '-qm', 'base');
    git('add', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@noctalia.invalid', 'commit', '-qm', 'fixture');
    git('update-ref', 'refs/remotes/origin/master', 'HEAD');
    // An unchanged file gains a warning the baseline does not allow: only a full run sees it.
    fs.writeFileSync(path.join(root, 'components', 'empty.js'), 'const surprise = 1;\n');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@noctalia.invalid', 'commit', '-qam', 'warning');
    git('update-ref', 'refs/remotes/origin/master', 'HEAD');
    fs.writeFileSync(path.join(root, 'app', 'example.js'), '// A comment.\nconst known = 1;\n');
    const changed = (kind) => spawnSync(process.execPath, [script, '--changed'], { cwd: root, encoding: 'utf8', env: { ...process.env, VERIFY_LOCAL_KIND: kind } });
    const pr = changed('pr');
    expect(pr.stdout).toContain('ESLint on 1 files changed since');
    expect(pr.status).toBe(0);
    const release = changed('release');
    expect(release.stdout).toContain('ESLint on every file: a release lints every file.');
    expect(release.status).toBe(1);
    expect(run('--prune', '--changed').status).toBe(1);
  });
});
