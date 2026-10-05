import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const parameters = process.argv.slice(2);
if (['mobile', 'inspect', 'mcp'].includes(parameters[0])) {
  const mode = parameters.shift();
  if (!parameters[0] || !['android', 'ios'].includes(parameters[1]))
    throw new Error('Native entry requires an explicit product and android|ios.');
  if (mode !== 'mobile') parameters.splice(2, 0, mode);
}
const [product = 'dreamer', platform = 'web', command = 'run', ...args] = parameters;
if (!['dreamer', 'lucid', 'meditation', 'site'].includes(product) || !['web', 'android', 'ios'].includes(platform) || !['run', 'list', 'mcp', 'inspect'].includes(command))
  throw new Error('Usage: run.mjs dreamer|lucid|meditation|site web|android|ios [run|list|mcp|inspect] [e2e flags]');
if (product === 'site' && platform !== 'web') throw new Error('Site supports web only.');
if (command === 'inspect' && (platform === 'web' || args.length)) throw new Error('Inspection takes one native product/platform and no test flags.');
if (command === 'mcp' && args.length) throw new Error('The guarded MCP entry fixes its target and one session; pass no additional flags.');
// Selection cannot replace the owned config, device target or evidence directory.
const switches = new Set(['--video', '--trace', '--headed', '--debug', '--no-cache', '--strict-cache']);
const selections = new Set(['--grep', '--grep-invert', '--repeat-each', '--tag', '--exclude-tag', '--tag-mode']);
for (let index = 0; index < args.length; index++) {
  const flag = args[index];
  if (switches.has(flag)) continue;
  if (!selections.has(flag)) throw new Error(`Unsupported E2E option: ${flag}`);
  const value = args[++index];
  if (!value || value.startsWith('-')) throw new Error(`Invalid E2E value for ${flag}.`);
  if (flag === '--repeat-each' && (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))))
    throw new Error('Invalid E2E repeat count.');
}
const cli = join(cwd, 'node_modules/e2e/dist/cli/bin.js');
if (!existsSync(cli)) throw new Error('Install with npm run test:testerarmy:setup first.');
const env = { ...process.env, E2E_PRODUCT: product, E2E_PLATFORM: platform, E2E_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' };
const sdk = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT ?? (process.platform === 'darwin' ? join(homedir(), 'Library/Android/sdk') : undefined);
if (sdk && existsSync(sdk)) {
  env.ANDROID_HOME = env.ANDROID_SDK_ROOT = sdk;
  env.PATH = [join(sdk, 'platform-tools'), join(sdk, 'emulator'), env.PATH].join(delimiter);
}
if (command === 'list') {
  if (platform !== 'web' && !env.E2E_DEVICE) env.E2E_DEVICE = platform === 'android' ? 'emulator-0000' : 'iPhone Simulator';
  const result = spawnSync(process.execPath, [cli, command, ...args], { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
const relativeOutput = `.e2e/${product}-${platform}/${Date.now()}-${process.pid}`;
env.E2E_OUTPUT = relativeOutput;
const output = join(cwd, relativeOutput);
const bundle = { dreamer: 'com.tanuki75.noctalia', lucid: 'com.tanuki75.noctalia.lucid', meditation: 'com.noctalia.meditation' }[product];
function read(executable, argv, options = {}) {
  const result = spawnSync(executable, argv, { cwd: root, env, encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr || `${executable} failed`);
  return result.stdout.trim();
}
let lock;
let fd;
let identity;
async function execute(executable, argv, logName) {
  const logFd = logName ? openSync(join(output, logName), 'w') : undefined;
  const child = spawn(executable, argv, { cwd, env, stdio: logFd === undefined ? 'inherit' : ['ignore', logFd, logFd], detached: process.platform !== 'win32' });
  const relay = signal => {
    try {
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal);
    }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  const interrupt = () => relay('SIGINT');
  const terminate = () => relay('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  try {
    return await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve(code ?? (signal ? 130 : 1)));
    });
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
    if (logFd !== undefined) closeSync(logFd);
  }
}
try {
  const device = env.E2E_DEVICE;
  let binary = null;
  if (platform !== 'web' && command !== 'list') {
    if (!device) throw new Error('E2E_DEVICE must name a dedicated emulator or iOS Simulator.');
    if (platform === 'android') {
      if (!/^emulator-\d+$/.test(device)) throw new Error('Physical phones are excluded. Select an emulator serial.');
      read('adb', ['-s', device, 'get-state']);
      const dump = read('adb', ['-s', device, 'shell', 'dumpsys', 'package', bundle]);
      if (!dump.includes(`Package [${bundle}]`)) throw new Error(`Install the ${product} Release APK before running.`);
      if (/DEBUGGABLE/.test(dump)) throw new Error('Native qualification requires a Release build, not a Debug/development client.');
      binary = dump.split('\n').filter(line => /versionCode=|versionName=/.test(line)).map(line => line.trim());
      identity = device;
    } else {
      const devices = Object.values(JSON.parse(read('xcrun', ['simctl', 'list', 'devices', 'available', '--json'])).devices).flat();
      const matches = devices.filter(entry => entry.name === device || entry.udid === device);
      if (matches.length !== 1) throw new Error('E2E_DEVICE must resolve to exactly one available iOS Simulator.');
      identity = matches[0].udid;
      const appPath = read('xcrun', ['simctl', 'get_app_container', identity, bundle, 'app']);
      binary = { appPath, info: read('plutil', ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', join(appPath, 'Info.plist')]) };
    }
    lock = join(tmpdir(), `noctalia-testerarmy-${createHash('sha256').update(identity).digest('hex')}.lock`);
    fd = openSync(lock, 'wx');
    writeFileSync(fd, JSON.stringify({ pid: process.pid, product, platform, device }));
  }
  if (product === 'site' && command !== 'list' && !existsSync(join(root, 'docs/en/index.html')))
    throw new Error('Build the generated site with npm run docs:build before running.');
  mkdirSync(output, { recursive: true });
  const diff = read('git', ['diff', 'HEAD']);
  writeFileSync(join(output, 'evidence.json'), JSON.stringify({
    startedAt: new Date().toISOString(), product, platform, device: env.E2E_DEVICE ?? null, bundle, binary,
    revision: read('git', ['rev-parse', 'HEAD']), workingTree: read('git', ['status', '--porcelain']),
    trackedDiffSha256: createHash('sha256').update(diff).digest('hex'),
    command: ['node', 'tools/e2e/run.mjs', product, platform, command, ...args],
    services: platform === 'web' && product !== 'site' ? 'mock services; local real UI' : 'installed binary / generated site; no automatic build',
  }, null, 2) + '\n');
  if (command === 'inspect') {
    const deviceCli = join(cwd, 'node_modules/agent-device/bin/agent-device.mjs');
    const session = `noctalia-inspect-${process.pid}-${Date.now()}`;
    const target = ['--session', session, '--platform', platform, platform === 'android' ? '--serial' : '--udid', identity];
    let status = 1;
    try {
      status = await execute(process.execPath, [deviceCli, 'open', bundle, '--foreground', ...target], 'open.txt');
      if (status === 0) status = await execute(process.execPath, [deviceCli, 'snapshot', '-i', ...target], 'screen.txt');
      if (status === 0) status = await execute(process.execPath, [deviceCli, 'screenshot', join(output, 'screen.png'), ...target], 'screenshot.txt');
    } finally {
      const closed = await execute(process.execPath, [deviceCli, 'close', ...target], 'close.txt');
      if (status === 0 && closed !== 0) status = closed;
      writeFileSync(join(output, 'inspection.json'), JSON.stringify({ session, status, purpose: 'UI inspection; no assertions, reset, install or model call' }, null, 2) + '\n');
      console.log(`Inspection evidence: tools/e2e/${relativeOutput}`);
    }
    process.exitCode = status;
  } else {
    const flags = command === 'mcp' ? ['--target', `${product}-${platform}`, '--max-sessions', '1'] : args;
    process.exitCode = await execute(process.execPath, [cli, command, ...flags]);
  }
} finally {
  if (fd !== undefined) { closeSync(fd); unlinkSync(lock); }
}
