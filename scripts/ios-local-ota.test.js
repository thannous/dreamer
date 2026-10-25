'use strict';
/* global describe, expect, it */

const plist = require('plist');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  assertBuildEnvironment, assertBuildReady, assertPrivateServe, getExplicitDeviceUdid,
  prepareBuildEnvironment, readDevice, validateManifest, validateProfile,
} = require('./ios-local-ota');

const googleEnv = {
  EXPO_PUBLIC_MOCK_MODE: 'false',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '123-web.apps.googleusercontent.com',
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '123-ios.apps.googleusercontent.com',
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_fixture',
};
const googleScheme = 'com.googleusercontent.apps.123-ios';

describe('local iOS OTA prerequisites', () => {
  it('rejects absent or blank Google IDs before invoking native build tools', () => {
    for (const key of ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID']) {
      expect(() => assertBuildEnvironment({ ...googleEnv, [key]: '  ' }, [googleScheme]))
        .toThrow(key);
    }
    expect(() => prepareBuildEnvironment(undefined, {
      env: { EXPO_PUBLIC_MOCK_MODE: 'false' }, cwd: '/checkout-without-ios',
      readFileSync: () => { throw new Error('Native project is unavailable'); },
    })).toThrow('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is required');
    const result = spawnSync(process.execPath, [
      path.join(__dirname, 'ios-local-ota.js'), 'build', '--team', 'TEAM123456',
      '--device', '00000001-0000000000000001',
    ], { env: { PATH: '', EXPO_PUBLIC_MOCK_MODE: 'false' }, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is required');
    expect(result.stdout).toBe('');
  });

  it('accepts complete real configuration and explicit mock builds without Google IDs', () => {
    expect(() => assertBuildEnvironment(googleEnv, [googleScheme])).not.toThrow();
    expect(() => assertBuildEnvironment({ EXPO_PUBLIC_MOCK_MODE: 'true' }, [])).not.toThrow();
    expect(() => assertBuildEnvironment({}, [])).toThrow('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  });

  it('rejects missing or incompatible Apple purchase keys before reading the native project', () => {
    for (const apiKey of [undefined, '', '  ', 'goog_fixture', 'test_fixture', 'sk_fixture', 'appl_']) {
      const env = { ...googleEnv, EXPO_PUBLIC_REVENUECAT_IOS_KEY: apiKey };
      expect(() => assertBuildEnvironment(env, [googleScheme]))
        .toThrow('EXPO_PUBLIC_REVENUECAT_IOS_KEY');
      expect(() => prepareBuildEnvironment(undefined, {
        env, cwd: '/checkout-without-ios',
        readFileSync: () => { throw new Error('Native project is unavailable'); },
      })).toThrow('EXPO_PUBLIC_REVENUECAT_IOS_KEY');
    }
    expect(() => assertBuildEnvironment(googleEnv, [googleScheme])).not.toThrow();
    expect(() => prepareBuildEnvironment(undefined, {
      env: { EXPO_PUBLIC_MOCK_MODE: 'true' }, cwd: '/checkout-without-ios',
      readFileSync: () => { throw new Error('Native project is unavailable'); },
    })).not.toThrow();
  });

  it('refuses a Google iOS client whose callback is absent from the native project', () => {
    expect(() => assertBuildEnvironment(googleEnv, ['com.googleusercontent.apps.another-client']))
      .toThrow(/must match a Google URL scheme/);
    expect(() => assertBuildEnvironment({ ...googleEnv, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'invalid' }, [googleScheme]))
      .toThrow(/must match a Google URL scheme/);
  });

  it('loads the selected profile and prevents a later dotenv overlay', () => {
    const env = { EXPO_PUBLIC_MOCK_MODE: 'true', EXPO_NO_DOTENV: '0' };
    prepareBuildEnvironment('.env.playstore', {
      cwd: '/repo', env,
      readFileSync: (filePath) => {
        if (filePath === path.resolve('/repo', '.env.playstore')) {
          return Object.entries(googleEnv).map(([key, value]) => `${key}=${value}`).join('\n');
        }
        expect(filePath).toBe(path.join('/repo', 'ios/Noctalia/Info.plist'));
        return plist.build({ CFBundleURLTypes: [{ CFBundleURLSchemes: [googleScheme] }] });
      },
    });
    expect(env.EXPO_PUBLIC_MOCK_MODE).toBe('false');
    expect(env.EXPO_NO_DOTENV).toBe('1');
    const inheritedEnv = { ...googleEnv, EXPO_NO_DOTENV: '0' };
    prepareBuildEnvironment(undefined, {
      env: inheritedEnv,
      readFileSync: () => plist.build({ CFBundleURLTypes: [{ CFBundleURLSchemes: [googleScheme] }] }),
    });
    expect(inheritedEnv.EXPO_NO_DOTENV).toBe('1');
  });

  it('accepts explicit modern and legacy device UDIDs without CoreDevice discovery', () => {
    for (const udid of ['00000001-0000000000000001', '0123456789abcdef0123456789abcdef01234567']) {
      expect(getExplicitDeviceUdid(udid)).toBe(udid);
      expect(readDevice(udid)).toBe(udid);
    }
    expect(getExplicitDeviceUdid('iPhone')).toBeUndefined();
    expect(getExplicitDeviceUdid('00000001-000000000000001')).toBeUndefined();
  });

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
