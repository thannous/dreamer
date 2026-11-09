const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { ruleFor, inspectPaths, indexPaths, checkRepositoryHygiene } = require('./check-repository-hygiene.cjs');

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

test('no tracked path is exempt: the former historical output folders are refused like any other', () => {
  assert.deepEqual(inspectPaths(['outputs/old/report.json', 'screenshots/old.png', 'tmp-stage/old.png']).map(row => row.path),
    ['outputs/old/report.json', 'screenshots/old.png', 'tmp-stage/old.png']);
});

test('the real Git index controls publication while private local files stay on disk', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-hygiene-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const write = (file, text = 'public fixture\n') => {
    const full = path.join(root, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, text);
  };
  try {
    git('init', '-q');
    write('assets/icon.png'); write('doc_web_interne/docs/qa/audit.md');
    write('.claude/settings.local.json');
    git('add', '-f', '--', 'assets/icon.png', 'doc_web_interne/docs/qa/audit.md', '.claude/settings.local.json');
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


test('the CLI refuses private basenames and tracked local output at every depth', () => {
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
  try {
    git('init', '-q');
    write('scripts/check-repository-hygiene.cjs', fs.readFileSync(path.join(__dirname, 'check-repository-hygiene.cjs')));
    write('.gitignore', privateNames.join('\n') + '\n');
    for (const file of publicFiles) write(file);
    git('add', '-f', '--', 'scripts', '.gitignore', ...publicFiles);
    assert.equal(cli().status, 0, 'public examples and profiles remain allowed');

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

    const output = 'outputs/old/report.json';
    write(output); git('add', '-f', '--', output);
    const newArtifact = cli();
    assert.equal(newArtifact.status, 1, newArtifact.stderr);
    assert.ok(newArtifact.stderr.includes(`${output} [local-or-generated-output]`));
    git('rm', '--cached', '--', output);
    assert.equal(cli().status, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
