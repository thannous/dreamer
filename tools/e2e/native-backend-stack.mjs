#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { assertBackendTarget, normalizeStackStatus, prepareLocalMigrations } from '../../scripts/lib/backend-e2e-local.cjs';
import { startNativeBackendProxy } from './native-backend-proxy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** One disposable real Auth/Postgres stack, kept alive across local Release builds and both native runs. */
export async function startNativeBackendStack({ output, port = 31283, functionsOrigin }) {
  const outputDir = resolve(output);
  // An existing folder might belong to another run and must never be overwritten.
  mkdirSync(outputDir, { mode: 0o700 });
  const workdir = mkdtempSync(join(tmpdir(), 'noctalia-native-backend-'));
  const id = randomUUID();
  const cli = process.env.E2E_SUPABASE_CLI || join(root, 'node_modules/.bin/supabase');
  const cliEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SUPABASE_') || key === 'SUPABASE_NATIVE_POSTGRES_USER')),
    SUPABASE_HOME: process.env.E2E_SUPABASE_HOME || join(root, 'test-results/backend-e2e-cli-home'),
    SUPABASE_EXPERIMENTAL_STACK: '1', DO_NOT_TRACK: '1',
  };
  const command = args => {
    const result = spawnSync(cli, args, { cwd: root, env: cliEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
      // Startup stdout may hold local keys; preserve private diagnostics without printing them.
      writeFileSync(join(outputDir, 'cli-failure.log'), `${result.stderr ?? ''}\n${result.stdout ?? ''}`, { mode: 0o600 });
      throw new Error(`Local Supabase ${args[0]} failed (${result.status ?? result.error?.code}); private cli-failure.log retained.`);
    }
    return result.stdout.trim();
  };
  let started = false;
  let stackId;
  let proxy;
  let closed = false;
  const manifestFile = join(outputDir, 'manifest.json');
  const profileFile = join(outputDir, 'expo.env');
  const close = async () => {
    if (closed) return;
    closed = true;
    try { if (proxy) await proxy.close(); }
    finally {
      try {
        if (started) command(['stack', 'destroy', '--workdir', workdir,
          ...(stackId ? ['--stack-id', stackId] : []), '--yes']);
      } finally {
        for (const file of [manifestFile, profileFile]) rmSync(file, { force: true });
        rmSync(workdir, { recursive: true, force: true });
      }
    }
  };
  try {
    const cliVersion = command(['--version']);
    const version = /^(\d+)\.(\d+)\.(\d+)/.exec(cliVersion);
    if (!version || Number(version[1]) < 2 || (Number(version[1]) === 2 && Number(version[2]) < 119))
      throw new Error('Native backend requires Supabase CLI 2.119.0 or later in the installed v2 series.');
    mkdirSync(cliEnv.SUPABASE_HOME, { recursive: true, mode: 0o700 });
    const target = join(workdir, 'supabase');
    mkdirSync(target, { mode: 0o700 });
    const migrationFixtures = prepareLocalMigrations(join(root, 'supabase/migrations'), join(target, 'migrations'));
    let config = readFileSync(join(root, 'supabase/config.toml'), 'utf8')
      .replace(/^project_id\s*=.*$/m, `project_id = "noctalia-native-e2e-disposable-${id}"`)
      .replace('sql_paths = ["./seed.sql"]', 'sql_paths = []')
      .replace(/^\s*(?:port|shadow_port|inspector_port|smtp_port|pop3_port|vector_port)\s*=.*$/gm, '')
      .replace(/^\s*stack\s*=.*$/gm, '');
    if (!/^\[experimental\]\s*$/m.test(config)) throw new Error('Missing local stack configuration.');
    config = config.replace(/^\[experimental\]\s*$/m, '[experimental]\nstack = true');
    writeFileSync(join(target, 'config.toml'), config, { mode: 0o600 });
    started = true;
    const status = normalizeStackStatus(JSON.parse(command(['stack', 'start', '--workdir', workdir,
      '--runtime', 'native', '--exclude', 'realtime,functions,studio,mail,analytics,pooler', '--eager', '--output-format', 'json'])));
    stackId = status.LOCAL_E2E_STACK.id;
    if (status.LOCAL_E2E_STACK.runtime !== 'native') throw new Error('Unexpected stack runtime.');
    const url = assertBackendTarget(status);
    const safety = JSON.parse(command(['db', 'query', '--workdir', workdir, '--db-url', status.DB_URL,
      'select count(*) as active_jobs from cron.job where active', '--output-format', 'json']));
    if (Number(safety.rows?.[0]?.active_jobs) !== 0) throw new Error('Disposable cron jobs must remain inactive.');
    const admin = createClient(url.origin, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const accounts = {};
    for (const kind of ['owner', 'other']) {
      const email = `native-e2e-${kind}-${id}@example.test`;
      const password = `Native!${randomUUID()}`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error) throw new Error(`Local ${kind} fixture account could not be created: ${created.error.code}`);
      accounts[kind] = { id: created.data.user.id, email, password };
    }
    const controlToken = randomUUID() + randomUUID();
    proxy = await startNativeBackendProxy({ backendOrigin: url.origin, functionsOrigin, port, controlToken });
    const publicEnv = {
      EXPO_NO_DOTENV: '1', EXPO_PUBLIC_MOCK_MODE: 'false', EXPO_PUBLIC_MOCK_AUDIO: 'false',
      EXPO_PUBLIC_MOCK_PERSISTENCE: 'false', EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED: 'false',
      EXPO_PUBLIC_ANALYSIS_JOBS_ENABLED: 'true',
      EXPO_PUBLIC_SUPABASE_URL: proxy.origin, EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
      EXPO_PUBLIC_API_URL: `${proxy.origin}/functions/v1/api`,
      EXPO_PUBLIC_REVENUECAT_WEB_KEY: '', EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: '', EXPO_PUBLIC_REVENUECAT_IOS_KEY: '',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '', EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: '', EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '',
      EXPO_PUBLIC_TURNSTILE_SITE_KEY: '',
    };
    writeFileSync(profileFile, Object.entries(publicEnv).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
    const state = { schemaVersion: 1, kind: 'noctalia-native-backend', id, status,
      proxy: { origin: proxy.origin, controlToken, ...(functionsOrigin ? { functionsOrigin } : {}) },
      accounts, profilePath: profileFile, cliVersion, migrationFixtures };
    writeFileSync(manifestFile, JSON.stringify(state, null, 2), { mode: 0o600 });
    writeFileSync(join(outputDir, 'receipt.json'), JSON.stringify({ schemaVersion: 1, id,
      startedAt: new Date().toISOString(), cliVersion, stackId, backendOrigin: url.origin,
      proxyOrigin: proxy.origin, functionsOrigin: functionsOrigin ?? null, migrationFixtures,
      boundary: 'real local Auth/Postgres; app transport can be disconnected; no hosted accounts or Store' }, null, 2));
    return { state, manifestFile, profileFile, close };
  } catch (error) { await close(); throw error; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: {
    output: { type: 'string' }, port: { type: 'string', default: '31283' }, 'functions-origin': { type: 'string' },
  } });
  if (!values.output) throw new Error('Pass --output <new-private-directory>.');
  let requestedStop;
  const stopped = new Promise(resolveStop => { requestedStop = resolveStop; });
  const onSignal = () => requestedStop();
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  let backend;
  try {
    backend = await startNativeBackendStack({ output: values.output, port: Number(values.port), functionsOrigin: values['functions-origin'] });
    console.log(JSON.stringify({ ready: true, manifestFile: backend.manifestFile, profileFile: backend.profileFile, origin: backend.state.proxy.origin }));
    await stopped;
  } finally {
    await backend?.close();
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}
