#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseEnv } = require('node:util');

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

function main(args = process.argv.slice(2)) {
  let parsedArgs;

  try {
    parsedArgs = parseRunnerArgs(args);
    if (parsedArgs.envFile) {
      const resolvedPath = loadEnvProfile(parsedArgs.envFile);
      console.error(`[expo] Environment profile: ${path.relative(process.cwd(), resolvedPath)}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  configureCodexWatchman();

  process.argv = [
    process.argv[0],
    require.resolve('expo/bin/cli'),
    ...parsedArgs.expoArgs,
  ];
  require('expo/bin/cli');
}

if (require.main === module) {
  main();
}

module.exports = {
  configureCodexWatchman,
  loadEnvProfile,
  main,
  parseRunnerArgs,
};
