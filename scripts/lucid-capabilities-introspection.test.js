const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// Expo introspect merges a pre-existing ios/Info.plist into the result, so a
// local Journal prebuild would leak permissions that the dynamic config removed.
// The symlink root has the config and plugins, and no native projects.
function createIsolatedProject() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-config-'));
  for (const name of ['app.json', 'app.config.ts', 'package.json', 'node_modules', 'plugins', 'release', 'assets', 'babel.config.js']) {
    fs.symlinkSync(path.join(REPO_ROOT, name), path.join(cwd, name));
  }
  return cwd;
}

function resolve(variant, cwd) {
  const env = { ...process.env, EXPO_NO_DOTENV: '1', NOCTALIA_DREAMER_QA_BUILD: '0' };
  delete env.NOCTALIA_APP_VARIANT;
  delete env.EXPO_PUBLIC_APP_VARIANT;
  if (variant === 'lucid') {
    env.NOCTALIA_APP_VARIANT = 'lucid';
    env.EXPO_PUBLIC_APP_VARIANT = 'lucid';
  }
  return new Promise((resolveConfig, reject) => {
    execFile(process.execPath, [
      require.resolve('expo/bin/cli'), 'config', '--type', 'introspect', '--json',
    ], { cwd, env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolveConfig(JSON.parse(stdout));
    });
  });
}

describe('resolved variant capabilities (no native files generated)', () => {
  it('preserves Journal capture while Lucid has local microphone and read-only HealthKit', async () => {
    const cwd = createIsolatedProject();
    try {
      const [lucid, journal] = await Promise.all([resolve('lucid', cwd), resolve('journal', cwd)]);
      const lucidPlist = lucid._internal.modResults.ios.infoPlist;
      const journalPlist = journal._internal.modResults.ios.infoPlist;
      expect(lucid.android.permissions).toContain('android.permission.RECORD_AUDIO');
      expect(lucid.android.blockedPermissions).not.toContain('android.permission.RECORD_AUDIO');
      expect(lucidPlist.NSMicrophoneUsageDescription).toContain('on this device');
      expect(lucidPlist.NSSpeechRecognitionUsageDescription).toBeUndefined();
      expect(lucidPlist.NSFaceIDUsageDescription).toBeUndefined();
      expect(journalPlist.NSFaceIDUsageDescription).toBeTruthy();
      expect(lucidPlist.NSCameraUsageDescription).toBeUndefined();
      expect(lucidPlist.NSPhotoLibraryUsageDescription).toBeUndefined();
      expect(lucidPlist.NSHealthShareUsageDescription).toContain('never writes');
      expect(lucidPlist.NSHealthUpdateUsageDescription).toBeUndefined();
      expect(lucid._internal.modResults.ios.entitlements['com.apple.developer.healthkit']).toBe(true);
      expect(journalPlist.NSCameraUsageDescription).toBeTruthy();
      expect(journalPlist.NSPhotoLibraryUsageDescription).toBeTruthy();
      expect(journalPlist.NSMicrophoneUsageDescription).toBeTruthy();
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  }, 30000);
});
