'use strict';
/* global describe, expect, it */

const path = require('node:path');

const {
  loadEnvProfile,
  parseRunnerArgs,
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
});
