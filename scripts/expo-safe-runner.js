#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseEnv } = require('node:util');
const {
  syncAndroidNativeVersion,
} = require('./sync-android-native-version');
const { syncMobileBuildVersions, usesNoctaliaBuildVersions } = require('./sync-mobile-build-versions');
const {
  attachDeviceLockSignals,
  defaultMetroPortForOwner,
  findDeviceArg,
  listReadyAdbSerials,
  parseLockOwner,
  prepareAndroidDeviceLocks,
} = require('./android-device-lock');

function parseRunnerArgs(args) {
  const expoArgs = [];
  let envFile;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--profile') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--profile requires an environment file path');
      }
      if (envFile) {
        throw new Error('--profile can only be provided once');
      }
      envFile = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--profile=')) {
      const value = arg.slice('--profile='.length);
      if (!value) {
        throw new Error('--profile requires an environment file path');
      }
      if (envFile) {
        throw new Error('--profile can only be provided once');
      }
      envFile = value;
      continue;
    }

    expoArgs.push(arg);
  }

  return { envFile, expoArgs };
}

function loadEnvProfile(envFile, {
  cwd = process.cwd(),
  env = process.env,
  readFileSync = fs.readFileSync,
} = {}) {
  const resolvedPath = path.resolve(cwd, envFile);
  let parsed;

  try {
    parsed = parseEnv(readFileSync(resolvedPath, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to load Expo environment profile ${envFile}: ${reason}`);
  }

  Object.assign(env, parsed);

  if (path.basename(resolvedPath) === '.env.supabase') {
    if (!env.EXPO_PUBLIC_API_URL && env.SUPABASE_PROJECT_REF) {
      env.EXPO_PUBLIC_API_URL = `https://${env.SUPABASE_PROJECT_REF}.functions.supabase.co/api`;
    }

    const requiredKeys = [
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_API_URL',
    ];
    const missingKeys = requiredKeys.filter((key) => !env[key]);
    if (missingKeys.length > 0) {
      throw new Error(
        `Supabase profile is missing required values: ${missingKeys.join(', ')}`,
      );
    }
  }

  // The selected profile is already in process.env. Prevent Expo from also
  // loading .env.local and silently mixing two runtime profiles.
  env.EXPO_NO_DOTENV = '1';

  return resolvedPath;
}

function configureCodexWatchman(env = process.env) {
  if (env.CODEX_CI !== '1') {
    return;
  }

  const watchmanSock = path.join(
    os.homedir(),
    '.local',
    'state',
    'watchman',
    `${os.userInfo().username}-state`,
    'sock',
  );

  // Metro's Watchman probe runs inside the Codex sandbox. Give it writable
  // state and reuse the already-started user Watchman socket when available.
  if (fs.existsSync(watchmanSock)) {
    env.WATCHMAN_SOCK ??= watchmanSock;
    env.XDG_STATE_HOME ??= path.join(os.tmpdir(), 'codex-watchman-state');
  }
}

function isAndroidRun(expoArgs) {
  return expoArgs.includes('run:android') || expoArgs.includes('--android');
}

function inferExpoLockOwner(envFile, env = process.env) {
  const native = String(env.NOCTALIA_APP_VARIANT || '');
  const pub = String(env.EXPO_PUBLIC_APP_VARIANT || '');
  const profile = path.basename(String(envFile || ''));
  if (
    native === 'lucid' ||
    pub === 'lucid' ||
    pub === 'lucid-trainer' ||
    /lucid/i.test(profile)
  ) {
    return 'lucid';
  }
  return 'dreamer';
}

function extractAndroidLockFlags(expoArgs = []) {
  const next = [];
  let stealLock = false;
  let lockOwner = null;
  for (let index = 0; index < expoArgs.length; index += 1) {
    const arg = expoArgs[index];
    if (arg === '--steal-lock') {
      stealLock = true;
      continue;
    }
    if (arg === '--lock-owner') {
      lockOwner = parseLockOwner(expoArgs[index + 1], '--lock-owner');
      index += 1;
      continue;
    }
    next.push(arg);
  }
  return { expoArgs: next, stealLock, lockOwner };
}

function readExpoMetroPort(expoArgs = []) {
  for (let index = 0; index < expoArgs.length; index += 1) {
    const arg = expoArgs[index];
    if (arg === '--port') {
      const value = Number.parseInt(String(expoArgs[index + 1] || ''), 10);
      return Number.isInteger(value) && value > 0 ? value : null;
    }
    if (arg.startsWith('--port=')) {
      const value = Number.parseInt(arg.slice('--port='.length), 10);
      return Number.isInteger(value) && value > 0 ? value : null;
    }
  }
  return null;
}

function applyStableExpoMetroPort(expoArgs = [], owner, env = process.env) {
  const resolvedOwner = owner || 'dreamer';
  const existing = readExpoMetroPort(expoArgs);
  const metroPort = existing || defaultMetroPortForOwner(resolvedOwner);
  const nextArgs = existing
    ? [...expoArgs]
    : [...expoArgs, '--port', String(metroPort)];
  env.RCT_METRO_PORT = String(metroPort);
  env.EXPO_METRO_PORT = String(metroPort);
  return { expoArgs: nextArgs, metroPort, owner: resolvedOwner };
}

function holdExpoAndroidDeviceLockUntilProcessExit(releaseOnce, {
  processRef = process,
} = {}) {
  let released = false;
  const release = () => {
    if (released) {
      return { released: false, reason: 'already' };
    }
    released = true;
    if (typeof releaseOnce === 'function') {
      releaseOnce();
    }
    return { released: true };
  };
  processRef.once('beforeExit', release);
  processRef.once('exit', release);
  return release;
}

function reserveExpoAndroidDeviceLock({
  expoArgs,
  envFile,
  env = process.env,
  stealLock = false,
  lockOwner = null,
  spawn,
  attachSignals = attachDeviceLockSignals,
} = {}) {
  if (!isAndroidRun(expoArgs)) {
    return { locks: [], skipped: 'not-android', owner: null, metroPort: null, releaseOnce() {} };
  }
  const owner = lockOwner || inferExpoLockOwner(envFile, env);
  const ported = applyStableExpoMetroPort(expoArgs, owner, env);
  const requested = findDeviceArg(expoArgs) || env.ANDROID_SERIAL || null;
  const devices = requested
    ? [requested]
    : listReadyAdbSerials({ spawn, adbCommand: env.ADB_BIN || 'adb' });
  const prepared = prepareAndroidDeviceLocks({
    devices,
    owner,
    stealLock,
    explicitDevices: Boolean(requested),
    command: `expo ${ported.expoArgs.join(' ')}`,
    metroPort: ported.metroPort,
    env,
    spawn,
  });
  return {
    ...prepared,
    owner,
    metroPort: ported.metroPort,
    expoArgs: ported.expoArgs,
    releaseOnce: prepared.locks.length > 0
      ? attachSignals(prepared.locks)
      : () => {},
  };
}

// Set by scripts/start-branch-e2e.mjs. Its presence (any value, even empty
// or "0") only adds restrictions: no --profile, no .env auto-loading, only
// `start`, and the final env is re-checked by the test-login guard before
// Expo starts. There is no value that turns these checks off.
const BRANCH_GUARD_MARKER = 'NOCTALIA_BRANCH_E2E_GUARD';

function isBranchGuarded(env = process.env) {
  return Object.prototype.hasOwnProperty.call(env, BRANCH_GUARD_MARKER);
}

function applyBranchGuardRestrictions(parsedArgs, env = process.env) {
  if (parsedArgs.envFile) {
    throw new Error(`[branch-e2e] --profile is refused in a guarded branch run (${BRANCH_GUARD_MARKER} is set); the env comes only from scripts/start-branch-e2e.mjs.`);
  }
  if (parsedArgs.expoArgs[0] !== 'start') {
    throw new Error(`[branch-e2e] only "expo start" is allowed in a guarded branch run.`);
  }
  // Expo CLI auto-loads .env, .env.local, ... from the project root unless
  // EXPO_NO_DOTENV is truthy; force it whatever the inherited value.
  env.EXPO_NO_DOTENV = '1';
}

// Re-runs the guard on the env Expo will actually inline (after every
// mutation above), refusing production and any non-allowlisted branch.
async function assertBranchFinalEnv(env = process.env, loadGuard = () => import('./test-supabase-guard.mjs')) {
  const guard = await loadGuard();
  guard.assertBranchAppEnv(env);
  if (env.EXPO_NO_DOTENV !== '1') {
    throw new Error('[branch-e2e] EXPO_NO_DOTENV must be 1 in a guarded branch run.');
  }
}

function startExpo(expoArgs) {
  configureCodexWatchman();

  process.argv = [
    process.argv[0],
    require.resolve('expo/bin/cli'),
    ...expoArgs,
  ];
  require('expo/bin/cli');
}

function main(args = process.argv.slice(2), {
  env = process.env,
  start = startExpo,
  loadGuard,
} = {}) {
  let parsedArgs;
  let releaseOnce = () => {};
  const guarded = isBranchGuarded(env);

  try {
    parsedArgs = parseRunnerArgs(args);
    if (guarded) {
      applyBranchGuardRestrictions(parsedArgs, env);
    }
    const lockFlags = extractAndroidLockFlags(parsedArgs.expoArgs);
    parsedArgs.expoArgs = lockFlags.expoArgs;
    if (parsedArgs.envFile) {
      const resolvedPath = loadEnvProfile(parsedArgs.envFile);
      console.error(`[expo] Environment profile: ${path.relative(process.cwd(), resolvedPath)}`);
    }
    if (['run:android', 'run:ios'].includes(parsedArgs.expoArgs[0]) && usesNoctaliaBuildVersions()) {
      const synced = syncMobileBuildVersions({ platform: parsedArgs.expoArgs[0] === 'run:android' ? 'android' : 'ios' });
      console.error(`[expo] EAS build version synchronized: ${synced.version} (${synced.versionCode ?? synced.buildNumber})`);
    }
    if (isAndroidRun(parsedArgs.expoArgs)) {
      const result = syncAndroidNativeVersion({
        expoConfig: require('@expo/config').getConfig(process.cwd(), { skipPlugins: true }).exp,
      });
      if (result.status === 'updated') {
        console.error(
          `[android] Synced native version ${result.versionName} (${result.versionCode})`,
        );
      }
      const reserved = reserveExpoAndroidDeviceLock({
        expoArgs: parsedArgs.expoArgs,
        envFile: parsedArgs.envFile,
        stealLock: lockFlags.stealLock,
        lockOwner: lockFlags.lockOwner,
      });
      releaseOnce = reserved.releaseOnce;
      if (reserved.expoArgs) {
        parsedArgs.expoArgs = reserved.expoArgs;
      }
      if (reserved.locks.length > 0) {
        holdExpoAndroidDeviceLockUntilProcessExit(releaseOnce);
      }
      if (reserved.owner) {
        console.error(
          `[android] Device lock owner: ${reserved.owner} metro=${reserved.metroPort}`
        );
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    releaseOnce();
    return undefined;
  }

  if (!guarded) {
    start(parsedArgs.expoArgs);
    return undefined;
  }
  return assertBranchFinalEnv(env, loadGuard).then(
    () => start(parsedArgs.expoArgs),
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      releaseOnce();
    },
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  BRANCH_GUARD_MARKER,
  applyBranchGuardRestrictions,
  assertBranchFinalEnv,
  isBranchGuarded,
  configureCodexWatchman,
  isAndroidRun,
  loadEnvProfile,
  main,
  parseRunnerArgs,
  inferExpoLockOwner,
  extractAndroidLockFlags,
  reserveExpoAndroidDeviceLock,
  applyStableExpoMetroPort,
  holdExpoAndroidDeviceLockUntilProcessExit,
  readExpoMetroPort,
};
