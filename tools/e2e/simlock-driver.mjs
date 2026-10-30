import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const [tool, ...input] = process.argv.slice(2);
const binary = process.env.E2E_SIMLOCK_BIN;
const lease = process.env.E2E_SIMLOCK_LEASE_ID;
const device = process.env.E2E_DEVICE;
const lossMarker = process.env.E2E_SIMLOCK_LOSS_MARKER;
if (!binary || !lease || !device || !lossMarker || !process.env.E2E_SIMLOCK_UNWRAPPED_PATH) throw new Error('SIMLOCK_DRIVER_CONTEXT_MISSING');
// A local Simlock worker treats --lease as advisory; after a loss the device may
// already belong to another agent, so no further command reaches it.
if (existsSync(lossMarker)) throw new Error('SIMLOCK_LEASE_LOST');
const env = { ...process.env, PATH: process.env.E2E_SIMLOCK_UNWRAPPED_PATH };
let executable = binary, args;
if (tool === 'xcrun') {
  if (input[0] !== 'simctl') {
    executable = '/usr/bin/xcrun'; args = input;
  } else {
    const rest = input.slice(1);
    if (rest[0] === '--set') {
      if (rest[1] !== process.env.SIMLOCK_IOS_DEVICE_SET) throw new Error('SIMLOCK_FOREIGN_DEVICE_SET');
      rest.splice(0, 2);
    }
    if (rest.includes('--set')) throw new Error('SIMLOCK_FOREIGN_DEVICE_SET');
    if (rest.some(value => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value) && value.toUpperCase() !== device.toUpperCase()))
      throw new Error('SIMLOCK_FOREIGN_DEVICE');
    if (rest[0] !== 'list' && rest.includes('booted')) throw new Error('SIMLOCK_AMBIGUOUS_DEVICE');
    args = ['simctl', '--lease', lease, ...rest];
  }
} else if (tool === 'adb') {
  const rest = [...input];
  if (rest.length === 1 && rest[0] === '--version') rest[0] = 'version';
  let i = 0, hasSerial = false;
  // Only parse ADB's leading transport options. Flags after `shell`, such as
  // `am start -d <url>`, belong to the device command and must remain intact.
  while (i < rest.length && rest[i].startsWith('-')) {
    if (rest[i] === '-P') {
      if (rest[i + 1] !== process.env.ANDROID_ADB_SERVER_PORT) throw new Error('SIMLOCK_FOREIGN_ADB_SERVER');
      rest.splice(i, 2); continue;
    }
    if (['-d', '-e', '-t', '-H', '-L'].includes(rest[i])) throw new Error('SIMLOCK_AMBIGUOUS_DEVICE');
    if (rest[i] !== '-s' || rest[i + 1] !== device || hasSerial) throw new Error('SIMLOCK_FOREIGN_DEVICE');
    hasSerial = true; i += 2;
  }
  if (!hasSerial && !['devices', 'version'].includes(rest[i])) rest.unshift('-s', device);
  args = ['adb', '--lease', lease, ...rest];
} else throw new Error('SIMLOCK_DRIVER_UNKNOWN');
const result = spawnSync(executable, args, { env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? (result.signal ? 1 : 3);
