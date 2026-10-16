import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';
if (process.env.E2E_OWNER_IPHONE_SANDBOX_ACK !== 'OWNER_APPROVED_APPLE_SANDBOX'
  || process.env.EXPO_PUBLIC_MOCK_MODE !== 'false'
  || !process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.startsWith('appl_')
  || !process.env.E2E_IPHONE_DEVICE_NAME) {
  throw new Error('Requires this owner-approved physical iPhone, real Apple SDK and sandbox preflight.');
}
export default {
  projectId: 'noctalia-owner-iphone-apple-sandbox',
  tests: 'tests/dreamer.iphone-sandbox.e2e.ts',
  targets: [{ name: 'owner-iphone-sandbox', engine: mobile({ platform: 'ios', device: process.env.E2E_IPHONE_DEVICE_NAME, session: 'noctalia-owner-sandbox' }), app: { bundleId: 'com.tanuki75.noctalia', environment: 'test' } }],
  workers: 1, retries: 0, timeout: 900_000, assertionTimeout: 45_000, launchTimeout: 180_000,
  output: process.env.E2E_OUTPUT!, reporters: ['list', 'markdown', 'junit'], trace: 'on', video: 'off', cache: 'off',
} satisfies E2EConfig;
