import { existsSync, readFileSync, rmSync, lstatSync, readdirSync, realpathSync, copyFileSync, cpSync, mkdirSync, constants } from 'node:fs';
import { join, resolve, basename, relative, sep } from 'node:path';
import { digest, directoryFiles, hashFiles, sourceSnapshot } from './qualification.mjs';

const refusal = code => { throw new Error(code); };
const profiles = new Set(['production-apk', 'mock-persistent', 'local-backend', 'lucid-mock', 'meditation-local']);
function isLocalBackendOrigin(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value), port = Number(url.port);
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' && !url.username && !url.password
      && port >= 20000 && port <= 32767 && url.origin === value;
  } catch { return false; }
}
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
    // Bind the boolean to ENABLED's own metadata element. A later false flag
    // must never turn an OTA-enabled binary into an allegedly pinned Release.
    const ota = manifest.match(/A: android:name[^\n]*="expo\.modules\.updates\.ENABLED"[^\n]*\n\s*A: android:value[^\n]*?\(type 0x12\)(0xffffffff|0x0)(?=\s|$)/);
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
/** Inspect the public config inside the actual artifact, never the desired build env. */
export function verifyLocalBackendBinaryConfig({ binaryPath, platform, profile, read, record = () => {} }) {
  const backend = profile?.backend;
  if (profile?.name !== 'local-backend' || !isLocalBackendOrigin(backend?.origin)
    || !/^[a-f0-9]{64}$/.test(backend?.anonKeySha256 ?? '')) refusal('LOCAL_BACKEND_CONFIG_PROFILE');
  let raw, configPath, config;
  try {
    if (platform === 'android') {
      configPath = 'assets/app.config';
      raw = read('unzip', ['-p', binaryPath, configPath]);
    } else if (platform === 'ios') {
      // EXConstantsService resolves its resource bundle beside the class bundle:
      // the main app for static pods, or EXConstants.framework for dynamic pods.
      const candidates = ['EXConstants.bundle/app.config', 'Frameworks/EXConstants.framework/EXConstants.bundle/app.config']
        .filter(candidate => existsSync(join(binaryPath, candidate)));
      if (candidates.length !== 1) throw new Error('Missing or ambiguous config.');
      configPath = candidates[0];
      const actual = realpathSync(join(binaryPath, configPath));
      if (!actual.startsWith(realpathSync(binaryPath) + sep)) throw new Error('Config escaped the binary.');
      raw = readFileSync(actual, 'utf8');
    } else throw new Error('Unsupported platform.');
    config = JSON.parse(raw);
  } catch {
    record({ schemaVersion: 1, platform, configurationRead: false });
    refusal('LOCAL_BACKEND_BINARY_CONFIG_UNREADABLE');
  }
  const extra = config?.extra;
  const anonHash = typeof extra?.supabaseAnonKey === 'string' ? digest(extra.supabaseAnonKey) : null;
  const functionHash = typeof extra?.supabaseFunctionJwt === 'string' ? digest(extra.supabaseFunctionJwt) : null;
  const proof = {
    schemaVersion: 1, platform, configPath, configurationRead: true, configurationSha256: digest(raw),
    backendOriginMatches: extra?.supabaseUrl === backend.origin,
    apiUrlMatches: extra?.apiUrl === `${backend.origin}/functions/v1/api`,
    anonKeySha256: anonHash, publicKeyMatches: anonHash === backend.anonKeySha256,
    functionKeySha256: functionHash, functionKeyMatches: functionHash === backend.anonKeySha256,
    storeKeysDisabled: ['revenuecatAndroidKey', 'revenuecatIosKey', 'revenuecatWebKey'].every(key => extra?.[key] === ''),
    qaMarkerMatches: extra?.nativeQaAudio === true && extra?.eas?.projectId === 'noctalia-qa-local',
  };
  // Evidence contains only booleans/digests, never the config, public keys or tokens.
  record(proof);
  if (!proof.backendOriginMatches || !proof.apiUrlMatches || !proof.publicKeyMatches || !proof.functionKeyMatches
    || !proof.storeKeysDisabled || !proof.qaMarkerMatches) refusal('LOCAL_BACKEND_BINARY_CONFIG_MISMATCH');
  return proof;
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
  if ((receipt.product === 'dreamer' && !['production-apk', 'mock-persistent', 'local-backend'].includes(receipt.profile.name))
    || (receipt.profile.name === 'production-apk' && receipt.profile.mock)
    || (receipt.profile.categorizationDelayMs !== 0 && (!receipt.profile.mock || !receipt.profile.persistence || receipt.profile.categorizationDelayMs < 20000 || receipt.profile.categorizationDelayMs > 60000))
    || (receipt.product === 'lucid' && receipt.profile.name !== 'lucid-mock')
    || (receipt.profile.name === 'lucid-mock' && !receipt.profile.mock)
    || (receipt.product === 'meditation' && receipt.profile.name !== 'meditation-local')
    || (receipt.profile.name === 'mock-persistent' && (!receipt.profile.mock || !receipt.profile.persistence))
    || (receipt.profile.name === 'local-backend' && (receipt.profile.mock || receipt.profile.audioMock || receipt.profile.persistence
      || receipt.profile.nativeQaAudio !== true
      || receipt.bundle !== 'com.tanuki75.noctalia.qa' || !receipt.profile.backend
      || !isLocalBackendOrigin(receipt.profile.backend.origin)
      || !/^[a-f0-9]{64}$/.test(receipt.profile.backend.stackId ?? '')
      || !/^[a-f0-9]{64}$/.test(receipt.profile.backend.anonKeySha256 ?? '')
      || (receipt.platform === 'ios' && !receipt.binary.signed)))
    || (receipt.platform === 'ios' && receipt.product === 'lucid' && !receipt.binary.signed)) refusal('RELEASE_PROFILE');
  return receipt;
}
export async function runWithInstallDiagnostics({ install, verifyInstalled, launch, onDiagnostic }) {
  let installationOk = true, installedIdentityOk = true;
  try { if (install) await install(); } catch (error) { installationOk = false; onDiagnostic('INSTALLATION_REFUSED', error); }
  try { await verifyInstalled(); } catch (error) { installedIdentityOk = false; onDiagnostic('INSTALLED_START_REFUSED', error); }
  return { installationOk, installedIdentityOk, sdkResult: await launch() };
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
  if (command.includes('--incremental')) refusal('BUILD_COMMAND_NOT_CANONICAL_RELEASE');
  const name = basename(command[0].replaceAll('\\', '/')).replace(/\.(?:exe|bat)$/i, '');
  if (platform === 'ios' && name === 'xcodebuild' && command.filter(value => value === '-configuration').length === 1 && command[command.indexOf('-configuration') + 1] === 'Release' && command.includes('build')) return;
  if (platform === 'android' && name === 'gradlew' && command.includes(':app:assembleRelease') && !command.some(value => /assembleDebug|bundleDebug|test|install/i.test(value))) return;
  if (platform === 'android' && name === 'node' && command[1]?.replaceAll('\\', '/').endsWith('/scripts/build-android-release-local.js')
    && command.includes('--reuse-native-project')) return;
  refusal('BUILD_COMMAND_NOT_CANONICAL_RELEASE');
}

export function archiveReleaseBinary(path, platform, output) {
  const original = binaryInputs(path, platform);
  mkdirSync(output, { recursive: true });
  const archived = join(output, platform === 'android' ? 'release.apk' : 'Release.app');
  if (existsSync(archived)) refusal('BINARY_ARCHIVE_EXISTS');
  if (platform === 'android') copyFileSync(path, archived, constants.COPYFILE_EXCL);
  else cpSync(path, archived, { recursive: true, force: false, errorOnExist: true });
  const retained = binaryInputs(archived, platform);
  if (retained.sha256 !== original.sha256) refusal('BINARY_ARCHIVE_BYTES');
  return { ...retained, originPath: original.path };
}
