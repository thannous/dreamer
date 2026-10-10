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

describe('expo-safe-runner guarded branch mode', () => {
  const { execFileSync } = require('node:child_process');
  const {
    BRANCH_GUARD_MARKER,
    applyBranchGuardRestrictions,
    assertBranchFinalEnv,
    isBranchGuarded,
    main,
  } = require('./expo-safe-runner');
  const REF = 'abcdefghijklmnopqrst';
  const PROD = 'usuyppgsmmowzizhaoqj';
  const branchEnv = (overrides = {}) => ({
    [BRANCH_GUARD_MARKER]: '1',
    EXPO_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test',
    EXPO_PUBLIC_API_URL: `https://${REF}.functions.supabase.co/api`,
    EXPO_PUBLIC_SUPABASE_FUNCTION_JWT: 'sb_publishable_test',
    EXPO_PUBLIC_MOCK_MODE: 'false',
    ...overrides,
  });
  const silence = () => jest.spyOn(console, 'error').mockImplementation(() => {});

  it('treats any marker value as guarded; there is no value that turns it off', () => {
    for (const value of ['1', '0', '', 'false', 'off']) {
      expect(isBranchGuarded({ [BRANCH_GUARD_MARKER]: value })).toBe(true);
    }
    expect(isBranchGuarded({})).toBe(false);
  });

  it('refuses --profile and non-start commands, and forces EXPO_NO_DOTENV=1', () => {
    expect(() => applyBranchGuardRestrictions(parseRunnerArgs(['start', '--profile', '.env.playstore']), {})).toThrow(/--profile is refused/);
    expect(() => applyBranchGuardRestrictions(parseRunnerArgs(['start', '--profile=.env.playstore']), {})).toThrow(/--profile is refused/);
    expect(() => applyBranchGuardRestrictions(parseRunnerArgs(['run:android']), {})).toThrow(/only "expo start"/);
    const env = { EXPO_NO_DOTENV: '0' };
    applyBranchGuardRestrictions(parseRunnerArgs(['start', '--web']), env);
    expect(env.EXPO_NO_DOTENV).toBe('1');
  });

  it('main refuses a guarded --profile before loading it and never starts Expo', async () => {
    const spy = silence();
    const started = [];
    const previous = process.exitCode;
    const env = branchEnv();
    await main(['start', '--profile', '.env.playstore'], { env, start: (args) => started.push(args) });
    expect(started).toEqual([]);
    expect(process.exitCode).toBe(1);
    expect(env.EXPO_PUBLIC_SUPABASE_URL).toBe(`https://${REF}.supabase.co`);
    process.exitCode = previous;
    spy.mockRestore();
  });

  it('main re-checks the final env with the guard before starting Expo', async () => {
    const spy = silence();
    const previous = process.exitCode;
    const started = [];
    const seen = [];
    const loadGuard = async () => ({ assertBranchAppEnv: (env) => seen.push({ ...env }) });
    await main(['start', '--web'], { env: branchEnv({ EXPO_NO_DOTENV: '0' }), start: (args) => started.push(args), loadGuard });
    expect(started).toEqual([['start', '--web']]);
    expect(seen).toHaveLength(1);
    expect(seen[0].EXPO_NO_DOTENV).toBe('1');
    const refusing = async () => ({ assertBranchAppEnv: () => { throw new Error('test-login refused: production'); } });
    await main(['start', '--web'], { env: branchEnv(), start: (args) => started.push(args), loadGuard: refusing });
    expect(started).toHaveLength(1);
    expect(process.exitCode).toBe(1);
    process.exitCode = previous;
    spy.mockRestore();
  });

  it('as a process: the real guard refuses a production final env and the committed (empty) allowlist', () => {
    const script = path.join(__dirname, 'expo-safe-runner.js');
    const run = (env) => {
      try {
        execFileSync(process.execPath, [script, 'start', '--web'], {
          cwd: path.join(__dirname, '..'),
          env: { PATH: process.env.PATH, ...env },
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 20000,
        });
        return { status: 0, output: '' };
      } catch (error) {
        return { status: error.status, output: `${error.stdout}${error.stderr}` };
      }
    };
    const prod = run(branchEnv({ EXPO_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co`, EXPO_PUBLIC_API_URL: `https://${PROD}.functions.supabase.co/api` }));
    expect(prod.status).toBe(1);
    expect(prod.output).toMatch(/production Supabase project/);
    const unlisted = run(branchEnv());
    expect(unlisted.status).toBe(1);
    expect(unlisted.output).toMatch(/no test Supabase project is allowlisted/);
    expect(typeof assertBranchFinalEnv).toBe('function');
  });

  it('unguarded runs keep working as before (no marker, profile allowed)', () => {
    const started = [];
    const env = {};
    const result = main(['start', '--web'], { env, start: (args) => started.push(args) });
    expect(result).toBeUndefined();
    expect(started).toEqual([['start', '--web']]);
    expect(env.EXPO_NO_DOTENV).toBeUndefined();
  });

  it('as a process: a guarded --profile .env.playstore exits 1 before Expo starts', () => {
    const script = path.join(__dirname, 'expo-safe-runner.js');
    let status = 0;
    let output = '';
    try {
      execFileSync(process.execPath, [script, 'start', '--profile', '.env.playstore'], {
        cwd: path.join(__dirname, '..'),
        env: { PATH: process.env.PATH, ...branchEnv() },
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 20000,
      });
    } catch (error) {
      status = error.status;
      output = `${error.stdout}${error.stderr}`;
    }
    expect(status).toBe(1);
    expect(output).toMatch(/--profile is refused/);
    expect(output).not.toMatch(new RegExp(PROD));
  });
});
