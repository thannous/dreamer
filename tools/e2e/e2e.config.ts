import { readFileSync } from 'node:fs';
import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';
import { webEngine, webLocale } from './web-engine';
import { fileURLToPath } from 'node:url';
import { managedAppCommand } from './managed-app';
import { createDreamerPersonaAgents } from './dreamer-personas';

const root = fileURLToPath(new URL('../../', import.meta.url));
const product = process.env.E2E_PRODUCT ?? 'dreamer';
const platform = process.env.E2E_PLATFORM ?? 'web';
const products = ['dreamer', 'lucid', 'meditation', 'site', 'backend'];
if (!products.includes(product) || !['web', 'android', 'ios'].includes(platform))
  throw new Error('Select dreamer|lucid|meditation|site|backend and web|android|ios.');
if (['site', 'backend'].includes(product) && platform !== 'web') throw new Error('Site and backend support web only.');
const native = platform !== 'web';
const personas = process.env.E2E_PERSONAS === '1';
if (process.env.E2E_PERSONAS !== undefined && !['0', '1'].includes(process.env.E2E_PERSONAS))
  throw new Error('E2E_PERSONAS takes 0 or 1.');
if (personas && (product !== 'dreamer' || (!native && webLocale !== 'fr-FR')))
  throw new Error('Personas require Dreamer; web personas also require E2E_WEB_LOCALE=fr-FR.');
const output = process.env.E2E_OUTPUT ?? `.e2e/${product}-${platform}`;
const appLog = `${fileURLToPath(new URL('.', import.meta.url))}${output}/app.log`;
const ports = { dreamer: 8096, lucid: 8097, meditation: 8098, site: 8099, backend: 8085 };
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
// Dreamer/Lucid fingerprint compiled profiles in metro.config.js. Keep transforms
// by default; 0 explicitly requests a cold diagnostic. SDK replay stays disabled.
if (process.env.E2E_KEEP_METRO_CACHE !== undefined && !['0', '1'].includes(process.env.E2E_KEEP_METRO_CACHE))
  throw new Error('E2E_KEEP_METRO_CACHE takes 0 or 1.');
const keepMetroCache = process.env.E2E_KEEP_METRO_CACHE !== '0' && product !== 'meditation';
if (native && (!device || (platform === 'android' && !/^emulator-\d+$/.test(device))))
  throw new Error('Name an explicit emulator/simulator with E2E_DEVICE; physical devices are excluded.');
// run.mjs resolves the web worker count and records it; a native target drives its one device.
const requestedWorkers = process.env.E2E_WORKERS;
if (requestedWorkers !== undefined && (native || !/^[1-9]\d?$/.test(requestedWorkers)))
  throw new Error('E2E_WORKERS takes 1-99 web workers; native runs use one device.');
const workers = Number(requestedWorkers ?? 1);
if (product === 'backend' && workers !== 1) throw new Error('Backend fixtures require one worker.');
if (product === 'backend' && (!process.env.E2E_BACKEND_STATUS_FILE || !process.env.E2E_BACKEND_PROFILE || !process.env.E2E_BACKEND_PASSWORD_FILE))
  throw new Error('Use npm run test:testerarmy:backend to own and guard the backend stack.');
if (personas && workers !== 1) throw new Error('Bound the persona pilot with E2E_WORKERS=1.');
const appRoot = product === 'meditation' ? `${root}apps/meditation` : root;
const managedCommand = !native && product !== 'site'
  ? managedAppCommand(appRoot, product === 'meditation' ? 'web' : product === 'lucid' ? 'start:lucid:mock' : product === 'backend' ? 'start:backend-e2e' : 'start:mock') : null;

export default {
  projectId: `noctalia-${product}`,
  tests: personas ? `tests/dreamer-personas.${native ? 'mobile' : 'web'}.e2e.ts`
    : product === 'backend' ? 'tests/backend*.web.e2e.ts' : product === 'dreamer' && !native ? 'tests/dreamer*.web.e2e.ts' : `tests/${product}.${native ? 'mobile' : 'web'}.e2e.ts`,
  ...(product === 'backend' ? { secrets: { backendPassword: () => readFileSync(process.env.E2E_BACKEND_PASSWORD_FILE!, 'utf8') } } : {}),
  ...(personas ? { agents: createDreamerPersonaAgents(process.env.E2E_PERSONA_MODEL?.trim() || undefined) } : {}),
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
      ...(product !== 'site' ? { readyUrl: `http://127.0.0.1:${port}/status` } : {}),
      // Keep readiness cheap; the repository's Node preview server serves the real
      // images concurrently without Python HTTP/1.0 connection resets on macOS.
      ...(product === 'site' ? { readyUrl: `http://127.0.0.1:${port}/robots.txt` } : {}),
      command: product === 'site' ? {
        executable: process.execPath, args: ['--run', 'serve:docs', '--', '--port=' + port, '--host=127.0.0.1'], cwd: root,
        startupTimeout: 180_000, log: appLog,
      } : {
        executable: managedCommand!.executable,
        args: [...managedCommand!.args, ...(product === 'meditation' ? [] : ['--web']), ...(keepMetroCache ? [] : ['--clear']), '--port', String(port)],
        cwd: appRoot,
        env: {
          ...(appNodeOptions === undefined ? {} : { NODE_OPTIONS: appNodeOptions }),
          // Isolated validation links node_modules from the primary checkout.
          // Metro's lazy URLs cannot resolve those external paths (Markdown WASM);
          // bundle the real modules eagerly so the same journeys work in both trees.
          EXPO_NO_METRO_LAZY: '1',
          ...(product === 'backend' ? { E2E_BACKEND_PROFILE: process.env.E2E_BACKEND_PROFILE! } : {}),
          CI: '1', EXPO_PUBLIC_MOCK_MODE: product === 'backend' ? 'false' : 'true', EXPO_PUBLIC_MOCK_AUDIO: 'true', EXPO_PUBLIC_MOCK_PERSISTENCE: 'true',
          EXPO_PUBLIC_PERFORMANCE_TRACING: process.env.EXPO_PUBLIC_PERFORMANCE_TRACING === 'true' ? 'true' : 'false',
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
  workers, retries: 0, timeout: personas ? 240_000 : product === 'meditation' && !native ? 180_000 : 120_000, assertionTimeout: 30_000,
  launchTimeout: 180_000, output,
  // Every engine writes a trace page per test (results/<test>/trace.md); each pass keeps one as evidence.
  reporters: ['list', 'markdown', 'junit'], trace: 'on', cache: 'off',
  ...(product === 'backend' ? { video: 'on' as const, assertionTimeout: 20_000, actionTimeout: 20_000 } : {}),
} satisfies E2EConfig;
