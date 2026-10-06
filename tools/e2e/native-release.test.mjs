import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateReleaseReceipt, runWithInstallDiagnostics, normalizeAvdName, validateBuildCommand, nativeInputs, archiveReleaseBinary } from './native-release.mjs';
const sha = 'a'.repeat(64);
const receipt = () => ({ schemaVersion: 1, kind: 'noctalia-native-release', product: 'dreamer', platform: 'android',
  bundle: 'com.tanuki75.noctalia', configuration: 'Release', buildExitCode: 0, source: { revision: 'a'.repeat(40), inputDigest: sha },
  nativeInputDigest: sha, binary: { path: '/public/fixture.apk', sha256: sha, version: '3.4.5', build: '83' },
  profile: { name: 'mock-persistent', mock: true, persistence: true, audioMock: true, featureSheets: true, categorizationDelayMs: 30000 },
  startedAt: '2026-10-06T00:00:00.000Z', finishedAt: '2026-10-06T00:00:01.000Z', buildCommand: ['gradlew', ':app:assembleRelease'] });
const expected = { product: 'dreamer', platform: 'android', bundle: 'com.tanuki75.noctalia', inputDigest: sha, nativeInputDigest: sha, binaryDigest: sha };
test('same-version different binary, changed source/native inputs, nonRelease and wrong profile are refused', () => {
  assert.equal(validateReleaseReceipt(receipt(), expected).binary.build, '83');
  for (const mutation of [r => { r.binary.sha256 = 'b'.repeat(64); }, r => { r.source.inputDigest = 'b'.repeat(64); },
    r => { r.nativeInputDigest = 'b'.repeat(64); }, r => { r.configuration = 'Debug'; }, r => { r.bundle = 'foreign'; },
    r => { r.profile.name = 'unknown'; }, r => { r.buildExitCode = 1; }]) {
    const r = receipt(); mutation(r); assert.throws(() => validateReleaseReceipt(r, expected));
  }
});
test('AVD protocol normalizes only the observed name plus optional OK, rejects extra targets/errors', () => {
  assert.equal(normalizeAvdName('Pixel_9_API_37\r\nOK'), 'Pixel_9_API_37');
  assert.equal(normalizeAvdName('Pixel_9_API_37\n'), 'Pixel_9_API_37');
  for (const raw of ['', 'Pixel_9_API_37\nforeign', 'Pixel_9_API_37\nERROR']) assert.throws(() => normalizeAvdName(raw));
});
test('Release source and profile fields cannot coerce array/string flags into a valid identity', () => {
  for (const mutate of [r => { r.startedAt = [r.startedAt]; }, r => { r.finishedAt = [r.finishedAt]; }, r => { r.buildCommand = ['xcodebuild', '-configuration', 'Debug', 'build']; }, r => { r.source.revision = [r.source.revision]; }, r => { r.profile.mock = 'true'; },
    r => { r.profile.featureSheets = 'false'; }, r => { r.profile.categorizationDelayMs = [30000]; }]) {
    const r = receipt(); mutate(r); assert.throws(() => validateReleaseReceipt(r, expected));
  }
});
test('installation diagnostics are independent, SDK still runs, and invalid identity cannot disappear', async () => {
  for (const failure of ['install', 'hash', 'both', null]) {
    const actions = [], diagnostics = []; let sdk = 0;
    const install = async () => { actions.push('install'); if (failure === 'install' || failure === 'both') throw Error('public install refusal'); };
    const verifyInstalled = async () => { actions.push('hash'); if (failure === 'hash' || failure === 'both') throw Error('public hash refusal'); };
    const launch = async () => { actions.push('sdk'); sdk++; return 1; };
    const result = await runWithInstallDiagnostics({ install, verifyInstalled, launch, onDiagnostic: (code, error) => diagnostics.push({ code, reason: error.message }) });
    assert.equal(sdk, 1); assert.equal(result.sdkResult, 1); assert.deepEqual(actions, ['install', 'hash', 'sdk']);
    assert.equal(result.installationOk, !['install', 'both'].includes(failure)); assert.equal(result.installedIdentityOk, !['hash', 'both'].includes(failure));
    assert.equal(diagnostics.length, failure === 'both' ? 2 : failure ? 1 : 0);
    for (const diagnostic of diagnostics) assert.equal(diagnostic.reason, diagnostic.code === 'INSTALLATION_REFUSED' ? 'public install refusal' : 'public hash refusal');
  }
});

test('canonical descriptor refuses duplicate or Debug configuration and preserves explicit native build tools', () => {
  validateBuildCommand(['xcodebuild', '-configuration', 'Release', 'build'], 'ios');
  for (const command of [['xcodebuild', '-configuration', 'Release', '-configuration', 'Debug', 'build'], ['gradlew', ':app:assembleRelease', ':app:assembleDebug']])
    assert.throws(() => validateBuildCommand(command, command[0] === 'xcodebuild' ? 'ios' : 'android'));
});
test('Pods links are fingerprinted with their local targets; foreign links and cycles are refused', () => {
  const root = mkdtempSync(join(tmpdir(), 'noctalia-native-inputs-'));
  const foreign = mkdtempSync(join(tmpdir(), 'noctalia-foreign-'));
  try {
    mkdirSync(join(root, 'ios', 'Pods', 'Headers'), { recursive: true }); mkdirSync(join(root, 'node_modules', 'public'), { recursive: true });
    writeFileSync(join(root, 'ios', 'Podfile.lock'), 'public pod lock'); writeFileSync(join(root, 'node_modules', 'public', 'header.h'), 'public header');
    symlinkSync('../../../node_modules/public/header.h', join(root, 'ios', 'Pods', 'Headers', 'header.h'));
    // The relative path resolves inside the owned checkout, just like installed CocoaPods headers.
    rmSync(join(root, 'ios', 'Pods', 'Headers', 'header.h'));
    symlinkSync(join(root, 'node_modules', 'public', 'header.h'), join(root, 'ios', 'Pods', 'Headers', 'header.h'));
    const initial = nativeInputs(root, 'dreamer', 'ios').digest;
    writeFileSync(join(root, 'node_modules', 'public', 'header.h'), 'changed header');
    assert.notEqual(nativeInputs(root, 'dreamer', 'ios').digest, initial);
    writeFileSync(join(foreign, 'secret'), 'foreign'); symlinkSync(join(foreign, 'secret'), join(root, 'ios', 'foreign'));
    assert.throws(() => nativeInputs(root, 'dreamer', 'ios'), /NATIVE_LINK/); rmSync(join(root, 'ios', 'foreign'));
    symlinkSync(join(root, 'ios'), join(root, 'ios', 'cycle')); assert.throws(() => nativeInputs(root, 'dreamer', 'ios'), /NATIVE_LINK/);
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(foreign, { recursive: true, force: true }); }
});

test('read receipts obey the same bounded/profile rules as their canonical build', () => {
  for (const mutate of [r => { r.profile.name = 'lucid-mock'; }, r => { r.profile.name = 'production-apk'; },
    r => { r.profile.categorizationDelayMs = 1; }, r => { r.profile.categorizationDelayMs = 60001; },
    r => { r.startedAt = '2100-01-01T00:00:00Z'; }, r => { r.finishedAt = 'invalid'; }]) {
    const r = receipt(); mutate(r); assert.throws(() => validateReleaseReceipt(r, expected));
  }
});

test('archived Release bytes survive a later cache rebuild, partial or existing copies never qualify', () => {
  const root = mkdtempSync(join(tmpdir(), 'noctalia-binary-archive-'));
  try {
    const original = join(root, 'app-release.apk'), output = join(root, 'output'); mkdirSync(output); writeFileSync(original, 'public release APK');
    const copy = archiveReleaseBinary(original, 'android', output); writeFileSync(original, 'different rebuild');
    assert.equal(readFileSync(copy.path, 'utf8'), 'public release APK');
    assert.equal(archiveReleaseBinary(original, 'android', join(root, 'second')).sha256.length, 64);
    assert.notEqual(archiveReleaseBinary(original, 'android', join(root, 'third')).sha256, copy.sha256);
    assert.throws(() => archiveReleaseBinary(original, 'android', output), /ARCHIVE|EEXIST/);
    symlinkSync(original, join(root, 'foreign.apk')); assert.throws(() => archiveReleaseBinary(join(root, 'foreign.apk'), 'android', join(root, 'refused')), /SYMLINK/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
