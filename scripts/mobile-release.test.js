'use strict';
/* global afterEach, describe, expect, it */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { affects, bump, changeLevel, normalized, plan, prepare, verify, parseArgs, main } = require('./mobile-release');

const fixtures = [];
const git = (root, ...args) => execFileSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function write(root, file, value) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
}
function commit(root, message) {
  git(root, 'add', '.'); git(root, 'commit', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-release-'));
  fixtures.push(root);
  git(root, 'init', '-b', 'master');
  git(root, 'config', 'user.name', 'Release Test');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'core.hooksPath', path.join(root, 'empty-hooks'));
  for (const prefix of ['', 'apps/meditation/']) {
    write(root, `${prefix}eas.json`, { cli: { appVersionSource: 'remote' }, build: { production: { autoIncrement: true }, 'lucid-production': { autoIncrement: true } } });
    write(root, `${prefix}package.json`, { version: '3.1.0', scripts: {} });
    write(root, `${prefix}app.json`, { expo: { version: '3.1.0', android: { versionCode: 68 } } });
    write(root, `${prefix}package-lock.json`, { version: '3.1.0', packages: { '': { version: '3.1.0' } } });
  }
  write(root, 'app/home.tsx', 'original');
  write(root, 'lib/lucid/routine.ts', 'original');
  const base = commit(root, 'feat: baseline');
  write(root, 'release/mobile-versions.json', { schemaVersion: 1, apps: Object.fromEntries(['noctalia', 'lucid', 'meditation'].map(app => [app, { version: '3.1.0', sourceRef: base }])) });
  commit(root, 'chore: release baseline');
  git(root, 'update-ref', 'refs/remotes/origin/master', 'HEAD');
  return root;
}
afterEach(() => fixtures.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));

describe('semantic release policy', () => {
  it('uses explicit features and breaking markers, with a patch fallback', () => {
    expect(changeLevel('fix(audio): resume')).toBe('patch');
    expect(changeLevel('feat(lucid): new practice')).toBe('minor');
    expect(changeLevel('refactor!: remove old interface')).toBe('major');
    expect(changeLevel('fix: migrate\n\nBREAKING CHANGE: incompatible data')).toBe('major');
    expect(changeLevel('Update Expo patches (#183)')).toBe('patch');
    expect(bump('3.1.9', 'patch')).toBe('3.1.10');
    expect(bump('3.1.9', 'minor')).toBe('3.2.0');
    expect(bump('3.1.9', 'major')).toBe('4.0.0');
    expect(() => bump('3.1', 'patch')).toThrow();
  });
  it('routes app-specific and shared changes without counting docs or tests', () => {
    expect(affects('noctalia', 'apps/meditation/app/index.tsx')).toBe(false);
    expect(affects('meditation', 'apps/meditation/app/index.tsx')).toBe(true);
    expect(affects('lucid', 'lib/lucid/routine.ts')).toBe(true);
    expect(affects('noctalia', 'lib/lucid/routine.ts')).toBe(false);
    expect(affects('lucid', 'app/home.tsx')).toBe(false);
    expect(affects('lucid', 'app/_layout.tsx')).toBe(true);
    expect(affects('lucid', 'components/ui/Button.tsx')).toBe(true);
    expect(affects('noctalia', 'components/ui/Button.tsx')).toBe(true);
    expect(affects('meditation', 'package-lock.json')).toBe(false);
    expect(affects('noctalia', 'lib/a.test.ts')).toBe(false);
    expect(affects('lucid', 'lib/lucid/README.md')).toBe(false);
    expect(affects('noctalia', 'docs-src/index.html')).toBe(false);
  });
  it('does not turn version-only commits into more releases', () => {
    expect(normalized('app.json', '{"expo":{"version":"3.1.0","android":{"versionCode":68}}}'))
      .toBe(normalized('app.json', '{"expo":{"version":"3.2.0","android":{"versionCode":69}}}'));
    expect(normalized('package.json', '{"version":"3.1.0","scripts":{"a":"b"}}'))
      .toBe(normalized('package.json', '{"version":"3.2.0","scripts":{"a":"b"}}'));
    expect(normalized('package.json', '{"version":"3.1.0","scripts":{}}'))
      .not.toBe(normalized('package.json', '{"version":"3.1.0","scripts":{"postinstall":"patch-native"}}'));
    expect(() => parseArgs(['plan', '--app', 'wrong'])).toThrow();
    expect(() => parseArgs(['plan', '--force'])).toThrow();
  });
});

describe('release planning against real Git histories', () => {
  it('aggregates changes once, writes matching app/package/lock versions, and is idempotent after commit', () => {
    const root = fixture();
    write(root, 'app/home.tsx', 'feature'); commit(root, 'feat: new home');
    write(root, 'lib/lucid/routine.ts', 'fix'); commit(root, 'fix(lucid): correct routine');
    git(root, 'update-ref', 'refs/remotes/origin/master', 'HEAD');
    const plans = prepare(root, ['noctalia', 'lucid', 'meditation']);
    expect(plans.map(p => p.next)).toEqual(['3.2.0', '3.1.1', '3.1.0']);
    expect(verify(root, 'noctalia').version).toBe('3.2.0');
    expect(verify(root, 'lucid').version).toBe('3.1.1');
    commit(root, 'chore(release): prepare versions');
    expect(plan(root, 'noctalia').level).toBe('none');
    expect(plan(root, 'lucid').level).toBe('none');
    git(root, 'update-ref', 'refs/remotes/origin/master', 'HEAD');
    prepare(root, ['noctalia', 'lucid']);
    expect(git(root, 'status', '--porcelain')).toBe('');
  });
  it('ignores reverted runtime changes and documentation-only commits', () => {
    const root = fixture();
    write(root, 'app/home.tsx', 'temporary'); commit(root, 'feat!: experiment');
    write(root, 'app/home.tsx', 'original'); commit(root, 'revert: experiment');
    write(root, 'docs-src/page.md', 'new docs'); commit(root, 'feat: docs');
    expect(plan(root, 'noctalia').level).toBe('none');
  });
  it('stops before writes for major changes, dirty work or an unpublished source', () => {
    const root = fixture();
    write(root, 'app/home.tsx', 'breaking'); commit(root, 'feat!: break compatibility');
    expect(() => prepare(root, ['noctalia'])).toThrow('origin/master');
    git(root, 'update-ref', 'refs/remotes/origin/master', 'HEAD');
    expect(() => prepare(root, ['noctalia'])).toThrow('Breaking change');
    expect(verify(root, 'noctalia').version).toBe('3.1.0');
    write(root, 'notes.txt', 'keep me');
    expect(() => prepare(root, ['noctalia'], true)).toThrow('isolate');
    fs.unlinkSync(path.join(root, 'notes.txt'));
    expect(prepare(root, ['noctalia'], true)[0].next).toBe('4.0.0');
  });
  it('fails closed for missing history and metadata drift', () => {
    const root = fixture();
    const file = path.join(root, 'release/mobile-versions.json');
    const state = JSON.parse(fs.readFileSync(file));
    state.apps.noctalia.sourceRef = 'f'.repeat(40);
    fs.writeFileSync(file, JSON.stringify(state));
    expect(() => plan(root, 'noctalia')).toThrow('Missing baseline');
    write(root, 'package.json', { version: '9.0.0' });
    expect(() => verify(root, 'noctalia')).toThrow('Version drift');
  });
  it('rejects distribution configurations that can reuse a build number', () => {
    const root = fixture();
    write(root, 'eas.json', { cli: { appVersionSource: 'remote' }, build: { production: { autoIncrement: false } } });
    expect(() => verify(root, 'noctalia')).toThrow('autoIncrement');
  });
  it('includes feature commits from an ordinary merge', () => {
    const root = fixture();
    git(root, 'switch', '-c', 'feature');
    write(root, 'app/new.tsx', 'feature'); commit(root, 'feat: new screen');
    git(root, 'switch', 'master');
    git(root, 'merge', '--no-ff', 'feature', '-m', 'Merge pull request #42');
    expect(plan(root, 'noctalia').next).toBe('3.2.0');
  });
  it('can compare a divergent last-build snapshot without pretending it is an ancestor', () => {
    const root = fixture();
    git(root, 'switch', '-c', 'old-build');
    write(root, 'app/build-only.tsx', 'old build');
    const baseline = commit(root, 'fix: old build branch');
    git(root, 'switch', 'master');
    const file = path.join(root, 'release/mobile-versions.json');
    const state = JSON.parse(fs.readFileSync(file));
    state.apps.noctalia.sourceRef = baseline;
    fs.writeFileSync(file, JSON.stringify(state));
    write(root, 'app/home.tsx', 'new feature'); commit(root, 'feat: new flow');
    expect(plan(root, 'noctalia').next).toBe('3.2.0');
  });
  it('rejects an unprepared build before invoking EAS', () => {
    const root = fixture();
    expect(() => main(['build', '--app', 'all', '--platform', 'android'], root)).toThrow('one --app');
    write(root, 'app/home.tsx', 'new fix'); commit(root, 'fix: correct home');
    expect(() => main(['build', '--platform', 'android'], root)).toThrow('Unversioned mobile changes');
  });
  it('detects binary asset changes without decoding them as UTF-8', () => {
    const root = fixture();
    fs.mkdirSync(path.join(root, 'assets/images'), { recursive: true });
    const image = path.join(root, 'assets/images/image.png');
    fs.writeFileSync(image, Buffer.from([255]));
    const baseline = commit(root, 'fix: image');
    const file = path.join(root, 'release/mobile-versions.json');
    const state = JSON.parse(fs.readFileSync(file));
    state.apps.noctalia.sourceRef = baseline;
    fs.writeFileSync(file, JSON.stringify(state));
    fs.writeFileSync(image, Buffer.from([254]));
    commit(root, 'fix: replace image');
    expect(plan(root, 'noctalia').next).toBe('3.1.1');
  });
});
