import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';
import { web } from '@e2e-dev/web';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const product = process.env.E2E_PRODUCT ?? 'dreamer';
const platform = process.env.E2E_PLATFORM ?? 'web';
const products = ['dreamer', 'lucid', 'meditation', 'site'];
if (!products.includes(product) || !['web', 'android', 'ios'].includes(platform))
  throw new Error('Select dreamer|lucid|meditation|site and web|android|ios.');
if (product === 'site' && platform !== 'web') throw new Error('The site has no native target.');
const native = platform !== 'web';
const ports = { dreamer: 8096, lucid: 8097, meditation: 8098, site: 8099 };
const port = ports[product as keyof typeof ports];
const bundles: Record<string, string> = { dreamer: 'com.tanuki75.noctalia', lucid: 'com.tanuki75.noctalia.lucid', meditation: 'com.noctalia.meditation' };
const bundleId = bundles[product];
const device = process.env.E2E_DEVICE;
if (native && (!device || (platform === 'android' && !/^emulator-\d+$/.test(device))))
  throw new Error('Name an explicit emulator/simulator with E2E_DEVICE; physical devices are excluded.');

export default {
  projectId: `noctalia-${product}`,
  tests: `tests/${product}.${native ? 'mobile' : 'web'}.e2e.ts`,
  targets: [{
    name: `${product}-${platform}`,
    engine: native
      ? mobile({ platform: platform as 'android' | 'ios', device, videoTouches: false })
      : web({ viewport: { width: 390, height: 844 }, locale: product === 'lucid' ? 'fr-FR' : 'en-US' }),
    app: native ? { bundleId, environment: 'test' as const } : {
      url: `http://127.0.0.1:${port}`,
      environment: 'test' as const,
      command: product === 'site' ? {
        executable: 'python3', args: ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', 'docs'], cwd: root,
        startupTimeout: 180_000, log: `.e2e/${product}-${platform}/app.log`,
      } : {
        executable: 'npm',
        args: ['run', product === 'meditation' ? 'web' : product === 'lucid' ? 'start:lucid:mock' : 'start:mock', '--', ...(product === 'meditation' ? [] : ['--web']), '--port', String(port)],
        cwd: product === 'meditation' ? `${root}apps/meditation` : root,
        env: { CI: '1', EXPO_PUBLIC_MOCK_MODE: 'true', EXPO_PUBLIC_MOCK_AUDIO: 'true', EXPO_PUBLIC_MOCK_PERSISTENCE: 'true' },
        startupTimeout: 180_000, log: `.e2e/${product}-${platform}/app.log`,
      },
    },
  }],
  workers: 1, retries: 0, timeout: 120_000, assertionTimeout: 30_000,
  launchTimeout: 180_000, output: process.env.E2E_OUTPUT ?? `.e2e/${product}-${platform}`,
  reporters: ['list', 'markdown', 'junit'], trace: native ? 'off' : 'on', cache: 'off',
} satisfies E2EConfig;
