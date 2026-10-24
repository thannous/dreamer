import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';

if (process.env.E2E_OWNER_IPHONE_DOGFOOD !== 'approved' || !process.env.E2E_IPHONE_DEVICE_NAME) {
  throw new Error('Requires an owner-approved iPhone with the candidate already loaded. No installation or account reset.');
}
export default {
  projectId: 'noctalia-iphone-dogfood',
  tests: 'tests/dreamer.iphone-dogfood.e2e.ts',
  targets: [{ name: 'owner-iphone', engine: mobile({ platform: 'ios', device: process.env.E2E_IPHONE_DEVICE_NAME, session: process.env.E2E_IPHONE_SESSION ?? 'noctalia-iphone-dogfood' }), app: { bundleId: 'com.tanuki75.noctalia', environment: 'test' } }],
  workers: 1, retries: 0, timeout: 300_000, assertionTimeout: 20_000, launchTimeout: 180_000,
  output: process.env.E2E_OUTPUT ?? '.e2e/iphone-dogfood', reporters: ['list', 'markdown', 'junit'], trace: 'on', video: 'off', cache: 'off',
} satisfies E2EConfig;
