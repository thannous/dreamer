import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const options = { check: false, list: false, allowPurchase: false, grep: '' };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--check') options.check = true;
  else if (args[i] === '--list') options.list = true;
  else if (args[i] === '--allow-sandbox-purchase') options.allowPurchase = true;
  else if (args[i] === '--grep' && args[i + 1]) options.grep = args[++i];
  else throw new Error('Use --check, --list, --grep <selection>, --allow-sandbox-purchase only. Workers=1 and retries=0 are fixed.');
}
assert.ok(options.check || options.grep, 'Select tests explicitly with --grep; no implicit full campaign or purchase.');
const env = { ...process.env };
require(join(root, 'scripts/expo-safe-runner.js')).loadEnvProfile(
  env.E2E_IPHONE_ENV_PROFILE || '.env.ios-sandbox.local', { cwd: root, env },
);
function required(name) {
  assert.ok(env[name]?.trim(), `Missing private profile setting: ${name}`);
  return env[name];
}
const evidence = resolve(root, required('E2E_IPHONE_EVIDENCE'));
const deviceName = required('E2E_IPHONE_DEVICE_NAME');
const udid = required('E2E_IPHONE_UDID');
const ownerId = required('E2E_IPHONE_EXPECTED_APP_USER_ID');
assert.match(ownerId, /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
for (const name of ['AGENT_DEVICE_IOS_TEAM_ID', 'AGENT_DEVICE_IOS_BUNDLE_ID', 'AGENT_DEVICE_IOS_RUNNER_DERIVED_PATH', 'E2E_IPHONE_METRO_LOG']) required(name);
const approval = JSON.parse(readFileSync(join(evidence, 'preflight.json'), 'utf8'));
assert.ok(approval.sandboxAccountConfirmedByOwner && approval.emailValidationConfirmedByOwner
  && approval.bundle === 'com.tanuki75.noctalia' && env.EXPO_PUBLIC_MOCK_MODE === 'false'
  && env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.startsWith('appl_'), 'Require the owner-approved, validated Apple Sandbox account and real Apple SDK, mock=false.');
const expectedVersion = env.E2E_IPHONE_EXPECTED_VERSION || '3.5.0';
const expectedBuild = env.E2E_IPHONE_EXPECTED_BUILD || '13';
const cli = join(root, 'tools/e2e/node_modules/e2e/dist/cli/bin.js');
Object.assign(env, {
  AGENT_DEVICE_STATE_DIR: join(evidence, 'agent-device'),
  E2E_OWNER_IPHONE_SANDBOX_ACK: 'OWNER_APPROVED_APPLE_SANDBOX',
  E2E_IPHONE_ALLOW_PURCHASE: options.allowPurchase ? 'true' : 'false',
  E2E_IPHONE_EVIDENCE: evidence,
  E2E_IPHONE_DEVICE_NAME: deviceName,
  E2E_OUTPUT: `.e2e/owner-iphone-sandbox-${Date.now()}`,
});
if (!options.list) {
  const jsonPath = join(evidence, 'installed-before-e2e.json');
  execFileSync('xcrun', ['devicectl', 'device', 'info', 'apps', '--device', udid, '--timeout', '15', '--json-output', jsonPath], { stdio: 'ignore' });
  const app = JSON.parse(readFileSync(jsonPath, 'utf8')).result.apps.find(a => a.bundleIdentifier === 'com.tanuki75.noctalia');
  assert.ok(app?.builtByDeveloper && app.version === expectedVersion && app.bundleVersion === expectedBuild,
    'Installed development candidate changed: refuse before opening the app.');
  const metro = new URL(env.E2E_IPHONE_METRO_ORIGIN || 'http://127.0.0.1:4519');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(metro.hostname), 'Metro control endpoint must be local.');
  const response = await fetch(new URL('/_expo/open?platform=ios', metro), { signal: AbortSignal.timeout(15_000) });
  assert.ok(response.ok, 'Local Metro must be available.');
  const launch = await response.json();
  assert.ok(launch.appId === app.bundleIdentifier && launch.runtime === 'custom', 'Wrong Metro target.');
  env.E2E_IPHONE_PROJECT_URL = launch.url;
  if (options.check) {
    console.log(JSON.stringify({ status: 'ready', candidate: { bundle: app.bundleIdentifier, version: app.version, build: app.bundleVersion }, mock: false, purchaseEnabled: options.allowPurchase, note: 'Read-only preflight; no app launch or purchase. Sandbox sheet and receipt still require verification.' }));
    process.exit(0);
  }
  const out = {
    startedAt: new Date().toISOString(), sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    output: env.E2E_OUTPUT, candidate: { bundle: app.bundleIdentifier, version: app.version, build: app.bundleVersion, builtByDeveloper: true },
    mock: false, store: 'Apple App Store sandbox', selectedTests: ['--grep', options.grep], allowPurchase: options.allowPurchase,
    localTestSourceSha256: Object.fromEntries(['tools/e2e/run-iphone-sandbox-local.mjs', 'tools/e2e/e2e.iphone-sandbox.config.ts', 'tools/e2e/tests/dreamer.iphone-sandbox.e2e.ts'].map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')])),
  };
  mkdirSync(join(evidence, 'invocations'), { recursive: true });
  writeFileSync(join(evidence, 'invocations', `${Date.now()}.json`), JSON.stringify(out, null, 2));
  writeFileSync(join(evidence, 'e2e-invocation.json'), JSON.stringify(out, null, 2));
}
const child = spawn(process.execPath, [cli, options.list ? 'list' : 'run', '--config', 'e2e.iphone-sandbox.config.ts', '--grep', options.grep], { cwd: join(root, 'tools/e2e'), env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 3; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 3 : (code ?? 3); });
