'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Expo's version pinned in ios/Podfile.lock, or null when there is no project.
function readPodfileLockExpoVersion(iosDir) {
  let lock;
  try {
    lock = fs.readFileSync(path.join(iosDir, 'Podfile.lock'), 'utf8');
  } catch {
    return null;
  }
  const match = lock.match(/^ {2}- Expo \(([^)]+)\):?$/m);
  return match ? match[1] : null;
}

function readInstalledExpoVersion(cwd) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, 'node_modules/expo/package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

// A native project generated for another Expo SDK cannot pod-install against the
// current node_modules (Local Podspecs mismatch), so it has to be regenerated.
function detectIosNativeDrift(cwd = process.cwd()) {
  const iosDir = path.join(cwd, 'ios');
  if (!fs.existsSync(iosDir)) return null;
  const nativeVersion = readPodfileLockExpoVersion(iosDir);
  const installedVersion = readInstalledExpoVersion(cwd);
  if (!nativeVersion || !installedVersion || nativeVersion === installedVersion) return null;
  return { nativeVersion, installedVersion };
}

// Same precedence as CocoaPods: CP_CACHE_DIR, then ~/.cocoapods/config.yaml.
function cocoaPodsCacheRoot(env = process.env, home = os.homedir()) {
  if (env.CP_CACHE_DIR) return env.CP_CACHE_DIR;
  try {
    const config = fs.readFileSync(path.join(home, '.cocoapods/config.yaml'), 'utf8');
    const match = config.match(/^cache_root:\s*['"]?([^'"\n]+?)['"]?\s*$/m);
    if (match) return match[1].replace(/^~(?=\/|$)/, home);
  } catch {
    // No CocoaPods config: use its default below.
  }
  return path.join(home, 'Library/Caches/CocoaPods');
}

function hasEmptyDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  if (entries.length === 0) return true;
  return entries.some((entry) => entry.isDirectory() && hasEmptyDirectory(path.join(dir, entry.name)));
}

// Downloaded pods are cached under Pods/Release/<pod>/<version>. A healthy entry
// never contains an empty folder; macOS purging ~/Library/Caches under disk
// pressure removed files but kept folders, and `pod install` then reused the
// truncated entry silently, breaking the build with missing headers.
function findTruncatedCocoaPodsEntries(cacheRoot) {
  const releaseDir = path.join(cacheRoot, 'Pods/Release');
  if (!fs.existsSync(releaseDir)) return [];
  const truncated = [];
  for (const pod of fs.readdirSync(releaseDir, { withFileTypes: true })) {
    if (!pod.isDirectory()) continue;
    const podDir = path.join(releaseDir, pod.name);
    for (const version of fs.readdirSync(podDir, { withFileTypes: true })) {
      const entryDir = path.join(podDir, version.name);
      if (version.isDirectory() && hasEmptyDirectory(entryDir)) truncated.push({ name: pod.name, dir: entryDir });
    }
  }
  return truncated;
}

function removeTruncatedCocoaPodsEntries(cacheRoot) {
  const truncated = findTruncatedCocoaPodsEntries(cacheRoot);
  for (const entry of truncated) fs.rmSync(entry.dir, { recursive: true, force: true });
  return truncated;
}

// Pods copied from a truncated cache entry are truncated too.
function hasTruncatedProjectPods(cwd, entries) {
  return entries.some(({ name }) => {
    const podDir = path.join(cwd, 'ios/Pods', name);
    return fs.existsSync(podDir) && hasEmptyDirectory(podDir);
  });
}

function prebuildIos({ cwd = process.cwd(), env = process.env, run = spawnSync } = {}) {
  const result = run(
    process.execPath,
    [require.resolve('expo/bin/cli', { paths: [cwd] }), 'prebuild', '--platform', 'ios', '--clean', '--no-install'],
    { cwd, env: { ...env, EXPO_NO_GIT_STATUS: '1' }, stdio: 'inherit' },
  );
  if (result.status !== 0) throw new Error('[ios] expo prebuild failed; the native project was not regenerated');
}

// Runs before `expo run:ios` so a stale project or a truncated pod cache is
// repaired instead of failing deep inside pod install or xcodebuild.
function prepareIosNativeProject({
  cwd = process.cwd(),
  env = process.env,
  log = console.error,
  prebuild = prebuildIos,
} = {}) {
  const removed = removeTruncatedCocoaPodsEntries(cocoaPodsCacheRoot(env));
  if (removed.length > 0) {
    log(`[ios] Removed ${removed.length} truncated CocoaPods cache entr${removed.length === 1 ? 'y' : 'ies'}: ${removed.map((entry) => entry.name).join(', ')}`);
  }

  const drift = detectIosNativeDrift(cwd);
  if (drift) {
    log(`[ios] Native project targets Expo ${drift.nativeVersion} but node_modules has ${drift.installedVersion}; regenerating ios/`);
    prebuild({ cwd, env });
    return { removed, regenerated: true };
  }

  if (hasTruncatedProjectPods(cwd, removed)) {
    log('[ios] ios/Pods was installed from the truncated cache; removing it so pod install restores it');
    fs.rmSync(path.join(cwd, 'ios/Pods'), { recursive: true, force: true });
  }
  return { removed, regenerated: false };
}

module.exports = {
  detectIosNativeDrift,
  findTruncatedCocoaPodsEntries,
  prepareIosNativeProject,
  readPodfileLockExpoVersion,
  removeTruncatedCocoaPodsEntries,
};
