import { randomUUID } from 'node:crypto';
import { openSync, writeFileSync, closeSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Different devices share these fixtures, quotas and the network control. */
export function acquireNativeBackendRunLock({ stackId, product, platform, device }, directory = tmpdir()) {
  if (!/^[a-f0-9]{64}$/.test(stackId) || product !== 'dreamer' || !['ios', 'android'].includes(platform)
    || typeof device !== 'string' || !device) throw new Error('Invalid native backend lock identity.');
  const path = join(directory, `noctalia-testerarmy-backend-${stackId}.lock`);
  const owner = { pid: process.pid, product, platform, device, stackId, invocation: randomUUID() };
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(owner)); }
  catch (error) { closeSync(fd); throw error; }
  return { path, fd, owner };
}

/** Release only this invocation, after its SDK process has closed. */
export function releaseNativeBackendRunLock(lock) {
  let closeError;
  try { closeSync(lock.fd); } catch (error) { closeError = error; }
  const owner = JSON.parse(readFileSync(lock.path, 'utf8'));
  if (owner.pid !== process.pid || JSON.stringify(owner) !== JSON.stringify(lock.owner))
    throw new Error('Foreign native backend lock.');
  unlinkSync(lock.path);
  if (closeError) throw closeError;
}
