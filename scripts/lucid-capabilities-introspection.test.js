const { execFileSync } = require('node:child_process');
const path = require('node:path');

function resolve(variant) {
  const env = { ...process.env, EXPO_NO_DOTENV: '1', NOCTALIA_DREAMER_QA_BUILD: '0' };
  delete env.NOCTALIA_APP_VARIANT;
  delete env.EXPO_PUBLIC_APP_VARIANT;
  if (variant === 'lucid') {
    env.NOCTALIA_APP_VARIANT = 'lucid';
    env.EXPO_PUBLIC_APP_VARIANT = 'lucid';
  }
  return JSON.parse(execFileSync(process.execPath, [
    require.resolve('expo/bin/cli'), 'config', '--type', 'introspect', '--json',
  ], { cwd: path.resolve(__dirname, '..'), env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
}

describe('resolved variant capabilities (no native files generated)', () => {
  it('preserves Journal capture while Lucid has local microphone and read-only HealthKit', () => {
    const lucid = resolve('lucid');
    const journal = resolve('journal');
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
  }, 30000);
});
