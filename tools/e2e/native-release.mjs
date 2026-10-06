import { existsSync, readFileSync, rmSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve, basename, relative, sep } from 'node:path';
import { digest, directoryFiles, hashFiles, sourceSnapshot } from './qualification.mjs';

const refusal = code => { throw new Error(code); };
const profiles = new Set(['production-apk', 'mock-persistent', 'lucid-mock', 'meditation-local']);
export function normalizeAvdName(raw) {
  const lines = raw.trim().split(/\r?\n/).map(line => line.trim());
  if (!lines[0] || lines.length > 2 || (lines.length === 2 && lines[1] !== 'OK')) refusal('AVD_PROTOCOL');
  return lines[0];
}
export function nativeInputs(root, product, platform) {
  const prefix = (product === 'meditation' ? 'apps/meditation/' : '') + (platform === 'android' ? 'android' : 'ios');
  if (!existsSync(join(root, prefix, platform === 'android' ? 'gradlew' : 'Podfile.lock'))) refusal('NATIVE_PROJECT_MISSING');
  // CocoaPods headers/frameworks legitimately link to this checkout's installed
  // packages. Keep both the relative destination and its bytes in the receipt;
  // refuse links escaping the owned checkout and recursive directory cycles.
  const owned = realpathSync(root), files = {}, cache = new Map();
  const ignored = new Set(['build', '.gradle', '.cxx', '.kotlin', '.DS_Store', 'xcuserdata', '.expo']);
  function node(path, active = new Set()) {
    const actual = realpathSync(path);
    if (!actual.startsWith(owned + sep)) refusal('NATIVE_LINK_OUTSIDE');
    if (active.has(actual)) refusal('NATIVE_LINK_CYCLE');
    if (cache.has(actual)) return cache.get(actual);
    const stat = lstatSync(actual);
    let value;
    if (stat.isFile()) value = digest(readFileSync(actual));
    else if (stat.isDirectory()) {
      const next = new Set(active).add(actual);
      value = digest(JSON.stringify(readdirSync(actual).sort().filter(name => !ignored.has(name)).map(name => [name, node(join(actual, name), next)])));
    } else refusal('NATIVE_INPUT_TYPE');
    cache.set(actual, value); return value;
  }
  function walk(path) {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ignored.has(entry.name)) continue;
      const full = join(path, entry.name), key = relative(root, full).split(sep).join('/');
      if (entry.isSymbolicLink()) files[key] = { target: relative(owned, realpathSync(full)).split(sep).join('/'), sha256: node(full) };
      else if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files[key] = node(full);
      else refusal('NATIVE_INPUT_TYPE');
    }
  }
  walk(join(root, prefix));
  return { files, digest: digest(JSON.stringify(files)) };
}
export function appInputs(root, product) {
  const snapshot = sourceSnapshot(root, product, true);
  const entries = Object.entries(snapshot.files).filter(([file]) => product !== 'meditation' || file.startsWith('apps/meditation/'));
  return { revision: snapshot.revision, files: Object.fromEntries(entries), inputDigest: digest(JSON.stringify(entries)) };
}
export function binaryInputs(path, platform) {
  if (lstatSync(path).isSymbolicLink()) refusal('BINARY_SYMLINK');
  if (platform === 'android') return { path: resolve(path), sha256: digest(readFileSync(path)) };
  const files = hashFiles(path, directoryFiles(path, '.'));
  return { path: resolve(path), files, sha256: digest(JSON.stringify(files)) };
}
export function releaseMetadata(path, platform, env, read) {
  if (platform === 'android') {
    const tools = join(env.ANDROID_HOME, 'build-tools');
    // Use the same installed SDK tools selected by the build, never @latest.
    const aapt = readdirSync(tools).filter(name => /^\d+(\.\d+)+$/.test(name)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
    if (!aapt) refusal('ANDROID_BUILD_TOOLS_MISSING');
    const output = read(join(tools, aapt, 'aapt'), ['dump', 'badging', path]);
    const pkg = output.match(/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/m);
    if (!pkg || output.includes('application-debuggable')) refusal('ANDROID_NOT_RELEASE');
    const manifest = read(join(tools, aapt, 'aapt'), ['dump', 'xmltree', path, 'AndroidManifest.xml']);
    const ota = manifest.match(/expo\.modules\.updates\.ENABLED[\s\S]*?android:value[^\n]*?(0xffffffff|0x0)/);
    if (!ota || ota[1] !== '0x0') refusal('OTA_NOT_PINNED');
    return { bundle: pkg[1], version: pkg[3], build: pkg[2], otaEnabled: false, manifestSha256: digest(manifest) };
  }
  const plist = JSON.parse(read('plutil', ['-convert', 'json', '-o', '-', join(path, 'Info.plist')]));
  if (!plist.CFBundleSupportedPlatforms?.includes('iPhoneSimulator') || plist.CFBundlePackageType !== 'APPL') refusal('IOS_NOT_SIMULATOR');
  const executable = join(path, plist.CFBundleExecutable);
  if (!existsSync(executable) || !existsSync(join(path, 'main.jsbundle'))) refusal('IOS_EMBEDDED_BUNDLE_MISSING');
  const expoPlist = join(path, 'Expo.plist');
  if (existsSync(expoPlist) && JSON.parse(read('plutil', ['-convert', 'json', '-o', '-', expoPlist])).EXUpdatesEnabled === true) refusal('OTA_NOT_PINNED');
  const signed = existsSync(join(path, '_CodeSignature', 'CodeResources'));
  if (signed) read('codesign', ['--verify', '--strict', path]);
  return { bundle: plist.CFBundleIdentifier, version: plist.CFBundleShortVersionString, build: plist.CFBundleVersion,
    otaEnabled: false, signed, executableSha256: digest(readFileSync(executable)), embeddedJsSha256: digest(readFileSync(join(path, 'main.jsbundle'))) };
}
export function validateReleaseReceipt(receipt, expected) {
  if (receipt?.schemaVersion !== 1 || receipt.kind !== 'noctalia-native-release'
    || receipt.product !== expected.product || receipt.platform !== expected.platform || receipt.bundle !== expected.bundle
    || receipt.configuration !== 'Release' || receipt.buildExitCode !== 0
    || typeof receipt.source?.revision !== 'string' || !/^[a-f0-9]{40}$/.test(receipt.source.revision) || receipt.source.inputDigest !== expected.inputDigest
    || receipt.nativeInputDigest !== expected.nativeInputDigest || receipt.binary?.sha256 !== expected.binaryDigest
    || !/^[a-f0-9]{64}$/.test(receipt.binary.sha256) || !profiles.has(receipt.profile?.name)
    || !Array.isArray(receipt.buildCommand) || !receipt.buildCommand.length
    || typeof receipt.startedAt !== 'string' || typeof receipt.finishedAt !== 'string'
    || !Number.isFinite(Date.parse(receipt.startedAt)) || !Number.isFinite(Date.parse(receipt.finishedAt)) || Date.parse(receipt.finishedAt) < Date.parse(receipt.startedAt)
    || Date.parse(receipt.finishedAt) > Date.now()
    || ['mock', 'persistence', 'audioMock', 'featureSheets'].some(key => typeof receipt.profile[key] !== 'boolean')
    || !Number.isSafeInteger(receipt.profile.categorizationDelayMs) || receipt.profile.categorizationDelayMs < 0) refusal('RELEASE_PROVENANCE');
  validateBuildCommand(receipt.buildCommand, receipt.platform);
  if ((receipt.product === 'dreamer' && !['production-apk', 'mock-persistent'].includes(receipt.profile.name))
    || (receipt.profile.name === 'production-apk' && receipt.profile.mock)
    || (receipt.profile.categorizationDelayMs !== 0 && (!receipt.profile.mock || !receipt.profile.persistence || receipt.profile.categorizationDelayMs < 20000 || receipt.profile.categorizationDelayMs > 60000))
    || (receipt.product === 'lucid' && receipt.profile.name !== 'lucid-mock')
    || (receipt.product === 'meditation' && receipt.profile.name !== 'meditation-local')
    || (receipt.profile.name === 'mock-persistent' && (!receipt.profile.mock || !receipt.profile.persistence))
    || (receipt.platform === 'ios' && receipt.product === 'lucid' && !receipt.binary.signed)) refusal('RELEASE_PROFILE');
  return receipt;
}
export async function installVerifiedRelease({ install, verifyInstalled, launch }) {
  if (install) await install();
  await verifyInstalled();
  return launch();
}
export function verifyInstalledRelease({ receipt, device, output, read }) {
  if (receipt.platform === 'android') {
    const dump = read('adb', ['-s', device, 'shell', 'dumpsys', 'package', receipt.bundle]);
    if (!dump.includes('Package [' + receipt.bundle + ']') || /DEBUGGABLE/.test(dump)
      || dump.match(/versionCode=(\d+)/)?.[1] !== receipt.binary.build
      || dump.match(/versionName=(\S+)/)?.[1] !== receipt.binary.version) refusal('INSTALLED_VERSION');
    const paths = read('adb', ['-s', device, 'shell', 'pm', 'path', receipt.bundle]).split('\n');
    if (paths.length !== 1 || !/^package:\/data\/app\/.+\/base\.apk$/.test(paths[0])) refusal('INSTALLED_APK_PATH');
    const pulled = join(output, 'installed-verification.apk');
    try {
      read('adb', ['-s', device, 'pull', paths[0].slice(8), pulled]);
      if (binaryInputs(pulled, 'android').sha256 !== receipt.binary.sha256) refusal('INSTALLED_HASH');
    } finally { rmSync(pulled, { force: true }); }
  } else {
    const app = read('xcrun', ['simctl', 'get_app_container', device, receipt.bundle, 'app']);
    if (binaryInputs(app, 'ios').sha256 !== receipt.binary.sha256) refusal('INSTALLED_HASH');
  }
  return { checkedAt: new Date().toISOString(), device, bundle: receipt.bundle,
    binarySha256: receipt.binary.sha256, buildSource: receipt.source.revision, hashMatches: true };
}
export function validateBuildCommand(command, platform) {
  if (!Array.isArray(command) || !command.length || command.some(value => typeof value !== 'string' || !value)) refusal('BUILD_COMMAND');
  const name = basename(command[0]);
  if (platform === 'ios' && name === 'xcodebuild' && command.filter(value => value === '-configuration').length === 1 && command[command.indexOf('-configuration') + 1] === 'Release' && command.includes('build')) return;
  if (platform === 'android' && name === 'gradlew' && command.includes(':app:assembleRelease') && !command.some(value => /assembleDebug|bundleDebug|test|install/i.test(value))) return;
  if (platform === 'android' && name === 'node' && command[1]?.endsWith('/scripts/build-android-release-local.js')
    && command.includes('--reuse-native-project')) return;
  refusal('BUILD_COMMAND_NOT_CANONICAL_RELEASE');
}
