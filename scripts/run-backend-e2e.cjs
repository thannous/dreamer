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
const testerarmyIndex = args.indexOf('--testerarmy');
const pilot = testerarmyIndex >= 0;
if (pilot) args.splice(testerarmyIndex, 1);
const legacyIndex = args.indexOf('--legacy-playwright');
const legacy = legacyIndex >= 0;
if (legacy) args.splice(legacyIndex, 1);
if (pilot && legacy) throw new Error('Select one backend runner.');
const testerarmy = !legacy;
const runtimeIndex = args.indexOf('--runtime');
const requestedRuntime = runtimeIndex >= 0 ? args.splice(runtimeIndex, 2)[1] : undefined;
// The native Supabase runtime is the only owned stack: no Docker, no Podman.
if (runtimeIndex >= 0 && requestedRuntime !== 'native') throw new Error('--runtime accepts only native (Docker and Podman runtimes were removed)');
// The former supplied-VM mode (--status-file, --prepare-only, fixed port 56321) ran the CLI's
// default container stack inside a VM; it was removed with Docker. Every run owns a new native stack.
for (const removed of ['--status-file', '--prepare-only']) {
  if (args.includes(removed)) throw new Error(`${removed} was removed with the Docker VM mode; every run owns a native stack`);
}
const runtime = 'native';
const qualificationIndex = args.indexOf('--qualify-ti528');
const qualifyTi528 = qualificationIndex >= 0;
if (qualifyTi528) args.splice(qualificationIndex, 1);
if (!pilot && !legacy && args.length) throw new Error('Use --testerarmy or --legacy-playwright for a targeted selection; the default runs all six ports and both SDK exceptions.');
const webPort = process.env.E2E_WEB_PORT ?? '18125';
if (!/^[1-9]\d*$/.test(webPort) || Number(webPort) > 65535) throw new Error('E2E_WEB_PORT must be a valid TCP port.');
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-backend-e2e-'));
const project = `noctalia-backend-e2e-disposable-${randomUUID().slice(0, 8)}`;
const target = path.join(workdir, 'supabase');
const cli = process.env.E2E_SUPABASE_CLI || path.join(root, 'node_modules/.bin/supabase');
const quote = arg => `'${arg.replaceAll("'", "'\"'\"'")}'`;
const rerunArgs = [...(pilot ? ['--testerarmy'] : legacy ? ['--legacy-playwright'] : []), ...(requestedRuntime ? ['--runtime', requestedRuntime] : []),
  ...(qualifyTi528 ? ['--qualify-ti528'] : []), ...args].map(quote).join(' ');
// Supabase documents this one for root runs of the native runtime; other SUPABASE_* settings are dropped.
const keptSupabaseEnv = ['SUPABASE_NATIVE_POSTGRES_USER'];
// The rerun repeats the overrides that chose the executable and the database user.
const rerunEnv = ['E2E_SUPABASE_CLI', 'E2E_SUPABASE_HOME', 'E2E_WEB_PORT', 'E2E_WORKERS', ...keptSupabaseEnv]
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

const config = path.join(target, 'config.toml');
fs.mkdirSync(target, { recursive: true, mode: 0o700 });
const migrationFixtures = prepareLocalMigrations(path.join(root, 'supabase/migrations'), path.join(target, 'migrations'));
let input = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
input = input.replace(/^project_id\s*=.*$/m, `project_id = "${project}"`)
  .replace('sql_paths = ["./seed.sql"]', 'sql_paths = []')
  .replaceAll('127.0.0.1:3000', `127.0.0.1:${webPort}`)
  // The native stack assigns its own loopback ports; a fixed port is never kept.
  .replace(/^\s*(?:port|shadow_port|inspector_port|smtp_port|pop3_port|vector_port)\s*=.*$/gm, '')
  .replace(/^\s*stack\s*=.*$/gm, '');
if (!/^\[experimental\]\s*$/m.test(input)) throw new Error('supabase/config.toml needs an [experimental] table');
input = input.replace(/^\[experimental\]\s*$/m, '[experimental]\nstack = true');
fs.writeFileSync(config, input);

const statusFile = path.join(workdir, 'status.json');
let started = false;
let stackId;
let cliVersion;
try {
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
  const passwordFile = path.join(workdir, 'password');
  fs.writeFileSync(passwordFile, `E2e!${randomUUID()}`, { mode: 0o600 });
  const testEnv = { ...process.env, E2E_WEB_PORT: webPort, E2E_WEB_LOCALE: 'en-US', E2E_BACKEND_PASSWORD_FILE: passwordFile, E2E_BACKEND_STATUS_FILE: statusFile, E2E_BACKEND_PROFILE: profile,
    E2E_BACKEND_RUNTIME: runtime, E2E_BACKEND_CLI_VERSION: cliVersion,
    E2E_BACKEND_RERUN: `${rerunEnv}npm run test:e2e:backend${rerunArgs ? ` -- ${rerunArgs}` : ''}`,
    E2E_BACKEND_MIGRATION_FIXTURES: JSON.stringify(migrationFixtures) };
  command(process.execPath, testerarmy
    ? ['tools/e2e/run.mjs', 'backend', 'web', 'run', ...args]
    : [path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js'), 'test', '--config', 'playwright.backend.config.ts', ...args], {
    env: testEnv,
  });
  if (!pilot && !legacy) {
    // The SDK has no independent simultaneous contexts or true browser-offline API.
    // Keep these exact journeys active, against the same owned stack, until it does.
    command(process.execPath, [path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js'),
      'test', '--config', 'playwright.backend.config.ts', '--grep',
      'a saved dream survives a completely fresh browser|an offline save synchronizes once'], { env: testEnv });
  }
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
    fs.rmSync(workdir, { recursive: true, force: true });
  }
}
