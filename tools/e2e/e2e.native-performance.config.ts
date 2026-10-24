import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';

const scope = process.env.E2E_PERF_SCOPE ?? 'journal';
if (scope !== 'journal' && scope !== 'main-pages') throw new Error('Unknown native performance scope.');
const platform = process.env.E2E_PERF_PLATFORM;
const device = process.env.E2E_PERF_DEVICE;
if (process.env.E2E_OWNER_NATIVE_PERF_ACK !== 'approved'
  || (platform !== 'android' && platform !== 'ios') || !device
  || !process.env.E2E_OUTPUT) {
  throw new Error('Requires an owner-approved phone, installed Noctalia Release, synthetic journal and private E2E_OUTPUT.');
}

export default {
  projectId: 'noctalia-native-performance',
  tests: scope === 'main-pages' ? [
    'tests/dreamer.main-pages-performance.e2e.ts',
    ...(['200', '5000'].includes(process.env.E2E_PERF_FIXTURE_COUNT ?? '') ? ['tests/dreamer.native-performance.e2e.ts'] : []),
  ] : 'tests/dreamer.native-performance.e2e.ts',
  targets: [{ name: `performance-${platform}`, engine: mobile({ platform, device, session: `noctalia-performance-${platform}` }), app: { bundleId: scope === 'main-pages' ? 'com.tanuki75.noctalia.qa' : 'com.tanuki75.noctalia', environment: 'test' } }],
  workers: 1, retries: 0, timeout: 300_000, assertionTimeout: 20_000, launchTimeout: 180_000,
  output: process.env.E2E_OUTPUT, reporters: ['list', 'markdown', 'junit'],
  trace: 'on', video: 'off', cache: 'off',
} satisfies E2EConfig;
