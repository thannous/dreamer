'use strict';
/* global describe, expect, it, jest */

const { readReleaseIdentity, validateReleaseRef } = require('./check-android-release-ref');

describe('Android release ref guard', () => {
  it('reads a consistent release identity', () => {
    const readFileSync = jest.fn((filePath) => JSON.stringify(
      String(filePath).endsWith('app.json')
        ? { expo: { version: '2.0.2', runtimeVersion: '2.0.2', android: { versionCode: 33 } } }
        : { version: '2.0.2' }
    ));

    expect(readReleaseIdentity('/repo', readFileSync)).toEqual({
      version: '2.0.2',
      versionCode: 33,
    });
  });

  it('rejects version drift between app, runtime, and package metadata', () => {
    const packageDrift = (filePath) => JSON.stringify(
      String(filePath).endsWith('app.json')
        ? { expo: { version: '2.0.2', runtimeVersion: '2.0.2', android: { versionCode: 33 } } }
        : { version: '2.0.1' }
    );
    const runtimeDrift = (filePath) => JSON.stringify(
      String(filePath).endsWith('app.json')
        ? { expo: { version: '2.0.2', runtimeVersion: '2.0.1', android: { versionCode: 33 } } }
        : { version: '2.0.2' }
    );

    expect(() => readReleaseIdentity('/repo', packageDrift)).toThrow('package.json version');
    expect(() => readReleaseIdentity('/repo', runtimeDrift)).toThrow('runtimeVersion');
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
