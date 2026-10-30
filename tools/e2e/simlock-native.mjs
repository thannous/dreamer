import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_OUTPUT = 256 * 1024;

export function needsSimlock({ platform, command, env }) {
  return (platform === 'ios' || platform === 'android') && command === 'run' && !env.E2E_DEVICE;
}

export function simlockBinary(env) {
  if (env.E2E_SIMLOCK_BIN?.trim()) return env.E2E_SIMLOCK_BIN.trim();
  const installed = join(homedir(), 'Projects', 'infra-ops', 'simlock-pilot', 'simlock');
  return existsSync(installed) ? installed : 'simlock';
}

function checkedGrant(grant, platform) {
  const { device, lease, environment } = grant ?? {};
  if (!device || !lease || !environment || device.physical !== false || device.spec?.physical !== false
    || device.spec.platform !== platform || lease.deviceId !== device.id
    || typeof device.spec.model !== 'string' || !device.spec.model.trim()
    || typeof device.spec.osVersion !== 'string' || !device.spec.osVersion.trim()
    || !Number.isSafeInteger(lease.grantedAt)
    || typeof lease.requesterId !== 'string' || !lease.requesterId.trim()
    || !/^[A-Za-z0-9_-]{1,128}$/.test(lease.id ?? '')
    || (platform === 'android' && !/^emulator-\d+$/.test(device.address ?? ''))
    || (platform === 'ios' && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(device.address ?? '')))
    throw new Error('SIMLOCK_GRANT_INVALID');
  if (platform === 'ios' && environment.SIMLOCK_IOS_DEVICE_SET !== undefined
    && (typeof environment.SIMLOCK_IOS_DEVICE_SET !== 'string'
      || !environment.SIMLOCK_IOS_DEVICE_SET.startsWith('/'))) throw new Error('SIMLOCK_IOS_DEVICE_SET_INVALID');
  if (platform === 'android' && (!/^\d+$/.test(String(environment.ANDROID_ADB_SERVER_PORT ?? ''))
      || Number(environment.ANDROID_ADB_SERVER_PORT) < 1 || Number(environment.ANDROID_ADB_SERVER_PORT) > 65535))
    throw new Error('SIMLOCK_ANDROID_PORT_INVALID');
  return grant;
}

async function command(binary, args, env) {
  const { stdout } = await execFileAsync(binary, args, { env, timeout: 30_000, maxBuffer: MAX_OUTPUT });
  return stdout.trim();
}

function closeWithin(child, closed, timeoutMs = 10_000) {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  let timer;
  return Promise.race([
    closed,
    new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        reject(new Error('SIMLOCK_HOLDER_CLOSE_TIMEOUT'));
      }, timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

// The foreground Simlock CLI renews its own lease and watches this runner's PID.
// A separate release call gives us an explicit acknowledgement before end.json.
export async function acquireSimlock({ platform, env, shimDirectory, onLoss = () => {}, onSignal = () => {} }) {
  // Codex and Claude supply their own session identity. A plain terminal needs
  // one stable identity across the separate catalog, lease and release CLIs.
  if (!env.SIMLOCK_AGENT_ID && !env.CODEX_SESSION_ID && !env.CLAUDE_CODE_SESSION_ID)
    env.SIMLOCK_AGENT_ID = `noctalia-e2e-${randomUUID()}`;
  const requester = env.SIMLOCK_AGENT_ID || (env.CLAUDE_CODE_SESSION_ID
    ? `claude-code:${env.CLAUDE_CODE_SESSION_ID}` : `codex:${env.CODEX_SESSION_ID}`);
  const binary = simlockBinary(env);
  const timeout = Number(env.E2E_SIMLOCK_TIMEOUT_SECONDS ?? 180);
  if (!Number.isSafeInteger(timeout) || timeout < 10 || timeout > 3600) throw new Error('SIMLOCK_TIMEOUT_INVALID');
  const catalog = JSON.parse(await command(binary, ['catalog', '--platform', platform, '--json'], env));
  const available = catalog.platforms?.find(item => item.platform === platform);
  if (!Array.isArray(available?.runtimes) || available.runtimes.length === 0
    || !available.modelRuntimes || !Object.values(available.modelRuntimes).some(runtimes => Array.isArray(runtimes) && runtimes.length > 0))
    throw new Error('SIMLOCK_NO_INSTALLED_DEVICE_RUNTIME');
  const args = ['lease', '--platform', platform, '--bind-pid', String(process.pid), '--ttl', '30m', '--timeout', `${timeout}s`];
  if (env.E2E_SIMLOCK_MODEL?.trim()) args.push('--device', env.E2E_SIMLOCK_MODEL.trim());
  else args.push('--class', 'phone');
  if (env.E2E_SIMLOCK_OS?.trim()) args.push('--os', env.E2E_SIMLOCK_OS.trim());
  if (env.E2E_SIMLOCK_NO_WAIT === '1') args.push('--no-wait');

  // Its own process group: a terminal Ctrl-C reaches only the runner, which
  // releases after the SDK and device cleanup. --bind-pid covers a dead runner.
  const child = spawn(binary, args, { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let closing = false, granted = false, stderr = '', stdout = '', receivedSignal, loss, lossMarker;
  let resolveGrant, rejectGrant;
  const grantResult = new Promise((resolve, reject) => { resolveGrant = resolve; rejectGrant = reject; });
  const closed = new Promise(resolve => child.once('close', (code, signal) => {
    if (!granted) rejectGrant(new Error(`SIMLOCK_LEASE_FAILED: ${stderr.trim() || `exit ${code ?? signal}`}`));
    else if (!closing) {
      loss = { code, signal, message: stderr.slice(-4096) };
      // The shims refuse every later device command once this marker exists.
      if (lossMarker) try { writeFileSync(lossMarker, JSON.stringify(loss)); } catch { /* onLoss still fails the run */ }
      onLoss(loss);
    }
    resolve({ code, signal });
  }));
  child.once('error', error => rejectGrant(new Error(`SIMLOCK_START_FAILED: ${error.message}`)));
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-8192); });
  child.stdout.on('data', chunk => {
    stdout += chunk.toString();
    if (stdout.length > MAX_OUTPUT) { rejectGrant(new Error('SIMLOCK_GRANT_TOO_LARGE')); return; }
    const newline = stdout.indexOf('\n');
    if (newline !== -1 && !granted) {
      try {
        const parsed = JSON.parse(stdout.slice(0, newline));
        granted = true;
        resolveGrant(parsed);
      } catch { rejectGrant(new Error('SIMLOCK_GRANT_NOT_JSON')); }
    }
  });
  const signal = value => {
    receivedSignal = value;
    onSignal(value);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(value);
      // A holder still queued for capacity ignores signals until it is granted.
      // It holds no device yet, so it is stopped outright.
      setTimeout(() => {
        if (!granted && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, 2000).unref();
    }
  };
  const onInterrupt = () => signal('SIGINT');
  const onTerminate = () => signal('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  let grant;
  try {
    grant = await grantResult;
    if (receivedSignal) throw new Error('SIMLOCK_INTERRUPTED');
    checkedGrant(grant, platform);
    if (grant.lease.requesterId !== requester)
      throw new Error('SIMLOCK_REQUESTER_MISMATCH');
  } catch (error) {
    closing = true;
    let cleanupError;
    // If the grant arrived but failed validation, release only its own ID.
    if (grant?.lease?.requesterId === requester && /^[A-Za-z0-9_-]{1,128}$/.test(grant?.lease?.id ?? '')) {
      try { await command(binary, ['release', grant.lease.id], env); } catch (failure) { cleanupError = failure; }
    } else if (grant) {
      cleanupError = new Error('SIMLOCK_REQUESTER_UNPROVEN');
    }
    try { await closeWithin(child, closed); } catch (failure) { cleanupError ??= failure; }
    if (cleanupError) throw new Error(`${error.message}; SIMLOCK_RELEASE_UNPROVEN: ${cleanupError.message}`);
    throw error;
  } finally {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
  }

  let stateDirectory;
  const cleanupState = () => { if (stateDirectory) rmSync(stateDirectory, { recursive: true, force: true }); };
  const release = async ({ preserveState = false } = {}) => {
    closing = true;
    let releaseError;
    try {
      const acknowledgement = JSON.parse(await command(binary, ['release', grant.lease.id], env));
      if (acknowledgement.leaseId !== grant.lease.id) throw new Error('SIMLOCK_RELEASE_ID_MISMATCH');
    } catch (error) { releaseError = error; }
    try { await closeWithin(child, closed); } catch (error) { releaseError ??= error; }
    if (!preserveState) try { cleanupState(); } catch (error) { releaseError ??= error; }
    if (releaseError) throw new Error(`SIMLOCK_RELEASE_UNPROVEN: ${releaseError.message}`);
    return { leaseId: grant.lease.id, released: true, releasedAt: new Date().toISOString(),
      ...(preserveState ? { retainedStateDirectory: stateDirectory } : {}) };
  };
  try {
    stateDirectory = mkdtempSync(join(tmpdir(), 'noctalia-simlock-agent-'));
    lossMarker = join(stateDirectory, 'simlock-lease-lost.json');
    Object.assign(env, {
      E2E_DEVICE: grant.device.address,
      E2E_SIMLOCK_BIN: binary,
      E2E_SIMLOCK_LEASE_ID: grant.lease.id,
      AGENT_DEVICE_STATE_DIR: stateDirectory,
      E2E_SIMLOCK_LOSS_MARKER: lossMarker,
    });
    if (platform === 'ios') {
      const deviceSet = grant.environment.SIMLOCK_IOS_DEVICE_SET;
      if (deviceSet) {
        env.SIMLOCK_IOS_DEVICE_SET = deviceSet;
        env.AGENT_DEVICE_IOS_SIMULATOR_DEVICE_SET = deviceSet;
      } else {
        delete env.SIMLOCK_IOS_DEVICE_SET;
        delete env.AGENT_DEVICE_IOS_SIMULATOR_DEVICE_SET;
      }
    } else {
      const port = String(grant.environment.ANDROID_ADB_SERVER_PORT);
      env.ANDROID_ADB_SERVER_PORT = port;
      env.ADB_SERVER_SOCKET = `tcp:127.0.0.1:${port}`;
      const raw = await command(binary, ['adb', '--lease', grant.lease.id, '-s', grant.device.address, 'emu', 'avd', 'name'], env);
      const lines = raw.split(/\r?\n/).map(line => line.trim());
      if (!lines[0] || lines.length > 2 || (lines.length === 2 && lines[1] !== 'OK')) throw new Error('SIMLOCK_AVD_PROTOCOL');
      env.E2E_AVD_NAME = lines[0];
    }
    const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH') ?? 'PATH';
    env.E2E_SIMLOCK_UNWRAPPED_PATH = env[pathKey];
    env[pathKey] = [shimDirectory, env[pathKey]].join(delimiter);
    if (loss) throw new Error('SIMLOCK_LEASE_LOST_DURING_SETUP');
    return {
      release,
      evidence: { leaseId: grant.lease.id, deviceId: grant.device.id, address: grant.device.address,
        requesterId: grant.lease.requesterId, platform, model: grant.device.spec.model,
        osVersion: grant.device.spec.osVersion, grantedAt: grant.lease.grantedAt },
    };
  } catch (error) {
    try { await release(); } catch (cleanupError) { throw new Error(`${error.message}; ${cleanupError.message}`); }
    throw error;
  }
}
