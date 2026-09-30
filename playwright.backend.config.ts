import { defineConfig, devices } from 'playwright/test';
import { execFileSync } from 'node:child_process';

if (!process.env.E2E_BACKEND_STATUS_FILE || !process.env.E2E_BACKEND_PROFILE) {
  throw new Error('Use npm run test:e2e:backend to prepare the isolated backend and Expo profile');
}

export default defineConfig({
  metadata: {
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    environment: 'local Supabase Auth/Postgres/PostgREST; real storage; no external AI or payments',
    fixtures: 'unique disposable free, second free and server-owned Plus accounts per test',
    rerun: 'npm run test:e2e:backend',
  },
  testDir: './e2e/backend',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  outputDir: 'test-results/e2e-backend',
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/e2e-backend-results.json' }],
    ['html', { outputFolder: 'test-results/e2e-backend-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/e2e-backend-junit/results.xml' }],
  ],
  // Videos + machine-readable assertions prove the journey without recording Auth JWTs in network traces.
  use: { baseURL: 'http://127.0.0.1:8085', locale: 'en-US', serviceWorkers: 'block', actionTimeout: 20_000, trace: 'off', video: 'on', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium-real-backend', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run start:backend-e2e -- --web --port 8085',
    url: 'http://127.0.0.1:8085/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&transform.reactCompiler=true&unstable_transformProfile=hermes-stable',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
