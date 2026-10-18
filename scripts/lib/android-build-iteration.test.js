'use strict';
/* global describe, it, expect, afterEach, jest */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { STATE_FILE, LOCK_FILE, buildContext, iterationPlan, recordBuild, acquireBuildLock } = require('./android-build-iteration');
const { getGradleArgs, getOutputApkPath, runChecked } = require('../build-android-release-local');

// Browser journeys cannot manufacture an interrupted build, incompatible native
// cache or another builder's lock. These controls exercise those failure modes;
// the APK benchmark separately checks that a JS edit reaches the rebuilt bundle.
describe('Android iteration safety (same cases on every host)', () => {
  const roots = [];
  const fixture = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'android iteration ')); roots.push(root);
    fs.mkdirSync(path.join(root, 'android', 'app'), { recursive: true });
    fs.writeFileSync(path.join(root, 'android', 'app', 'build.gradle'), 'native fixture');
    return root;
  };
  const options = () => ({ env: { JAVA_HOME: '/java17', EXPO_PUBLIC_MOCK_MODE: 'false' },
    abi: 'x86_64', profile: 'production-apk', profileable: false, sideBySideQa: true });
  afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
  it('keeps default qualification clean, permits only passed identical iteration inputs', () => {
    const root = fixture(), context = buildContext(root, options());
    expect(iterationPlan(root, context, true).reuse).toBe(false);
    recordBuild(root, { context }, 'passed');
    expect(iterationPlan(root, context, false).reuse).toBe(false);
    expect(iterationPlan(root, context, true).reuse).toBe(true);
    expect(getGradleArgs('x86_64')).toEqual(expect.arrayContaining([':app:clean', '--no-build-cache', '--no-daemon']));
    const args = getGradleArgs('x86_64', undefined, true);
    expect(args).toEqual(expect.arrayContaining([':app:assembleRelease', '--build-cache', '--daemon']));
    expect(args).not.toContain(':app:clean');
    expect(getOutputApkPath(root, 'production-apk', false, true, true)).toMatch(/-iteration\.apk$/);
  });
  it.each(['building', 'failed', 'corrupt', 'unknown-schema'])('cannot reuse %s state', status => {
    const root = fixture(), context = buildContext(root, options());
    recordBuild(root, { context }, status);
    if (status === 'corrupt') fs.writeFileSync(path.join(root, STATE_FILE), '{');
    if (status === 'unknown-schema') fs.writeFileSync(path.join(root, STATE_FILE), JSON.stringify({ schemaVersion: 2, status: 'passed', context }));
    expect(iterationPlan(root, context, true).reuse).toBe(false);
  });
  it.each(['abi', 'profile', 'profileable', 'sideBySideQa', 'env', 'native', 'dependency', 'patch'])('invalidates changed %s inputs', field => {
    const root = fixture(), input = options(), before = buildContext(root, input);
    recordBuild(root, { context: before }, 'passed');
    if (field === 'native') fs.appendFileSync(path.join(root, 'android/app/build.gradle'), 'changed');
    else if (field === 'dependency') fs.writeFileSync(path.join(root, 'package-lock.json'), 'changed lock');
    else if (field === 'patch') { fs.mkdirSync(path.join(root, 'patches')); fs.writeFileSync(path.join(root, 'patches/fix.patch'), 'changed'); }
    else if (field === 'env') input.env.EXPO_PUBLIC_MOCK_MODE = 'true';
    else input[field] = typeof input[field] === 'boolean' ? !input[field] : 'changed';
    expect(iterationPlan(root, buildContext(root, input), true).reuse).toBe(false);
  });
  it('ignores only generated Gradle outputs and leaves ordinary JS edits to task inputs', () => {
    const root = fixture(), before = buildContext(root, options());
    fs.mkdirSync(path.join(root, 'android/app/build'), { recursive: true });
    fs.writeFileSync(path.join(root, 'android/app/build/output'), 'generated');
    fs.writeFileSync(path.join(root, 'index.ts'), 'changed JS');
    expect(buildContext(root, options())).toBe(before);
    fs.mkdirSync(path.join(root, 'android/app/src/build'), { recursive: true });
    fs.writeFileSync(path.join(root, 'android/app/src/build/source'), 'native source named build');
    expect(buildContext(root, options())).not.toBe(before);
  });
  it('refuses concurrent builders and never releases another owner lock', () => {
    const root = fixture(), release = acquireBuildLock(root);
    expect(() => acquireBuildLock(root)).toThrow('lock exists'); release();
    const otherRelease = acquireBuildLock(root);
    fs.writeFileSync(path.join(root, LOCK_FILE), JSON.stringify({ token: 'foreign' }));
    expect(otherRelease).toThrow('ownership changed');
    expect(JSON.parse(fs.readFileSync(path.join(root, LOCK_FILE), 'utf8')).token).toBe('foreign');
  });
  it('passes spaced and literal command arguments without shell evaluation', () => {
    const root = fixture(), output = path.join(root, 'args.json');
    const args = ['two words', 'quote"value', 'a&b', '$(literal)', 'C:\\two words\\file'];
    runChecked(process.execPath, ['-e', 'require("fs").writeFileSync(process.argv[1],JSON.stringify(process.argv.slice(2)))', output, ...args]);
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(args);
  });
  it('refuses linked native inputs on every OS without requiring symlink privileges', () => {
    const root = fixture(), lstat = fs.lstatSync;
    const adapter = jest.spyOn(fs, 'lstatSync').mockImplementation(file =>
      file === path.join(root, 'android/app/build.gradle') ? { isSymbolicLink: () => true } : lstat(file));
    try { expect(() => buildContext(root, options())).toThrow('symlinks'); }
    finally { adapter.mockRestore(); }
  });
  it('preserves the complete old state when atomic replacement fails', () => {
    const root = fixture(); recordBuild(root, { context: 'old' }, 'passed');
    const adapter = jest.spyOn(fs, 'renameSync').mockImplementation(() => { throw Object.assign(new Error('I/O failure'), { code: 'EIO' }); });
    try { expect(() => recordBuild(root, { context: 'new' }, 'building')).toThrow('I/O failure'); }
    finally { adapter.mockRestore(); }
    expect(JSON.parse(fs.readFileSync(path.join(root, STATE_FILE), 'utf8'))).toEqual({ schemaVersion: 1, context: 'old', status: 'passed' });
    expect(fs.readdirSync(path.join(root, '.expo'))).toEqual(['android-build-state.json']);
  });
});
