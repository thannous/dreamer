'use strict';
/* global describe, expect, it */

const plist = require('plist');
const { assertBuildReady, assertPrivateServe, validateManifest, validateProfile } = require('./ios-local-ota');

describe('local iOS OTA prerequisites', () => {
  it('refuses a native build without a signing identity or team', () => {
    expect(() => assertBuildReady({ nativeProject: true, signingIdentities: 0 }, 'TEAM123456'))
      .toThrow(/signing/);
    expect(() => assertBuildReady({ nativeProject: true, signingIdentities: 1 }, ''))
      .toThrow(/team/);
    expect(() => assertBuildReady({ nativeProject: false, signingIdentities: 1 }, 'TEAM123456'))
      .toThrow(/native/);
  });

  it('refuses remote JavaScript updates in a local binary OTA workflow', () => {
    expect(() => assertBuildReady({ nativeProject: true, signingIdentities: 1, remoteUpdatesEnabled: true }, 'TEAM123456'))
      .toThrow(/remote updates/);
  });

  it('refuses public Funnel or another service on the OTA port', () => {
    expect(() => assertPrivateServe({ AllowFunnel: { 'mac.ts.net:8443': true } }, 'mac.ts.net'))
      .toThrow(/Funnel/);
    expect(() => assertPrivateServe({ TCP: { 8443: { TCPForward: 'localhost:22' } } }, 'mac.ts.net'))
      .toThrow(/8443/);
    expect(() => assertPrivateServe({
      TCP: { 8443: { HTTPS: true } },
      Web: { 'mac.ts.net:8443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:3000' } } } },
    }, 'mac.ts.net')).toThrow(/8443/);
  });

  it('leaves unrelated Serve ports in place and accepts its matching private proxy', () => {
    const cfg = {
      TCP: { 22: { TCPForward: 'localhost:22' }, 8443: { HTTPS: true } },
      Web: { 'mac.ts.net:8443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:8765' } } } },
    };
    const before = JSON.stringify(cfg);
    expect(assertPrivateServe(cfg, 'mac.ts.net')).toBe(true);
    expect(JSON.stringify(cfg)).toBe(before);
  });

  it('checks the Xcode manifest against the binary version and refuses the build counter or another IPA', () => {
    const metadata = { bundleIdentifier: 'com.tanuki75.noctalia', version: '3.4.5', build: '11', title: 'Noctalia & test' };
    const ipaUrl = 'https://mac.ts.net:8443/Noctalia.ipa';
    const manifest = { items: [{
      assets: [{ kind: 'software-package', url: ipaUrl }],
      metadata: {
        'bundle-identifier': metadata.bundleIdentifier, 'bundle-version': metadata.version,
        'platform-identifier': 'com.apple.platform.iphoneos', kind: 'software', title: metadata.title,
      },
    }] };
    const xml = plist.build(manifest);
    expect(validateManifest(metadata, xml, ipaUrl)).toBe(xml);
    expect(() => validateManifest(metadata, xml, 'http://100.64.1.2/Noctalia.ipa')).toThrow(/HTTPS/);
    expect(() => validateManifest({ ...metadata, bundleIdentifier: 'com.other.app' }, xml, ipaUrl))
      .toThrow(/Noctalia/);
    expect(() => validateManifest(metadata, xml, 'https://mac.ts.net/other.ipa')).toThrow(/manifest/);
    manifest.items[0].metadata['bundle-version'] = metadata.build;
    expect(() => validateManifest(metadata, plist.build(manifest), ipaUrl)).toThrow(/manifest/);
  });

  it('refuses expired, Store and unregistered-device provisioning profiles', () => {
    const profile = {
      ExpirationDate: new Date('2100-01-01'),
      ProvisionedDevices: ['iphone-udid'],
      Entitlements: { 'application-identifier': 'TEAM123456.com.tanuki75.noctalia' },
    };
    expect(() => validateProfile(profile, 'iphone-udid')).not.toThrow();
    expect(() => validateProfile({ ...profile, ExpirationDate: new Date('2000-01-01') }, 'iphone-udid'))
      .toThrow(/expired/);
    expect(() => validateProfile({ ...profile, ProvisionedDevices: undefined }, 'iphone-udid'))
      .toThrow(/registered/);
    expect(() => validateProfile(profile, 'another-iphone')).toThrow(/registered/);
    expect(() => validateProfile({ ...profile, Entitlements: { 'application-identifier': 'TEAM123456.com.other.app' } }, 'iphone-udid'))
      .toThrow(/Noctalia/);
  });
});
