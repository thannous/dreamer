'use strict';
/* global afterEach, describe, expect, it */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const plist = require('@expo/plist').default;
const { syncMobileBuildVersions } = require('./sync-mobile-build-versions');

const roots = [];
const remote = () => ({ versionCode: '82', buildNumber: '11' });
function fixture(native = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'build-version-sync-'));
  roots.push(root);
  const write = (file, value) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), value);
  };
  write('app.json', JSON.stringify({ expo: {
    name: 'Noctalia', version: '3.4.5',
    android: { package: 'com.tanuki75.noctalia', versionCode: 68 },
    ios: { bundleIdentifier: 'com.tanuki75.noctalia' },
    extra: { eas: { projectId: 'cfd1b275-9dad-40d7-9d9a-147c7bb38415' } },
  } }, null, 2) + '\n');
  write('eas.json', JSON.stringify({ cli: { appVersionSource: 'remote' } }));
  if (native) {
    write('android/app/build.gradle', 'applicationId "com.tanuki75.noctalia"\nversionCode 68\nversionName "3.4.3"\n');
    write('ios/Noctalia/Info.plist', plist.build({
      CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
      CFBundleVersion: '1', CFBundleShortVersionString: '3.4.3',
      NSMicrophoneUsageDescription: 'Keep this purpose string',
    }));
    write('ios/Noctalia.xcodeproj/project.pbxproj', `// !$*UTF8*$!
{
  archiveVersion = 1;
  objectVersion = 54;
  objects = {
/* Begin PBXProject section */
    P = { isa = PBXProject; targets = (A /* Noctalia */,); };
/* End PBXProject section */
/* Begin PBXNativeTarget section */
    A /* Noctalia */ = { isa = PBXNativeTarget; name = Noctalia; productType = "com.apple.product-type.application"; buildConfigurationList = L; };
/* End PBXNativeTarget section */
/* Begin XCConfigurationList section */
    L = { isa = XCConfigurationList; buildConfigurations = (D /* Debug */, R /* Release */,); };
/* End XCConfigurationList section */
/* Begin XCBuildConfiguration section */
    D = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.tanuki75.noctalia; INFOPLIST_FILE = Noctalia/Info.plist; CURRENT_PROJECT_VERSION = 1; MARKETING_VERSION = 1.0; }; };
    R = { isa = XCBuildConfiguration; name = Release; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.tanuki75.noctalia; INFOPLIST_FILE = Noctalia/Info.plist; CURRENT_PROJECT_VERSION = 1; MARKETING_VERSION = 1.0; }; };
/* End XCBuildConfiguration section */
  };
  rootObject = P;
}
`);
  }
  return root;
}
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));

describe('EAS build number synchronization', () => {
  it('synchronizes config, Gradle, plist and Xcode settings without changing app data', () => {
    const root = fixture();
    syncMobileBuildVersions({ root, readRemote: remote });
    const config = JSON.parse(read(root, 'app.json')).expo;
    expect(config.android.versionCode).toBe(82);
    expect(config.ios.buildNumber).toBe('11');
    expect(read(root, 'android/app/build.gradle')).toContain('versionName "3.4.5"');
    expect(read(root, 'android/app/build.gradle')).toContain('versionCode 82');
    expect(plist.parse(read(root, 'ios/Noctalia/Info.plist'))).toMatchObject({
      CFBundleVersion: '11', CFBundleShortVersionString: '3.4.5',
      NSMicrophoneUsageDescription: 'Keep this purpose string',
    });
    expect(read(root, 'ios/Noctalia.xcodeproj/project.pbxproj')).toContain('CURRENT_PROJECT_VERSION = 11');
    expect(syncMobileBuildVersions({ root, readRemote: remote }).changed).toEqual([]);
  });

  it('supports an absent native project and a read-only drift check', () => {
    const root = fixture(false);
    const before = read(root, 'app.json');
    expect(() => syncMobileBuildVersions({ root, readRemote: remote, check: true })).toThrow(/out of sync/);
    expect(read(root, 'app.json')).toBe(before);
    syncMobileBuildVersions({ root, readRemote: remote });
    expect(fs.existsSync(path.join(root, 'android'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'ios'))).toBe(false);
    expect(syncMobileBuildVersions({ root, readRemote: remote, check: true }).changed).toEqual([]);
  });

  it.each([{}, { versionCode: '82' }, { versionCode: 'bad', buildNumber: '11' }, { versionCode: '67', buildNumber: '11' }])('rejects incomplete, invalid or lower remote versions without writes: %j', value => {
    const root = fixture();
    const before = read(root, 'app.json');
    expect(() => syncMobileBuildVersions({ root, readRemote: () => value })).toThrow();
    expect(read(root, 'app.json')).toBe(before);
    expect(read(root, 'android/app/build.gradle')).toContain('versionCode 68');
  });

  it('does not write on service failure or erase a concurrent edit', () => {
    const root = fixture();
    const before = read(root, 'app.json');
    expect(() => syncMobileBuildVersions({ root, readRemote: () => { throw new Error('offline'); } })).toThrow('offline');
    expect(read(root, 'app.json')).toBe(before);
    expect(() => syncMobileBuildVersions({ root, readRemote: () => {
      fs.writeFileSync(path.join(root, 'app.json'), before + '\n');
      return remote();
    } })).toThrow(/changed during/);
    expect(read(root, 'app.json')).toBe(before + '\n');
    expect(read(root, 'android/app/build.gradle')).toContain('versionCode 68');
  });

  it.each(['android/app/build.gradle', 'ios/Noctalia.xcodeproj/project.pbxproj'])('refuses a different native application before writing: %s', file => {
    const root = fixture();
    const before = read(root, 'app.json');
    fs.writeFileSync(path.join(root, file), read(root, file).replaceAll('com.tanuki75.noctalia', 'com.other.app'));
    expect(() => syncMobileBuildVersions({ root, readRemote: remote })).toThrow(/identity/);
    expect(read(root, 'app.json')).toBe(before);
  });

  it('syncs only the requested platform', () => {
    const root = fixture();
    const ios = read(root, 'ios/Noctalia/Info.plist');
    syncMobileBuildVersions({ root, platform: 'android', readRemote: () => ({ versionCode: '82' }) });
    expect(read(root, 'ios/Noctalia/Info.plist')).toBe(ios);
    expect(JSON.parse(read(root, 'app.json')).expo.ios.buildNumber).toBeUndefined();
  });
});
