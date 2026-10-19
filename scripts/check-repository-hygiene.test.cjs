const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { ruleFor, legacyPathsFrom, inspectPaths, indexPaths, checkRepositoryHygiene } = require('./check-repository-hygiene.cjs');

// These path/index failures occur before any application/browser journey starts.
test('new local configuration, raw run output and temporary paths are refused', () => {
  const paths = [
    '.claude/settings.local.json', 'apps/meditation/settings.local.json', 'CLAUDE.local.md',
    '.env', '.env.test.local', '.env.real', '.env.supabase', 'credentials.json',
    'doc_web_interne/docs/account-state.local.json', '.auth/free.json',
    'test-results/run/trace.md', 'outputs/new-run/report.json', 'screenshots/new-capture.png',
    'tools/e2e/.e2e/dreamer-web/run/report.json', 'apps/meditation/.expo/settings.json',
    'docs/en/index.html', 'android/app/build/app.apk', 'apps/meditation/ios/project.pbxproj',
    'tmp-stage/new.png', 'tmp-stage-index/new.tsx', '.tmp/new.json', 'metro.log', '.tmp-memo-ref.tsx', 'sample.wav',
  ];
  assert.equal(inspectPaths(paths).length, paths.length);
  assert.ok(inspectPaths(paths).every(row => row.rule));
});

test('product assets, source profiles, fixtures and redacted durable QA remain permitted', () => {
  for (const file of [
    'assets/images/icon.png', 'apps/meditation/assets/worlds/cloud.webp',
    'docs-src/static/img/symbols/cat.webp', 'docs-src/templates/layout.html',
    'doc_web_interne/docs/qa/audit.md', 'doc_web_interne/docs/qa/evidence/public-screen.png',
    'tests/fixtures/public-response.json', '.env.example', '.env.test.example', '.env.mock',
    '.env.lucid', 'apps/meditation/.env.example', 'app/recording.tsx',
  ]) assert.equal(ruleFor(file), null, file);
});

test('historical exceptions preserve exact paths without admitting adjacent new artifacts', () => {
  const legacy = legacyPathsFrom({ schemaVersion: 1, legacyPaths: ['outputs/old/report.json', 'screenshots/old.png', 'tmp-stage/old.png'] });
  assert.deepEqual(inspectPaths([...legacy], legacy), []);
  assert.deepEqual(inspectPaths(['outputs/new/report.json', 'screenshots/new.png', 'tmp-stage/new.png'], legacy).map(row => row.path),
    ['outputs/new/report.json', 'screenshots/new.png', 'tmp-stage/new.png']);
  for (const legacyPaths of [['.claude/settings.local.json'], ['outputs/../settings.local.json'], ['outputs/old.json', 'outputs/old.json']]) {
    assert.throws(() => legacyPathsFrom({ schemaVersion: 1, legacyPaths }), /Invalid historical artifact exception/);
  }
  assert.throws(() => legacyPathsFrom({ schemaVersion: 2, legacyPaths: [] }), /Invalid repository hygiene baseline/);
});

test('the real Git index controls publication while private local files stay on disk', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-hygiene-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const write = (file, text = 'public fixture\n') => {
    const full = path.join(root, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, text);
  };
  try {
    git('init', '-q');
    write('data/repository-hygiene-baseline.json', JSON.stringify({ schemaVersion: 1, legacyPaths: ['outputs/old/report.json'] }));
    write('assets/icon.png'); write('doc_web_interne/docs/qa/audit.md'); write('outputs/old/report.json');
    write('.claude/settings.local.json');
    git('add', '-f', '--', 'data/repository-hygiene-baseline.json', 'assets/icon.png', 'doc_web_interne/docs/qa/audit.md',
      'outputs/old/report.json', '.claude/settings.local.json');
    assert.deepEqual(checkRepositoryHygiene(root), [{ path: '.claude/settings.local.json', rule: 'private-local-configuration' }]);
    git('rm', '--cached', '--', '.claude/settings.local.json');
    assert.ok(fs.existsSync(path.join(root, '.claude/settings.local.json')));
    assert.deepEqual(checkRepositoryHygiene(root), []);
    write('test-results/private/report.json'); git('add', '-f', '--', 'test-results/private/report.json');
    assert.deepEqual(checkRepositoryHygiene(root), [{ path: 'test-results/private/report.json', rule: 'local-or-generated-output' }]);
    git('rm', '--cached', '--', 'test-results/private/report.json');
    assert.ok(fs.existsSync(path.join(root, 'test-results/private/report.json')));
    assert.deepEqual(checkRepositoryHygiene(root), []);
    assert.throws(() => indexPaths(os.tmpdir()));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});


test('the CLI refuses private basenames at every depth without broadening historical exceptions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-hygiene-cli-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const write = (file, text = 'synthetic fixture\n') => {
    const full = path.join(root, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, text);
  };
  const cli = () => spawnSync(process.execPath, ['scripts/check-repository-hygiene.cjs'], { cwd: root, encoding: 'utf8' });
  const prefixes = ['', 'apps/meditation/', 'packages/deep/module/'];
  const privateNames = ['.env.real', '.env.supabase', 'credentials.json'];
  const privateFiles = prefixes.flatMap(prefix => privateNames.map(name => prefix + name));
  const publicFiles = prefixes.flatMap(prefix => ['.env.example', '.env.test.example', '.env.mock', '.env.lucid'].map(name => prefix + name));
  const baseline = { schemaVersion: 1, legacyPaths: ['outputs/old/report.json'] };
  try {
    git('init', '-q');
    write('scripts/check-repository-hygiene.cjs', fs.readFileSync(path.join(__dirname, 'check-repository-hygiene.cjs')));
    write('data/repository-hygiene-baseline.json', JSON.stringify(baseline));
    write('.gitignore', privateNames.join('\n') + '\n');
    for (const file of [...publicFiles, ...baseline.legacyPaths]) write(file);
    git('add', '-f', '--', 'scripts', 'data', '.gitignore', ...publicFiles, ...baseline.legacyPaths);
    assert.equal(cli().status, 0, 'public examples/profiles and the exact historical path remain allowed');

    for (const file of privateFiles) write(file);
    git('add', '-f', '--', ...privateFiles);
    const refused = cli();
    assert.equal(refused.status, 1, refused.stderr);
    for (const file of privateFiles) {
      assert.ok(refused.stderr.includes(`${file} [private-local-configuration]`), `CLI failed to refuse ${file}`);
    }
    git('rm', '--cached', '--', ...privateFiles);
    for (const file of privateFiles) assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), 'synthetic fixture\n');
    assert.equal(cli().status, 0, 'removing only the index entries preserves local data and restores a clean result');

    const adjacent = 'outputs/old/new-report.json';
    write(adjacent); git('add', '-f', '--', adjacent);
    const newArtifact = cli();
    assert.equal(newArtifact.status, 1, newArtifact.stderr);
    assert.ok(newArtifact.stderr.includes(`${adjacent} [local-or-generated-output]`));
    assert.ok(!newArtifact.stderr.includes('outputs/old/report.json ['));
    git('rm', '--cached', '--', adjacent);

    // Historical output exceptions must never admit a private basename either.
    for (const name of privateNames) {
      write('data/repository-hygiene-baseline.json', JSON.stringify({ ...baseline, legacyPaths: [`outputs/old/${name}`] }));
      const invalidException = cli();
      assert.equal(invalidException.status, 1, `private historical exception was accepted: ${name}`);
      assert.match(invalidException.stderr, /could not inspect the Git index or validate its historical baseline/);
    }
    write('data/repository-hygiene-baseline.json', JSON.stringify(baseline));
    assert.equal(cli().status, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
