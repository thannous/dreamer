import { defineConfig, devices } from 'playwright/test';
import { execFileSync } from 'node:child_process';

// Real-backend web journeys against the persistent Supabase test branch
// (doc_web_interne/docs/test-login.md). Optional and opt-in: npm run
// test:e2e:branch. The default mock suite (playwright.config.ts) and the local
// backend suite (playwright.backend.config.ts) are unchanged.
// The guard runs in the setup project (npm run test:auth-setup) and in the web
// server (scripts/start-branch-e2e.mjs): production and unlisted projects are
// refused before any request. Port 8087 must match BRANCH_WEB_PORT in
// scripts/test-auth-setup.mjs, the origin of the saved sessions.
const port = 8087;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  metadata: {
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    environment: 'Expo web against the persistent Supabase test branch; sessions from npm run test:auth-setup',
    fixtures: 'shared e2e+free@ and e2e+premium@ accounts (npm run test:seed-users)',
  },
  testDir: './e2e/branch',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  outputDir: 'test-results/e2e-branch',
  reporter: [['list'], ['html', { outputFolder: 'test-results/e2e-branch-report', open: 'never' }]],
  // No traces: they would record the session tokens.
  use: { baseURL, locale: 'en-US', serviceWorkers: 'block', trace: 'off', video: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'auth-setup', testMatch: /auth\.setup\.ts$/ },
    { name: 'chromium-branch', testIgnore: /auth\.setup\.ts$/, dependencies: ['auth-setup'], use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `node ./scripts/start-branch-e2e.mjs --web --port ${port}`,
    url: `${baseURL}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&transform.reactCompiler=true&unstable_transformProfile=hermes-stable`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
