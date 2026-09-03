'use strict';
/* global describe, expect, it */

const path = require('node:path');

const {
  isAndroidRun,
  loadEnvProfile,
  parseRunnerArgs,
  inferExpoLockOwner,
  extractAndroidLockFlags,
  applyStableExpoMetroPort,
  holdExpoAndroidDeviceLockUntilProcessExit,
  reserveExpoAndroidDeviceLock,
} = require('./expo-safe-runner');

describe('expo-safe-runner', () => {
  describe('parseRunnerArgs', () => {
    it('removes the selected environment profile from Expo arguments', () => {
      expect(parseRunnerArgs([
        'start',
        '--profile',
        '.env.mock',
        '--web',
      ])).toEqual({
        envFile: '.env.mock',
        expoArgs: ['start', '--web'],
      });
    });

    it('supports the equals form without changing Expo argument order', () => {
      expect(parseRunnerArgs([
        '--profile=.env.teststore',
        'run:android',
        '--device',
      ])).toEqual({
        envFile: '.env.teststore',
        expoArgs: ['run:android', '--device'],
      });
    });

    it('rejects missing and repeated environment profiles', () => {
      expect(() => parseRunnerArgs(['start', '--profile'])).toThrow(
        '--profile requires an environment file path',
      );
      expect(() => parseRunnerArgs([
        '--profile=.env.mock',
        '--profile',
        '.env.teststore',
      ])).toThrow('--profile can only be provided once');
    });
  });

  describe('isAndroidRun', () => {
    it('recognizes native Android and Android-opening commands', () => {
      expect(isAndroidRun(['run:android'])).toBe(true);
      expect(isAndroidRun(['start', '--android'])).toBe(true);
      expect(isAndroidRun(['start', '--web'])).toBe(false);
    });
  });

  describe('loadEnvProfile', () => {
    it('loads the profile into the process environment and disables Expo dotenv', () => {
      const expectedPath = path.resolve('/repo', '.env.mock');
      const env = {
        EXPO_PUBLIC_MOCK_MODE: 'false',
        KEEP_ME: 'unchanged',
      };

      const resolvedPath = loadEnvProfile('.env.mock', {
        cwd: '/repo',
        env,
        readFileSync: (filePath, encoding) => {
          expect(filePath).toBe(expectedPath);
          expect(encoding).toBe('utf8');
          return [
            'EXPO_PUBLIC_MOCK_MODE=true',
            'EXPO_PUBLIC_LABEL="Mock profile"',
          ].join('\n');
        },
      });

      expect(resolvedPath).toBe(expectedPath);
      expect(env).toEqual({
        EXPO_NO_DOTENV: '1',
        EXPO_PUBLIC_LABEL: 'Mock profile',
        EXPO_PUBLIC_MOCK_MODE: 'true',
        KEEP_ME: 'unchanged',
      });
    });

    it('reports the selected profile when it cannot be loaded', () => {
      expect(() => loadEnvProfile('.env.missing', {
        cwd: '/repo',
        env: {},
        readFileSync: () => {
          throw new Error('ENOENT');
        },
      })).toThrow(
        'Unable to load Expo environment profile .env.missing: ENOENT',
      );
    });

    it('derives and validates the API URL for the Supabase profile', () => {
      const env = {};
      loadEnvProfile('.env.supabase', {
        cwd: '/repo',
        env,
        readFileSync: () => [
          'EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co',
          'EXPO_PUBLIC_SUPABASE_ANON_KEY=anon',
          'SUPABASE_PROJECT_REF=example',
        ].join('\n'),
      });

      expect(env.EXPO_PUBLIC_API_URL).toBe(
        'https://example.functions.supabase.co/api',
      );
      expect(env.EXPO_NO_DOTENV).toBe('1');
    });
  });

  describe('android device lock', () => {
    it('infers Lucid vs Dreamer owners and injects the stable Metro port', () => {
      expect(inferExpoLockOwner('.env.lucid', {})).toBe('lucid');
      expect(inferExpoLockOwner('.env.mock', { NOCTALIA_APP_VARIANT: 'lucid' })).toBe('lucid');
      expect(inferExpoLockOwner('.env.mock', {})).toBe('dreamer');

      const lucidEnv = {};
      expect(applyStableExpoMetroPort(['run:android', '--device', 'ZY22LJM555'], 'lucid', lucidEnv))
        .toMatchObject({
          expoArgs: ['run:android', '--device', 'ZY22LJM555', '--port', '8082'],
          metroPort: 8082,
        });
      expect(lucidEnv.RCT_METRO_PORT).toBe('8082');
      expect(lucidEnv.EXPO_METRO_PORT).toBe('8082');

      const kept = applyStableExpoMetroPort(['start', '--android', '--port', '8099'], 'dreamer', {});
      expect(kept.metroPort).toBe(8099);
      expect(kept.expoArgs).toEqual(['start', '--android', '--port', '8099']);
    });

    it('strips lock flags and holds the lock until process exit instead of require() return', () => {
      expect(extractAndroidLockFlags([
        'run:android',
        '--device',
        'ZY22LJM555',
        '--steal-lock',
        '--lock-owner',
        'lucid',
      ])).toEqual({
        expoArgs: ['run:android', '--device', 'ZY22LJM555'],
        stealLock: true,
        lockOwner: 'lucid',
      });

      const events = [];
      const processRef = {
        once(name, handler) {
          events.push({ name, handler });
        },
      };
      const released = [];
      const release = holdExpoAndroidDeviceLockUntilProcessExit(() => released.push('lock'), {
        processRef,
      });
      expect(released).toEqual([]);
      expect(events.map((event) => event.name)).toEqual(['beforeExit', 'exit']);
      events[0].handler();
      expect(released).toEqual(['lock']);
      expect(release()).toEqual({ released: false, reason: 'already' });
    });

    it('reserves a physical Expo Android run with the injected Metro port', () => {
      const env = {};
      const reserved = reserveExpoAndroidDeviceLock({
        expoArgs: ['run:android', '--device', 'emulator-5554'],
        envFile: '.env.mock',
        env,
        attachSignals: () => () => {},
      });
      expect(reserved.owner).toBe('dreamer');
      expect(reserved.metroPort).toBe(8081);
      expect(reserved.expoArgs).toEqual(['run:android', '--device', 'emulator-5554', '--port', '8081']);
      expect(reserved.skipped).toBe('emulator-only');
      expect(env.RCT_METRO_PORT).toBe('8081');
    });
  });
});
