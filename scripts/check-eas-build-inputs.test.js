'use strict';
/* global describe, expect, it */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// E2E app journeys cannot inspect the local EAS fingerprint or Apple's uploaded Info.plist.
// Failure modes: an external native module path changes the runtime hash on EAS;
// missing, empty or plugin-removed HealthKit descriptions make Apple reject an IPA;
// a QA bundle identifier can be selected accidentally for the store build;
// local Gradle output inside a fingerprinted native package can diverge from EAS npm ci.
const { assertPortableFingerprint, assertCleanNativeModules, assertIosStoreConfig, assertAndroidStoreConfig } = require('./check-eas-build-inputs');

const infoPlist = {
  NSHealthShareUsageDescription: 'Reads selected sleep records',
  NSHealthUpdateUsageDescription: 'Does not write health data',
};
const resolved = (plist = infoPlist, bundleIdentifier = 'com.tanuki75.noctalia') => ({
  ios: { bundleIdentifier },
  _internal: { modResults: { ios: { infoPlist: plist } } },
});

describe('EAS store build input preflight', () => {
  it('rejects native fingerprint sources resolved outside the checkout', () => {
    expect(() => assertPortableFingerprint({ sources: [{ type: 'file', filePath: '../../../Users/tanuki/Documents/dreamer/node_modules/plugin.js' }] })).toThrow('outside');
    expect(() => assertPortableFingerprint({ sources: [{ type: 'dir', filePath: '/Users/tanuki/Documents/dreamer/node_modules/plugin' }] })).toThrow('outside');
    expect(() => assertPortableFingerprint({ sources: [{ type: 'file', filePath: 'node_modules/plugin.js' }] })).not.toThrow();
  });
  it('rejects Gradle output inside a fingerprinted native module', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-eas-preflight-'));
    const modulePath = 'node_modules/@react-native-masked-view/masked-view';
    const fingerprint = { sources: [{ type: 'dir', filePath: modulePath, reasons: ['rncoreAutolinkingAndroid'] }] };
    try {
      fs.mkdirSync(path.join(root, modulePath, 'android', 'build'), { recursive: true });
      expect(() => assertCleanNativeModules(root, fingerprint, 'android')).toThrow('npm ci');
      fs.rmSync(path.join(root, modulePath, 'android', 'build'), { recursive: true });
      expect(() => assertCleanNativeModules(root, fingerprint, 'android')).not.toThrow();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  it('rejects the QA Android package during a Store build', () => {
    expect(() => assertAndroidStoreConfig({ android: { package: 'com.tanuki75.noctalia' } }, 'noctalia')).not.toThrow();
    expect(() => assertAndroidStoreConfig({ android: { package: 'com.tanuki75.noctalia.qa' } }, 'noctalia')).toThrow('android.package');
  });
  it('checks the resolved iOS Info.plist and the store app identity', () => {
    expect(() => assertIosStoreConfig(resolved(), 'noctalia')).not.toThrow();
    expect(() => assertIosStoreConfig(resolved({ NSHealthShareUsageDescription: 'Reads sleep', NSHealthUpdateUsageDescription: '  ' }), 'noctalia')).toThrow('NSHealthUpdateUsageDescription');
    expect(() => assertIosStoreConfig(resolved({ NSHealthUpdateUsageDescription: 'No writes' }), 'noctalia')).toThrow('NSHealthShareUsageDescription');
    expect(() => assertIosStoreConfig(resolved(infoPlist, 'com.tanuki75.noctalia.qa'), 'noctalia')).toThrow('bundleIdentifier');
    expect(() => assertIosStoreConfig({ ios: { bundleIdentifier: 'com.tanuki75.noctalia' } }, 'noctalia')).toThrow('Info.plist');
  });
});
