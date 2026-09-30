#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const index = args.indexOf('--status-file');
const suppliedStatus = index >= 0 ? args.splice(index, 2)[1] : undefined;
if (index >= 0 && (!suppliedStatus || suppliedStatus.startsWith('--'))) throw new Error('--status-file requires a private JSON file');
const prepareOnly = args.includes('--prepare-only');
const isolatedRun = !suppliedStatus && !prepareOnly;
const workdir = isolatedRun ? fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-backend-e2e-')) : path.join(os.tmpdir(), 'noctalia-backend-e2e');
const project = `noctalia-backend-e2e-disposable${isolatedRun ? `-${randomUUID().slice(0, 8)}` : ''}`;
const target = path.join(workdir, 'supabase');
// Use the shipped Go engine on macOS, retaining ordinary OS signature validation.
const cli = process.env.E2E_SUPABASE_CLI || (process.platform === 'darwin'
  ? path.join(path.dirname(require.resolve(`@supabase/cli-darwin-${process.arch}/package.json`)), 'bin/supabase-go')
  : path.join(root, 'node_modules/.bin/supabase'));
const docker = process.env.E2E_DOCKER_CLI || 'docker';

function command(binary, argv, options = {}) {
  const result = spawnSync(binary, argv, { cwd: root, stdio: 'inherit', ...options });
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
fs.cpSync(path.join(root, 'supabase/migrations'), path.join(target, 'migrations'), { recursive: true });
let input = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
input = input.replace(/^project_id\s*=.*$/m, `project_id = "${project}"`)
  .replace(/^(\s*(?:port|shadow_port)\s*=\s*)5432(\d)\s*$/gm, '$15632$2')
  .replace(/^inspector_port\s*=\s*8083\s*$/m, 'inspector_port = 8283')
  .replace('sql_paths = ["./seed.sql"]', 'sql_paths = []')
  .replaceAll('127.0.0.1:3000', '127.0.0.1:8085');
fs.writeFileSync(config, input);
if (prepareOnly) {
  console.log(`Prepared ${workdir}; no database was started or reset.`);
  process.exit(0);
}

const statusFile = suppliedStatus ? path.resolve(suppliedStatus) : path.join(workdir, 'status.json');
let started = false;
let network;
try {
  if (!suppliedStatus) {
    // Never reset or stop another project. Supabase initializes this separate project from migrations.
    network = command(docker, ['network', 'create', '--opt', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', project], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }).trim();
    // Capture stdout because CLI startup prints privileged local keys there.
    // Also clean partially started containers if migration replay fails.
    started = true;
    command(cli, ['start', '--workdir', workdir, '--network-id', network, '--exclude', 'studio,logflare,vector,edge-runtime,imgproxy,mailpit,postgres-meta'], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const status = command(cli, ['status', '--workdir', workdir, '--output', 'json'], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
    fs.writeFileSync(statusFile, status, { mode: 0o600 });
  }
  const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
  const url = new URL(status.API_URL);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== '56321' || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
    throw new Error('Only the disposable loopback API on port 56321 is accepted');
  }
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
    env: { ...process.env, E2E_BACKEND_STATUS_FILE: statusFile, E2E_BACKEND_PROFILE: profile },
  });
} finally {
  // Only this run's randomly named disposable database is removed; no reset or --all.
  if (started) command(cli, ['stop', '--workdir', workdir, '--no-backup']);
  if (network) command(docker, ['network', 'rm', network]);
}
