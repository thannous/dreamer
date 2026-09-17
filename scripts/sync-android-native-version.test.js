'use strict';
/* global describe, expect, it, jest */

const path = require('node:path');

const {
  syncAndroidNativeVersion,
} = require('./sync-android-native-version');

describe('syncAndroidNativeVersion', () => {
  it('uses the selected variant and never rewrites another app identity', () => {
    const writeFileSync = jest.fn();
    const options = {
      cwd: '/repo', existsSync: () => true,
      readFileSync: () => 'applicationId "com.lucid"\nversionCode 1\nversionName "1.0.0"',
      writeFileSync,
      expoConfig: { version: '1.1.0', android: { versionCode: 2, package: 'com.lucid' } },
    };
    expect(syncAndroidNativeVersion(options)).toMatchObject({ versionName: '1.1.0', versionCode: 2 });
    expect(writeFileSync.mock.calls[0][1]).toContain('versionCode 2');
    writeFileSync.mockClear();
    expect(() => syncAndroidNativeVersion({ ...options, expoConfig: { version: '3.2.0', android: { versionCode: 69, package: 'com.noctalia' } } })).toThrow('identity differs');
    expect(writeFileSync).not.toHaveBeenCalled();
  });
  it('skips managed projects without a generated Android directory', () => {
    expect(syncAndroidNativeVersion({
      cwd: '/repo',
      existsSync: () => false,
    })).toEqual({ status: 'native-project-missing' });
  });

  it('copies the tracked Expo version into the generated Gradle project', () => {
    const appConfigPath = path.join('/repo', 'app.json');
    const buildGradlePath = path.join('/repo', 'android', 'app', 'build.gradle');
    const files = new Map([
      [appConfigPath, JSON.stringify({
        expo: {
          version: '3.0.2',
          android: { versionCode: 38 },
        },
      })],
      [buildGradlePath, [
        'defaultConfig {',
        '    versionCode 36',
        '    versionName "3.0.0"',
        '}',
      ].join('\n')],
    ]);
    const writeFileSync = jest.fn((filePath, contents) => {
      files.set(filePath, contents);
    });

    expect(syncAndroidNativeVersion({
      cwd: '/repo',
      existsSync: (filePath) => files.has(filePath),
      readFileSync: (filePath) => files.get(filePath),
      writeFileSync,
    })).toEqual({
      status: 'updated',
      versionCode: 38,
      versionName: '3.0.2',
    });
    expect(files.get(buildGradlePath)).toContain('versionCode 38');
    expect(files.get(buildGradlePath)).toContain('versionName "3.0.2"');
  });

  it('does not rewrite an already synchronized Gradle project', () => {
    const readFileSync = (filePath) => (
      filePath.endsWith('app.json')
        ? JSON.stringify({
          expo: {
            version: '3.0.2',
            android: { versionCode: 38 },
          },
        })
        : 'versionCode 38\nversionName "3.0.2"\n'
    );
    const writeFileSync = jest.fn();

    expect(syncAndroidNativeVersion({
      cwd: '/repo',
      existsSync: () => true,
      readFileSync,
      writeFileSync,
    })).toEqual({
      status: 'already-synced',
      versionCode: 38,
      versionName: '3.0.2',
    });
    expect(writeFileSync).not.toHaveBeenCalled();
  });
});
