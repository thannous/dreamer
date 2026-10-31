import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

const [tool, ...input] = process.argv.slice(2);
const binary = process.env.E2E_SIMLOCK_BIN;
const lease = process.env.E2E_SIMLOCK_LEASE_ID;
const device = process.env.E2E_DEVICE;
const endMarker = process.env.E2E_SIMLOCK_END_MARKER;
const holder = process.env.E2E_SIMLOCK_HOLDER_PID;
const runner = process.env.E2E_SIMLOCK_RUNNER_PID;
if (!binary || !lease || !device || !endMarker || !/^\d+$/.test(holder ?? '') || !/^\d+$/.test(runner ?? '')
  || !process.env.E2E_SIMLOCK_UNWRAPPED_PATH) throw new Error('SIMLOCK_DRIVER_CONTEXT_MISSING');
const env = { ...process.env, PATH: process.env.E2E_SIMLOCK_UNWRAPPED_PATH };
// On Android the runner points the SDK variables at a root holding only this shim.
for (const [key, original] of Object.entries({ ANDROID_HOME: process.env.E2E_SIMLOCK_UNWRAPPED_ANDROID_HOME,
  ANDROID_SDK_ROOT: process.env.E2E_SIMLOCK_UNWRAPPED_ANDROID_SDK_ROOT })) {
  if (original) env[key] = original;
  else if (original === '') delete env[key];
}
// A local Simlock worker treats --lease as advisory; once the lease is lost or
// released the device may belong to another agent, so no command reaches it.
if (existsSync(endMarker) || !existsSync(dirname(endMarker))) throw new Error('SIMLOCK_LEASE_ENDED');
// The runner may be blocked in a synchronous command when its holder exits, so
// the marker can lag: the holder must still be this runner's live lease process.
const ps = spawnSync('ps', ['-ww', '-o', 'stat=,command=', '-p', holder], { env, encoding: 'utf8' });
const [state = '', ...command] = ps.status === 0 ? ps.stdout.trim().split(/\s+/) : [];
if (!state || state.startsWith('Z') || !command.includes('lease') || command[command.indexOf('--bind-pid') + 1] !== runner)
  throw new Error('SIMLOCK_LEASE_ENDED');
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
