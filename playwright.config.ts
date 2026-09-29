import { defineConfig, devices } from 'playwright/test';
import { execFileSync } from 'node:child_process';

export default defineConfig({
  metadata: {
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    environment: 'local Expo web; mock auth/subscription/AI; persisted preferences; in-memory dreams',
    personas: 'guest; new free; exhausted existing free; plus',
  },
  testDir: './e2e/web',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results/e2e-web',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/e2e-web-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/e2e-web-junit/results.xml', includeProjectInTestName: true }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:8084',
    locale: 'en-US',
    serviceWorkers: 'block',
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run start:mock -- --web --port 8084',
    // Keep onboarding/preferences across mock account switches. Dreams stay in memory.
    env: { EXPO_PUBLIC_MOCK_PERSISTENCE: 'true' },
    // Wait for Metro's cold bundle compilation before starting timed UI journeys.
    url: 'http://127.0.0.1:8084/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&transform.reactCompiler=true&unstable_transformProfile=hermes-stable',
    reuseExistingServer: process.env.E2E_REUSE_SERVER === '1' && !process.env.CI,
    timeout: 120_000,
  },
});
