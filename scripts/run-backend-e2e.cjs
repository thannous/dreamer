#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { assertBackendTarget, normalizeStackStatus, prepareLocalMigrations } = require('./lib/backend-e2e-local.cjs');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const index = args.indexOf('--status-file');
const suppliedStatus = index >= 0 ? args.splice(index, 2)[1] : undefined;
if (index >= 0 && (!suppliedStatus || suppliedStatus.startsWith('--'))) throw new Error('--status-file requires a private JSON file');
const runtimeIndex = args.indexOf('--runtime');
const requestedRuntime = runtimeIndex >= 0 ? args.splice(runtimeIndex, 2)[1] : undefined;
// The native Supabase runtime is the only owned stack: no Docker, no Podman.
if (runtimeIndex >= 0 && requestedRuntime !== 'native') throw new Error('--runtime accepts only native (Docker and Podman runtimes were removed)');
if (requestedRuntime && suppliedStatus) throw new Error('--runtime owns a new disposable stack; it cannot use --status-file');
const prepareOnly = args.includes('--prepare-only');
// Without --status-file or --prepare-only, this run owns a new native stack.
const runtime = suppliedStatus || prepareOnly ? undefined : 'native';
const qualificationIndex = args.indexOf('--qualify-ti528');
const qualifyTi528 = qualificationIndex >= 0;
if (qualifyTi528) args.splice(qualificationIndex, 1);
if (qualifyTi528 && (!runtime || suppliedStatus || prepareOnly)) {
  throw new Error('--qualify-ti528 requires an owned native stack, without --status-file or --prepare-only');
}
const isolatedRun = !suppliedStatus && !prepareOnly;
const workdir = isolatedRun ? fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-backend-e2e-')) : path.join(os.tmpdir(), 'noctalia-backend-e2e');
const project = `noctalia-backend-e2e-disposable${isolatedRun ? `-${randomUUID().slice(0, 8)}` : ''}`;
const target = path.join(workdir, 'supabase');
const cli = process.env.E2E_SUPABASE_CLI || path.join(root, 'node_modules/.bin/supabase');
const quote = arg => `'${arg.replaceAll("'", "'\"'\"'")}'`;
const rerunArgs = [...(requestedRuntime ? ['--runtime', requestedRuntime] : []),
  ...(qualifyTi528 ? ['--qualify-ti528'] : []),
  ...(suppliedStatus ? ['--status-file', path.resolve(suppliedStatus)] : []), ...args].map(quote).join(' ');
// Supabase documents this one for root runs of the native runtime; other SUPABASE_* settings are dropped.
const keptSupabaseEnv = ['SUPABASE_NATIVE_POSTGRES_USER'];
// The rerun repeats the overrides that chose the executable and the database user.
const rerunEnv = ['E2E_SUPABASE_CLI', 'E2E_SUPABASE_HOME', ...keptSupabaseEnv]
  .filter(key => process.env[key]).map(key => `${key}=${quote(process.env[key])} `).join('');
const cliEnv = {
  ...Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => !key.startsWith('SUPABASE_') || keptSupabaseEnv.includes(key))),
  SUPABASE_HOME: process.env.E2E_SUPABASE_HOME || path.join(root, 'test-results/backend-e2e-cli-home'),
  SUPABASE_EXPERIMENTAL_STACK: '1',
  DO_NOT_TRACK: '1',
};

function command(binary, argv, options = {}) {
  const result = spawnSync(binary, argv, { cwd: root, stdio: 'inherit', env: cliEnv, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(binary)} failed (${result.status ?? result.signal})`);
  return result.stdout;
}

if (fs.existsSync(workdir) && fs.lstatSync(workdir).isSymbolicLink()) throw new Error('Refusing symlink workdir');
const config = path.join(target, 'config.toml');
if (fs.existsSync(config)) {
  if (fs.lstatSync(target).isSymbolicLink() || fs.lstatSync(config).isSymbolicLink() ||
      !fs.readFileSync(config, 'utf8').includes(`project_id = "${project}"`)) throw new Error('Unrecognized E2E directory');
} else if (fs.existsSync(workdir) && fs.readdirSync(workdir).length) {
  throw new Error('Refusing nonempty unrecognized E2E directory');
}
fs.mkdirSync(target, { recursive: true, mode: 0o700 });
const migrationFixtures = prepareLocalMigrations(path.join(root, 'supabase/migrations'), path.join(target, 'migrations'));
let input = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
input = input.replace(/^project_id\s*=.*$/m, `project_id = "${project}"`)
  .replace('sql_paths = ["./seed.sql"]', 'sql_paths = []')
  .replaceAll('127.0.0.1:3000', '127.0.0.1:8085')
  // The native stack assigns its own loopback ports; a fixed port is never kept.
  .replace(/^\s*(?:port|shadow_port|inspector_port|smtp_port|pop3_port|vector_port)\s*=.*$/gm, '')
  .replace(/^\s*stack\s*=.*$/gm, '');
if (!/^\[experimental\]\s*$/m.test(input)) throw new Error('supabase/config.toml needs an [experimental] table');
if (prepareOnly) {
  // The supplied loopback VM mode keeps its own fixed ports and the CLI default stack.
  input = input.replace(/^\[api\]\s*$/m, '[api]\nport = 56321').replace(/^\[db\]\s*$/m, '[db]\nport = 56322\nshadow_port = 56320')
    .replace(/^\[experimental\]\s*$/m, '[experimental]\nstack = false');
} else {
  input = input.replace(/^\[experimental\]\s*$/m, '[experimental]\nstack = true');
}
fs.writeFileSync(config, input);
if (prepareOnly) {
  console.log(`Prepared ${workdir}; no database was started or reset.`);
  process.exit(0);
}

const statusFile = suppliedStatus ? path.resolve(suppliedStatus) : path.join(workdir, 'status.json');
let started = false;
let stackId;
let cliVersion;
try {
  if (!suppliedStatus) {
    cliVersion = command(cli, ['--version'], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }).trim();
    const version = /^(\d+)\.(\d+)\.(\d+)/.exec(cliVersion);
    if (!version || Number(version[1]) < 2 || (Number(version[1]) === 2 && Number(version[2]) < 119)) {
      throw new Error('The managed local stack requires Supabase CLI 2.119.0 or later');
    }
    fs.mkdirSync(cliEnv.SUPABASE_HOME, { recursive: true, mode: 0o700 });
    started = true;
    const output = command(cli, ['stack', 'start', '--workdir', workdir, '--runtime', runtime,
      '--exclude', 'realtime,functions,studio,mail,analytics,pooler', '--eager', '--output-format', 'json'],
    { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const status = normalizeStackStatus(JSON.parse(output));
    if (status.LOCAL_E2E_STACK.runtime !== runtime) throw new Error('Unexpected local stack runtime');
    stackId = status.LOCAL_E2E_STACK.id;
    fs.writeFileSync(statusFile, JSON.stringify(status), { mode: 0o600 });
    const safety = JSON.parse(command(cli, ['db', 'query', '--workdir', workdir, '--db-url', status.DB_URL,
      'select count(*) as active_jobs from cron.job where active', '--output-format', 'json'],
    { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }));
    if (Number(safety.rows?.[0]?.active_jobs) !== 0) throw new Error('Disposable local cron jobs must be inactive');
  }
  const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
  if (suppliedStatus && status.LOCAL_E2E_STACK) throw new Error('--status-file accepts only the existing loopback VM mode');
  const url = assertBackendTarget(status);
  const profile = path.join(workdir, 'expo.env');
  const publicEnv = {
    EXPO_PUBLIC_MOCK_MODE: 'false',
    EXPO_PUBLIC_SUPABASE_URL: url.origin,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    EXPO_PUBLIC_API_URL: `${url.origin}/functions/v1/api`,
    EXPO_PUBLIC_REVENUECAT_WEB_KEY: '',
    EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: '',
    EXPO_PUBLIC_REVENUECAT_IOS_KEY: '',
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '',
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: '',
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '',
    EXPO_PUBLIC_TURNSTILE_SITE_KEY: '',
  };
  fs.writeFileSync(profile, Object.entries(publicEnv).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
  command(process.execPath, [path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js'), 'test', '--config', 'playwright.backend.config.ts', ...args], {
    env: { ...process.env, E2E_BACKEND_STATUS_FILE: statusFile, E2E_BACKEND_PROFILE: profile,
      E2E_BACKEND_RUNTIME: suppliedStatus ? 'supplied-unknown' : runtime,
      E2E_BACKEND_CLI_VERSION: cliVersion || 'unknown (supplied stack)',
      E2E_BACKEND_RERUN: `${rerunEnv}mise exec -- npm run test:e2e:backend${rerunArgs ? ` -- ${rerunArgs}` : ''}`,
      // Copies prepared here are never applied to a supplied stack. Its migration state is unknown.
      E2E_BACKEND_MIGRATION_FIXTURES: JSON.stringify(suppliedStatus ? null : migrationFixtures) },
  });
  if (qualifyTi528) {
    command(process.execPath, ['--run', 'db:qualify:local'], {
      env: { ...process.env, TI528_LOCAL_STATUS: statusFile },
    });
  }
} finally {
  // Only this run's randomly named disposable database is removed; no reset or --all.
  try {
    if (started) command(cli, ['stack', 'destroy', '--workdir', workdir,
      ...(stackId ? ['--stack-id', stackId] : []), '--yes'], { stdio: ['ignore', 'pipe', 'inherit'] });
  } finally {
    // The owned workdir holds this run's private status file: nothing stays in the temp directory.
    if (isolatedRun) fs.rmSync(workdir, { recursive: true, force: true });
  }
}
