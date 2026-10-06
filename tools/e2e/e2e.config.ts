import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';
import { webEngine } from './web-engine';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const product = process.env.E2E_PRODUCT ?? 'dreamer';
const platform = process.env.E2E_PLATFORM ?? 'web';
const products = ['dreamer', 'lucid', 'meditation', 'site'];
if (!products.includes(product) || !['web', 'android', 'ios'].includes(platform))
  throw new Error('Select dreamer|lucid|meditation|site and web|android|ios.');
if (product === 'site' && platform !== 'web') throw new Error('The site has no native target.');
const native = platform !== 'web';
const output = process.env.E2E_OUTPUT ?? `.e2e/${product}-${platform}`;
const appLog = `${fileURLToPath(new URL('.', import.meta.url))}${output}/app.log`;
const ports = { dreamer: 8096, lucid: 8097, meditation: 8098, site: 8099 };
const port = Number(!native ? process.env.E2E_WEB_PORT ?? ports[product as keyof typeof ports] : ports[product as keyof typeof ports]);
if (!native && (!Number.isInteger(port) || port < 1 || port > 65535))
  throw new Error('E2E_WEB_PORT must be a valid TCP port.');
const bundles: Record<string, string> = { dreamer: 'com.tanuki75.noctalia', lucid: 'com.tanuki75.noctalia.lucid', meditation: 'com.noctalia.meditation' };
const bundleId = bundles[product];
// Managed app commands inherit only the runner's public environment allowlist.
// Restore the caller's NODE_OPTIONS exactly, including its absence.
const appNodeOptions = process.env.E2E_APP_NODE_OPTIONS_PRESENT === undefined
  ? process.env.NODE_OPTIONS
  : process.env.E2E_APP_NODE_OPTIONS_PRESENT === '1' ? process.env.E2E_APP_NODE_OPTIONS! : undefined;
const device = process.env.E2E_DEVICE;
if (native && (!device || (platform === 'android' && !/^emulator-\d+$/.test(device))))
  throw new Error('Name an explicit emulator/simulator with E2E_DEVICE; physical devices are excluded.');

export default {
  projectId: `noctalia-${product}`,
  tests: product === 'dreamer' && !native ? 'tests/dreamer*.web.e2e.ts' : `tests/${product}.${native ? 'mobile' : 'web'}.e2e.ts`,
  targets: [{
    name: `${product}-${platform}`,
    engine: native
      ? mobile({ platform: platform as 'android' | 'ios', device, videoTouches: false })
      : webEngine,
    app: native ? { bundleId, environment: 'test' as const } : {
      url: `http://127.0.0.1:${port}`,
      environment: 'test' as const,
      // Static Expo routes compile during the first request; probe Metro without
      // repeatedly starting SSR bundles. app.open() and the journey verify the UI.
      ...(product === 'meditation' ? { readyUrl: `http://127.0.0.1:${port}/status` } : {}),
      command: product === 'site' ? {
        executable: 'python3', args: ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', 'docs'], cwd: root,
        startupTimeout: 180_000, log: appLog,
      } : {
        executable: 'npm',
        args: ['run', product === 'meditation' ? 'web' : product === 'lucid' ? 'start:lucid:mock' : 'start:mock', '--', ...(product === 'meditation' ? [] : ['--web']), '--clear', '--port', String(port)],
        cwd: product === 'meditation' ? `${root}apps/meditation` : root,
        env: {
          ...(appNodeOptions === undefined ? {} : { NODE_OPTIONS: appNodeOptions }),
          CI: '1', EXPO_PUBLIC_MOCK_MODE: 'true', EXPO_PUBLIC_MOCK_AUDIO: 'true', EXPO_PUBLIC_MOCK_PERSISTENCE: 'true',
          ...(product === 'meditation' ? {} : {
            NOCTALIA_APP_VARIANT: product === 'lucid' ? 'lucid' : 'noctalia',
            EXPO_PUBLIC_APP_VARIANT: product === 'lucid' ? 'lucid' : 'noctalia',
          }),
          ...(product === 'dreamer' ? {
            EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED: process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true' ? 'true' : 'false',
          } : {}),
        },
        startupTimeout: 180_000, log: appLog,
      },
    },
  }],
  // app.open/restart use config.timeout, capped by the remaining test budget.
  workers: 1, retries: 0, timeout: product === 'meditation' && !native ? 180_000 : 120_000, assertionTimeout: 30_000,
  launchTimeout: 180_000, output,
  reporters: ['list', 'markdown', 'junit'], trace: native ? 'off' : 'on', cache: 'off',
} satisfies E2EConfig;
