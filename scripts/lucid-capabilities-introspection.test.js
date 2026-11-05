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
  it('preserves Journal capture while Lucid has local microphone and no HealthKit entitlement', async () => {
    const cwd = createIsolatedProject();
    try {
      const [lucid, journal] = await Promise.all([resolve('lucid', cwd), resolve('journal', cwd)]);
      const lucidPlist = lucid._internal.modResults.ios.infoPlist;
      const journalPlist = journal._internal.modResults.ios.infoPlist;
      expect(lucid.android.permissions).toContain('android.permission.RECORD_AUDIO');
      expect(lucid.android.blockedPermissions).not.toContain('android.permission.RECORD_AUDIO');
      expect(lucidPlist.NSMicrophoneUsageDescription).toContain('on this device');
      expect(lucidPlist.NSSpeechRecognitionUsageDescription).toBeUndefined();
      // Neither app unlocks anything with Face ID, so neither asks for it.
      expect(lucidPlist.NSFaceIDUsageDescription).toBeUndefined();
      expect(journalPlist.NSFaceIDUsageDescription).toBeUndefined();
      expect(lucidPlist.NSCameraUsageDescription).toBeUndefined();
      expect(lucidPlist.NSPhotoLibraryUsageDescription).toBeUndefined();
      expect(lucidPlist.NSHealthShareUsageDescription).toContain('does not read Apple Health');
      expect(lucidPlist.NSHealthUpdateUsageDescription).toContain('never writes');
      expect(lucid._internal.modResults.ios.entitlements['com.apple.developer.healthkit']).toBeUndefined();
      expect(journalPlist.NSCameraUsageDescription).toBeTruthy();
      expect(journalPlist.NSPhotoLibraryUsageDescription).toBeTruthy();
      // Built with the iOS 27 SDK, the app-level status bar calls do nothing: StatusBar from
      // JavaScript needs the per-view-controller appearance, over Expo's default NO.
      expect(journalPlist.UIViewControllerBasedStatusBarAppearance).toBe(true);
      // app.json's own texts, not a plugin's generic default (App Review 5.1.1).
      expect(journalPlist.NSMicrophoneUsageDescription).toMatch(/^Noctalia uses the microphone only while you dictate/);
      expect(journalPlist.NSSpeechRecognitionUsageDescription).toMatch(/^Noctalia turns the dream you tell aloud into text/);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  }, 30000);
});
