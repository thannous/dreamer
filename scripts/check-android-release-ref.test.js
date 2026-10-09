'use strict';
/* global describe, expect, it, jest */

const { readReleaseIdentity, readRequireBuiltVersionCode, validateReleaseRef } = require('./check-android-release-ref');

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

  // The tag ref is the release tag of the identity, so only the built-code
  // requirement is under test.
  describe('REQUIRE_BUILT_ANDROID_VERSION_CODE', () => {
    const releaseIdentity = { version: '3.5.0', versionCode: 74 };
    const tagRef = { refName: 'v3.5.0', refType: 'tag', releaseIdentity };

    it('fails on an empty or missing built code when the flag is on', () => {
      for (const versionSource of ['remote', 'local']) {
        expect(() => validateReleaseRef({ ...tagRef, versionSource, requireBuiltVersionCode: true, builtVersionCode: '' }))
          .toThrow('BUILT_ANDROID_VERSION_CODE is empty');
        expect(() => validateReleaseRef({ ...tagRef, versionSource, requireBuiltVersionCode: true }))
          .toThrow('BUILT_ANDROID_VERSION_CODE is empty');
        // An expected code alone does not stand for a checked build.
        expect(() => validateReleaseRef({
          ...tagRef,
          versionSource,
          requireBuiltVersionCode: true,
          expectedRemoteVersionCode: '75',
        })).toThrow('BUILT_ANDROID_VERSION_CODE is empty');
      }
    });

    it('passes a valid built and expected pair when the flag is on', () => {
      expect(validateReleaseRef({
        ...tagRef,
        versionSource: 'remote',
        requireBuiltVersionCode: true,
        builtVersionCode: '75',
        expectedRemoteVersionCode: '75',
      })).toMatchObject({ builtVersionCode: '75', versionCode: 75 });
      expect(validateReleaseRef({ ...tagRef, requireBuiltVersionCode: true, builtVersionCode: '74' }))
        .toMatchObject({ builtVersionCode: '74', versionCode: 74 });
      // The flag adds a requirement; it relaxes none of the others.
      expect(() => validateReleaseRef({
        ...tagRef,
        versionSource: 'remote',
        requireBuiltVersionCode: true,
        builtVersionCode: '75',
        expectedRemoteVersionCode: '76',
      })).toThrow('does not match the EAS build');
      expect(() => validateReleaseRef({ ...tagRef, versionSource: 'remote', requireBuiltVersionCode: true, builtVersionCode: '75' }))
        .toThrow('EXPECTED_ANDROID_VERSION_CODE');
    });

    it('keeps the current behaviour when the flag is off', () => {
      for (const requireBuiltVersionCode of [false, undefined]) {
        expect(validateReleaseRef({ ...tagRef, versionSource: 'remote', requireBuiltVersionCode }))
          .toMatchObject({ builtVersionCode: '', versionCode: 74 });
        expect(validateReleaseRef({ ...tagRef, versionSource: 'remote', requireBuiltVersionCode, expectedRemoteVersionCode: '75' }))
          .toMatchObject({ builtVersionCode: '', versionCode: 74 });
      }
    });

    it("reads the flag from the environment, '1' on and empty or '0' off", () => {
      expect(readRequireBuiltVersionCode({ REQUIRE_BUILT_ANDROID_VERSION_CODE: '1' })).toBe(true);
      expect(readRequireBuiltVersionCode({ REQUIRE_BUILT_ANDROID_VERSION_CODE: ' 1 ' })).toBe(true);
      expect(readRequireBuiltVersionCode({ REQUIRE_BUILT_ANDROID_VERSION_CODE: '0' })).toBe(false);
      expect(readRequireBuiltVersionCode({ REQUIRE_BUILT_ANDROID_VERSION_CODE: '' })).toBe(false);
      expect(readRequireBuiltVersionCode({})).toBe(false);
      // A typo must not silently turn the requirement off.
      expect(() => readRequireBuiltVersionCode({ REQUIRE_BUILT_ANDROID_VERSION_CODE: 'true' })).toThrow("must be '1' or '0'");
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

  it('fails a manual workflow run without a tag instead of skipping the check', () => {
    const releaseIdentity = { version: '2.0.2', versionCode: 33 };

    expect(() => validateReleaseRef({ refName: '', refType: '', releaseIdentity })).toThrow('No release tag given');
    expect(() => validateReleaseRef({ releaseIdentity })).toThrow('No release tag given');
    // A branch ref is not a tag identity.
    expect(() => validateReleaseRef({ refName: 'master', refType: 'branch', releaseIdentity })).toThrow('No release tag given');
  });

  it('checks the release_tag input of a dispatched run against app.json', () => {
    const releaseIdentity = { version: '2.0.2', versionCode: 33 };

    expect(validateReleaseRef({ releaseTag: 'v2.0.2', releaseIdentity })).toMatchObject({ releaseTag: 'v2.0.2' });
    expect(() => validateReleaseRef({ releaseTag: 'v2.0.1', releaseIdentity })).toThrow('Release tag v2.0.1 does not match v2.0.2');
    expect(() => validateReleaseRef({ releaseTag: '2.0.2', releaseIdentity })).toThrow('does not match v2.0.2');
    expect(() => validateReleaseRef({
      releaseTag: 'v2.0.2',
      refName: 'v2.0.1',
      refType: 'tag',
      releaseIdentity,
    })).toThrow('does not match the tag ref v2.0.1');
  });

  it('requires the EAS build output to use the app.json versionCode', () => {
    const releaseIdentity = { version: '2.0.2', versionCode: 33 };

    expect(validateReleaseRef({
      builtVersionCode: '33',
      releaseTag: 'v2.0.2',
      releaseIdentity,
    })).toMatchObject({ builtVersionCode: '33' });
    expect(() => validateReleaseRef({
      builtVersionCode: '32',
      releaseTag: 'v2.0.2',
      releaseIdentity,
    })).toThrow('EAS build versionCode 32 does not match app.json 33');
  });

  it('compares remote builds with their exact EAS metadata, not the local mirror', () => {
    const releaseIdentity = { version: '3.2.0', versionCode: 68 };
    expect(validateReleaseRef({ releaseIdentity, releaseTag: 'v3.2.0', versionSource: 'remote', builtVersionCode: '69', expectedRemoteVersionCode: '69' }))
      .toMatchObject({ builtVersionCode: '69', versionCode: 69 });
    expect(() => validateReleaseRef({ releaseIdentity, releaseTag: 'v3.2.0', versionSource: 'remote', builtVersionCode: '69' })).toThrow('EXPECTED_ANDROID_VERSION_CODE');
    expect(() => validateReleaseRef({ releaseIdentity, releaseTag: 'v3.2.0', versionSource: 'remote', builtVersionCode: '69', expectedRemoteVersionCode: '70' })).toThrow('does not match the EAS build');
    expect(() => validateReleaseRef({ releaseIdentity, releaseTag: 'v3.2.0', versionSource: 'remote', builtVersionCode: 'NaN', expectedRemoteVersionCode: '69' })).toThrow('Invalid');
  });
});
