#!/usr/bin/env node
/**
 * `node tools/dev-local/dev-local.mjs`: a persistent local backend for development on phones,
 * the Simulator and the web. Native Supabase runtime (no Docker), real
 * migrations, Auth, Data API and Storage, the real API routes with fixed model
 * answers, guest sessions and two signed-in accounts. Production is never
 * contacted. Data lives in outputs/dev-local and survives restarts;
 * `--reset` destroys it explicitly.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeStackStatus, prepareLocalMigrations } = require('../../scripts/lib/backend-e2e-local.cjs');

const root = fileURLToPath(new URL('../../', import.meta.url));
const { values: options } = parseArgs({ options: {
  reset: { type: 'boolean', default: false },
  port: { type: 'string', default: process.env.DEV_LOCAL_PORT ?? '31300' },
  host: { type: 'string', default: process.env.DEV_LOCAL_HOST },
} });

const dataDir = resolve(process.env.DEV_LOCAL_DIR ?? join(root, 'outputs/dev-local'));
const workdir = join(dataDir, 'stack');
const secretsFile = join(dataDir, 'secrets.json');
const manifestFile = join(dataDir, 'manifest.json');
const profileFile = join(dataDir, 'expo.env');
const port = Number(options.port);
const PROJECT_ID = 'noctalia-dev-local';
const IOS_TEAM_ID = process.env.DEV_LOCAL_IOS_TEAM_ID ?? '27BLU7U28W';
const IOS_BUNDLE_IDS = ['com.tanuki75.noctalia', 'com.tanuki75.noctalia.qa'];
const ACCOUNTS = [
  { kind: 'free', email: 'dev-free@noctalia.test' },
  { kind: 'plus', email: 'dev-plus@noctalia.test' },
];

const cli = process.env.E2E_SUPABASE_CLI || join(root, 'node_modules/.bin/supabase');
const cliEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SUPABASE_') || key === 'SUPABASE_NATIVE_POSTGRES_USER')),
  SUPABASE_HOME: process.env.E2E_SUPABASE_HOME || join(root, 'test-results/backend-e2e-cli-home'),
  SUPABASE_EXPERIMENTAL_STACK: '1', DO_NOT_TRACK: '1',
};
function supabase(args) {
  const result = spawnSync(cli, args, { cwd: root, env: cliEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    // Startup output can hold local keys: keep it private instead of printing it.
    writeFileSync(join(dataDir, 'cli-failure.log'), `${result.stderr ?? ''}\n${result.stdout ?? ''}`, { mode: 0o600 });
    throw new Error(`supabase ${args[0]} ${args[1] ?? ''} failed (${result.status ?? result.error?.code}); see ${join(dataDir, 'cli-failure.log')}`);
  }
  return result.stdout.trim();
}

/** This machine's private IPv4 address, the one phones on the same network reach. */
export function lanAddress(interfaces = networkInterfaces()) {
  const candidates = [];
  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      if (/^(?:192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(entry.address)) candidates.push({ name, address: entry.address });
    }
  }
  candidates.sort((a, b) => Number(b.name === 'en0') - Number(a.name === 'en0'));
  return candidates[0]?.address ?? '127.0.0.1';
}

function readJson(file, fallback) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;
}
const writePrivate = (file, value) => writeFileSync(file, value, { mode: 0o600 });

/** Public EXPO_PUBLIC_* values of a base profile, without its backend or store keys. */
function baseProfile() {
  const file = join(root, '.env.teststore');
  const values = {};
  if (!existsSync(file)) return values;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^(EXPO_PUBLIC_[A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function writeStackConfig() {
  const target = join(workdir, 'supabase');
  mkdirSync(target, { recursive: true, mode: 0o700 });
  // Fixture copies: production URLs neutralised, scheduled jobs disabled. Tracked migrations are untouched.
  rmSync(join(target, 'migrations'), { recursive: true, force: true });
  const fixtures = prepareLocalMigrations(join(root, 'supabase/migrations'), join(target, 'migrations'));
  let config = readFileSync(join(root, 'supabase/config.toml'), 'utf8')
    .replace(/^project_id\s*=.*$/m, `project_id = "${PROJECT_ID}"`)
    .replace('sql_paths = ["./seed.sql"]', 'sql_paths = []')
    .replace(/^\s*(?:port|shadow_port|inspector_port|smtp_port|pop3_port|vector_port)\s*=.*$/gm, '')
    .replace(/^\s*stack\s*=.*$/gm, '');
  if (!/^\[experimental\]\s*$/m.test(config)) throw new Error('Missing local stack configuration.');
  config = config.replace(/^\[experimental\]\s*$/m, '[experimental]\nstack = true');
  writePrivate(join(target, 'config.toml'), config);
  return fixtures;
}

async function ensureAccounts(status) {
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(new URL(status.API_URL).origin, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const secrets = readJson(secretsFile, {});
  secrets.accounts ??= {};
  const existing = await admin.auth.admin.listUsers({ perPage: 200 });
  if (existing.error) throw new Error(`Local accounts could not be listed: ${existing.error.code ?? existing.error.message}`);
  for (const { kind, email } of ACCOUNTS) {
    // Readable on a phone keyboard, still unique to this machine.
    secrets.accounts[kind] ??= { email, password: `Nuit-${randomInt(100000, 999999)}-locale` };
    const found = existing.data.users.find((user) => user.email === email);
    const user = found ?? (await admin.auth.admin.createUser({ email, password: secrets.accounts[kind].password, email_confirm: true })).data.user;
    if (!user) throw new Error(`Local ${kind} account could not be created`);
    if (found) await admin.auth.admin.updateUserById(found.id, { password: secrets.accounts[kind].password });
    secrets.accounts[kind].id = user.id;
    if (kind === 'plus') {
      const entitlement = await admin.rpc('apply_subscription_state_update', {
        p_user_id: user.id, p_tier: 'plus', p_is_active: true,
        p_source: 'dev-local-fixture', p_source_event_id: crypto.randomUUID(),
      });
      if (entitlement.error) throw new Error(`Plus could not be granted locally: ${entitlement.error.code ?? entitlement.error.message}`);
    }
  }
  writePrivate(secretsFile, JSON.stringify(secrets, null, 2));
  return secrets.accounts;
}

async function main() {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  if (options.reset) {
    if (existsSync(join(workdir, 'supabase'))) {
      try { supabase(['stack', 'destroy', '--workdir', workdir, '--yes']); } catch (error) { console.warn(String(error.message)); }
    }
    for (const path of [workdir, secretsFile, manifestFile, profileFile]) rmSync(path, { recursive: true, force: true });
    console.log('[dev-local] local data destroyed; starting a new backend.');
  }
  const host = options.host ?? lanAddress();
  const publicOrigin = `http://${host}:${port}`;
  const fixtures = writeStackConfig();
  const status = normalizeStackStatus(JSON.parse(supabase(['stack', 'start', '--workdir', workdir,
    '--runtime', 'native', '--exclude', 'realtime,functions,studio,mail,analytics,pooler', '--eager', '--output-format', 'json'])));
  // A resumed stack keeps its data; migrations added since then are applied now.
  supabase(['migration', 'up', '--workdir', workdir, '--db-url', status.DB_URL, '--include-all']);
  const safety = JSON.parse(supabase(['db', 'query', '--workdir', workdir, '--db-url', status.DB_URL,
    'select count(*) as active_jobs from cron.job where active', '--output-format', 'json']));
  if (Number(safety.rows?.[0]?.active_jobs) !== 0) throw new Error('Local scheduled jobs must stay inactive.');
  const accounts = await ensureAccounts(status);
  const secrets = readJson(secretsFile, {});
  secrets.guestSessionSecret ??= randomBytes(32).toString('hex');
  writePrivate(secretsFile, JSON.stringify(secrets, null, 2));
  writePrivate(manifestFile, JSON.stringify({
    kind: 'noctalia-dev-local', schemaVersion: 1, status, publicOrigin, port,
    guestSessionSecret: secrets.guestSessionSecret,
    iosAppAttest: { teamId: IOS_TEAM_ID, bundleIds: IOS_BUNDLE_IDS },
  }, null, 2));
  const profile = {
    ...baseProfile(),
    EXPO_NO_DOTENV: '1', EXPO_PUBLIC_MOCK_MODE: 'false', EXPO_PUBLIC_MOCK_AUDIO: 'false', EXPO_PUBLIC_MOCK_PERSISTENCE: 'false',
    EXPO_PUBLIC_ANALYSIS_JOBS_ENABLED: 'true',
    EXPO_PUBLIC_SUPABASE_URL: publicOrigin, EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    EXPO_PUBLIC_SUPABASE_FUNCTION_JWT: status.ANON_KEY, EXPO_PUBLIC_API_URL: `${publicOrigin}/functions/v1/api`,
    // Cloudflare's documented always-pass test site key: web guests work offline from production.
    EXPO_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    EXPO_PUBLIC_REVENUECAT_WEB_KEY: '', EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: '', EXPO_PUBLIC_REVENUECAT_IOS_KEY: '',
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '', EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: '', EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '',
  };
  writePrivate(profileFile, Object.entries(profile).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');

  const server = spawn('deno', ['run', '--no-config', '--allow-net', '--allow-env',
    `--allow-read=${root},${dataDir}`, join(root, 'tools/dev-local/api-server.ts')], {
    cwd: root, stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, DEV_LOCAL_MANIFEST: manifestFile },
  });
  let stopping = false;
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    server.kill('SIGTERM');
    // Stop keeps the data; only --reset destroys it.
    try { supabase(['stack', 'stop', '--workdir', workdir]); } catch (error) { console.warn(String(error.message)); }
    process.exit(code);
  };
  process.once('SIGINT', () => stop(0));
  process.once('SIGTERM', () => stop(0));
  server.once('exit', (code) => { if (!stopping) { console.error(`[dev-local] API server exited (${code}).`); stop(1); } });

  console.log([
    '',
    `[dev-local] backend ready on ${publicOrigin} (stack ${status.LOCAL_E2E_STACK.id.slice(0, 12)}, data in ${dataDir}).`,
    `[dev-local] migrations: ${fixtures.neutralizedUrls} production URL(s) neutralised, ${fixtures.disabledSchedules} schedule(s) disabled.`,
    `[dev-local] accounts: free ${accounts.free.email} / ${accounts.free.password}`,
    `[dev-local]           plus ${accounts.plus.email} / ${accounts.plus.password}`,
    `[dev-local] app: node scripts/expo-safe-runner.js --profile ${profileFile} start --dev-client --lan --port 8081`,
    '[dev-local] check: node tools/dev-local/check.mjs',
    '[dev-local] AI answers are fixed; Google/Apple sign-in, purchases and store sync are not available.',
    '[dev-local] Ctrl-C stops and keeps the data; --reset starts from an empty backend.',
    '',
  ].join('\n'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[dev-local] ${error.message}`);
    process.exit(1);
  });
}
