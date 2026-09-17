'use strict';
/* global describe, expect, it, jest */

const { readReleaseIdentity, validateReleaseRef } = require('./check-android-release-ref');

describe('Android release ref guard', () => {
  it('reads a consistent release identity', () => {
    const readFileSync = jest.fn((filePath) => JSON.stringify(
      String(filePath).endsWith('app.json')
        ? { expo: { version: '2.0.2', runtimeVersion: { policy: 'fingerprint' }, android: { versionCode: 33 } } }
        : { version: '2.0.2' }
    ));

    expect(readReleaseIdentity('/repo', readFileSync)).toEqual({
      version: '2.0.2',
      versionCode: 33,
      runtimeVersionPolicy: 'fingerprint',
    });
  });

  it('rejects version drift between app and package metadata', () => {
    const packageDrift = (filePath) => JSON.stringify(
      String(filePath).endsWith('app.json')
        ? { expo: { version: '2.0.2', runtimeVersion: { policy: 'fingerprint' }, android: { versionCode: 33 } } }
        : { version: '2.0.1' }
    );

    expect(() => readReleaseIdentity('/repo', packageDrift)).toThrow('package.json version');
  });

  it('rejects a static runtimeVersion string', () => {
    const runtimeString = (filePath) => JSON.stringify(
      String(filePath).endsWith('app.json')
        ? { expo: { version: '2.0.2', runtimeVersion: '2.0.2', android: { versionCode: 33 } } }
        : { version: '2.0.2' }
    );

    expect(() => readReleaseIdentity('/repo', runtimeString)).toThrow('runtimeVersion must use policy fingerprint, received string 2.0.2');
  });

  it('rejects a non-fingerprint runtimeVersion policy', () => {
    const runtimePolicy = (filePath) => JSON.stringify(
      String(filePath).endsWith('app.json')
        ? { expo: { version: '2.0.2', runtimeVersion: { policy: 'appVersion' }, android: { versionCode: 33 } } }
        : { version: '2.0.2' }
    );

    expect(() => readReleaseIdentity('/repo', runtimePolicy)).toThrow('runtimeVersion must use policy fingerprint, received policy appVersion');
  });

  it('accepts the exact release tag and rejects a mismatched tag', () => {
    const releaseIdentity = { version: '2.0.2', versionCode: 33 };

    expect(validateReleaseRef({
      refName: 'v2.0.2',
      refType: 'tag',
      releaseIdentity,
    })).toMatchObject(releaseIdentity);
    expect(() => validateReleaseRef({
      refName: 'v2.0.1',
      refType: 'tag',
      releaseIdentity,
    })).toThrow('does not match v2.0.2');
  });

  it('allows a manual workflow run without a tag', () => {
    expect(validateReleaseRef({
      refName: '',
      refType: '',
      releaseIdentity: { version: '2.0.2', versionCode: 33 },
    })).toMatchObject({ version: '2.0.2', versionCode: 33 });
  });

  it('requires the EAS build output to use the app.json versionCode', () => {
    const releaseIdentity = { version: '2.0.2', versionCode: 33 };

    expect(validateReleaseRef({
      builtVersionCode: '33',
      releaseIdentity,
    })).toMatchObject({ builtVersionCode: '33' });
    expect(() => validateReleaseRef({
      builtVersionCode: '32',
      releaseIdentity,
    })).toThrow('EAS build versionCode 32 does not match app.json 33');
  });
});
