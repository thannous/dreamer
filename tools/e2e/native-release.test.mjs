import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateReleaseReceipt, runWithInstallDiagnostics, normalizeAvdName, validateBuildCommand, nativeInputs, archiveReleaseBinary, releaseMetadata } from './native-release.mjs';
import { virtualLinks } from './test-support/virtual-links.mjs';
const sha = 'a'.repeat(64);
test('iteration APK commands never qualify as Release on either path syntax', () => {
  for (const wrapper of ['/repo/android/gradlew', 'C:\\repo\\android\\gradlew.bat']) {
    validateBuildCommand([wrapper, ':app:assembleRelease'], 'android');
    assert.throws(() => validateBuildCommand([wrapper, ':app:assembleDebug'], 'android'));
    assert.throws(() => validateBuildCommand([wrapper, ':app:assembleRelease', '--incremental'], 'android'));
  }
  for (const [node, script] of [['/bin/node', '/repo/scripts/build-android-release-local.js'],
    ['C:\\node\\node.exe', 'C:\\repo\\scripts\\build-android-release-local.js']]) {
    validateBuildCommand([node, script, '--reuse-native-project'], 'android');
    assert.throws(() => validateBuildCommand([node, script, '--reuse-native-project', '--incremental'], 'android'));
    assert.throws(() => validateBuildCommand([node, script, '--incremental'], 'android'));
  }
});
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
test('Pods links are fingerprinted with their local targets; foreign links and cycles are refused', t => {
  const links = virtualLinks(t);
  const root = mkdtempSync(join(tmpdir(), 'noctalia-native-inputs-'));
  const foreign = mkdtempSync(join(tmpdir(), 'noctalia-foreign-'));
  try {
    mkdirSync(join(root, 'ios', 'Pods', 'Headers'), { recursive: true }); mkdirSync(join(root, 'node_modules', 'public'), { recursive: true });
    writeFileSync(join(root, 'ios', 'Podfile.lock'), 'public pod lock'); writeFileSync(join(root, 'node_modules', 'public', 'header.h'), 'public header');
    links.link('../../../node_modules/public/header.h', join(root, 'ios', 'Pods', 'Headers', 'header.h'));
    const relativeLinkDigest = nativeInputs(root, 'dreamer', 'ios').digest;
    // Canonical and aliased checkout roots must see the same link and target bytes.
    assert.equal(nativeInputs(realpathSync(root), 'dreamer', 'ios').digest, relativeLinkDigest);
    // The relative path resolves inside the owned checkout, just like installed CocoaPods headers.
    links.unlink(join(root, 'ios', 'Pods', 'Headers', 'header.h'));
    links.link(join(root, 'node_modules', 'public', 'header.h'), join(root, 'ios', 'Pods', 'Headers', 'header.h'));
    const initial = nativeInputs(root, 'dreamer', 'ios').digest;
    assert.equal(initial, relativeLinkDigest);
    writeFileSync(join(root, 'node_modules', 'public', 'header.h'), 'changed header');
    assert.notEqual(nativeInputs(root, 'dreamer', 'ios').digest, initial);
    writeFileSync(join(foreign, 'secret'), 'foreign'); links.link(join(foreign, 'secret'), join(root, 'ios', 'foreign'));
    assert.throws(() => nativeInputs(root, 'dreamer', 'ios'), /NATIVE_LINK/); links.unlink(join(root, 'ios', 'foreign'));
    links.link(join(root, 'ios'), join(root, 'ios', 'cycle')); assert.throws(() => nativeInputs(root, 'dreamer', 'ios'), /NATIVE_LINK/);
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(foreign, { recursive: true, force: true }); }
});

test('read receipts obey the same bounded/profile rules as their canonical build', () => {
  for (const mutate of [r => { r.profile.name = 'lucid-mock'; }, r => { r.profile.name = 'production-apk'; },
    r => { r.profile.categorizationDelayMs = 1; }, r => { r.profile.categorizationDelayMs = 60001; },
    r => { r.startedAt = '2100-01-01T00:00:00Z'; }, r => { r.finishedAt = 'invalid'; }]) {
    const r = receipt(); mutate(r); assert.throws(() => validateReleaseReceipt(r, expected));
  }
});

// A UI journey cannot prove a receipt refuses a hosted origin or forged mode.
// Keep that trust boundary independent of the happy-path native evidence.
test('local backend receipts require real modes, a disposable identity and strict loopback origin', () => {
  const local = () => ({ ...receipt(), bundle: 'com.tanuki75.noctalia.qa', profile: {
    name: 'local-backend', mock: false, persistence: false, audioMock: false, featureSheets: false,
    categorizationDelayMs: 0, nativeQaAudio: true,
    backend: { origin: 'http://127.0.0.1:31283', stackId: sha, anonKeySha256: sha },
  } });
  const localExpected = { ...expected, bundle: 'com.tanuki75.noctalia.qa' };
  assert.equal(validateReleaseReceipt(local(), localExpected).profile.name, 'local-backend');
  const alternativePort = local(); alternativePort.profile.backend.origin = 'http://127.0.0.1:32001';
  validateReleaseReceipt(alternativePort, localExpected);
  for (const origin of ['https://127.0.0.1:31283', 'http://localhost:31283', 'http://10.0.2.2:31283',
    'http://example.com:31283', 'http://127.0.0.1:19999', 'http://127.0.0.1:32768',
    'http://user:pass@127.0.0.1:31283', 'http://127.0.0.1:31283/', 'http://127.0.0.1:31283/api',
    'http://127.0.0.1:31283?host=example.com', 'http://127.0.0.1:31283#fragment']) {
    const r = local(); r.profile.backend.origin = origin;
    assert.throws(() => validateReleaseReceipt(r, localExpected), /RELEASE_PROFILE/);
  }
  for (const mutate of [r => { r.profile.mock = true; }, r => { r.profile.persistence = true; },
    r => { r.profile.audioMock = true; }, r => { r.profile.nativeQaAudio = false; },
    r => { delete r.profile.nativeQaAudio; }, r => { r.profile.backend.stackId = 'other'; },
    r => { delete r.profile.backend; }, r => { r.profile.backend.anonKeySha256 = 'other'; }]) {
    const r = local(); mutate(r);
    assert.throws(() => validateReleaseReceipt(r, localExpected), /RELEASE_PROFILE/);
  }
  const ios = { ...local(), platform: 'ios', buildCommand: ['xcodebuild', '-configuration', 'Release', 'build'] };
  assert.throws(() => validateReleaseReceipt(ios, { ...localExpected, platform: 'ios' }), /RELEASE_PROFILE/);
  ios.binary.signed = true;
  validateReleaseReceipt(ios, { ...localExpected, platform: 'ios' });
});

test('archived Release bytes survive a later cache rebuild, partial or existing copies never qualify', t => {
  const links = virtualLinks(t);
  const root = mkdtempSync(join(tmpdir(), 'noctalia-binary-archive-'));
  try {
    const original = join(root, 'app-release.apk'), output = join(root, 'output'); mkdirSync(output); writeFileSync(original, 'public release APK');
    const copy = archiveReleaseBinary(original, 'android', output); writeFileSync(original, 'different rebuild');
    assert.equal(readFileSync(copy.path, 'utf8'), 'public release APK');
    assert.equal(archiveReleaseBinary(original, 'android', join(root, 'second')).sha256.length, 64);
    assert.notEqual(archiveReleaseBinary(original, 'android', join(root, 'third')).sha256, copy.sha256);
    assert.throws(() => archiveReleaseBinary(original, 'android', output), /ARCHIVE|EEXIST/);
    links.link(original, join(root, 'foreign.apk')); assert.throws(() => archiveReleaseBinary(join(root, 'foreign.apk'), 'android', join(root, 'refused')), /SYMLINK/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// The real QA APK had ENABLED=true followed by another false metadata flag. The
// previous regexp mistook the attribute ID's 0x0 prefix for the value and certified OTA=false.
// UI E2E cannot exercise malformed build metadata without rebuilding every case.
test('OTA provenance reads the complete boolean belonging to ENABLED only', () => {
  const root = mkdtempSync(join(tmpdir(), 'noctalia-ota-metadata-'));
  mkdirSync(join(root, 'build-tools', '37.0.0'), { recursive: true });
  const node = value => `      E: meta-data (line=148)\n        A: android:name(0x01010003)="expo.modules.updates.ENABLED" (Raw: "expo.modules.updates.ENABLED")\n        A: android:value(0x01010024)=(type 0x12)${value}\n`;
  const other = '      E: meta-data (line=151)\n        A: android:name(0x01010003)="other.flag"\n        A: android:value(0x01010024)=(type 0x12)0x0\n';
  const metadata = manifest => releaseMetadata('/qa.apk', 'android', { ANDROID_HOME: root }, (_cmd, args) =>
    args[1] === 'badging' ? "package: name='com.tanuki75.noctalia' versionCode='83' versionName='3.7.0'" : manifest);
  try {
    assert.throws(() => metadata(node('0xffffffff') + other), /OTA_NOT_PINNED/);
    assert.throws(() => metadata(other), /OTA_NOT_PINNED/);
    assert.throws(() => metadata(node('0x01') + other), /OTA_NOT_PINNED/);
    assert.equal(metadata(node('0x0') + other).otaEnabled, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
