// Checks of the common delivery rule v2 for this repository, read by
// scripts/verify-local.mjs. The engine and its tests are identical in the five
// repositories: never edit them here alone. This file is data only (no imports).
//
//   npm run verify:pr       before a merge: the former pre-push `verify:fast`, split
//                           into checks, plus the surfaces the PR changed.
//   npm run verify:release  before a publish: the PR checks (reused when they passed
//                           on the same tree) plus the full local validation of
//                           doc_web_interne/docs/circleci-migration.md.
//
// A check without `when` is reused by a later PR run whose inputs are identical,
// and by a release only when it passed on the same tree (a squash of an
// up-to-date branch reuses everything). A `when` check runs only
// when the commit changes those paths since origin/master, like the CircleCI
// affected portfolio; on the published master commit nothing changed, so a
// surface a release always needs carries releaseAlways (the PR's result is
// reused when it passed on the same tree), and the release-only checks at the
// end carry the rest of the full portfolio.

// Markdown and planning documents feed no compiler and no linter.
const DOCS = ['**/*.md', '**/*.mdx', 'doc_web_interne/**', 'marketing/**', 'specs/**'];

// A superset of what .circleci/scripts/classify-changes.sh routes to the site.
const SITE = ['docs-src/', 'data/', 'scripts/', 'package.json', 'package-lock.json', '.nvmrc'];

// apps/meditation and the shared files .circleci/dependency-consumers.tsv routes to it.
const MEDITATION = [
  'apps/meditation/',
  '.nvmrc',
  'release/mobile-versions.json',
  'scripts/mobile-release.js',
  'scripts/android-device-lock.js',
  'scripts/check-monorepo-boundaries*.js',
  'scripts/check-brand-tokens.js',
];

// Deno runtime sources; the Edge tests also read supabase/migrations.
const EDGE = ['supabase/functions/', 'supabase/lib/', 'supabase/migrations/', 'deno.lock'];

const CI_CONTRACTS = [
  'bash .circleci/tests/classify-changes.test.sh',
  'python3 .circleci/tests/shared-build-impact.test.py',
  'bash .circleci/tests/fallback-jest.test.sh',
].join(' && ');

// Jobs edge-contracts and edge-functions (PGlite) of .circleci/continue.yml.
// These tests read migrations and routes as files, so Jest's related-test
// selection (jest-changed) never picks them.
const DB_CONTRACTS = [
  'npm run test:file --',
  'scripts/check-db-contract.test.js',
  'scripts/dream-images-auth-user-policy-migration.test.js',
  'scripts/guest-chat-route-contract.test.js',
  'scripts/guest-qa-passport-migration.test.js',
  'scripts/interpretation-entitlement-migration.test.js',
  'scripts/product-analytics-migration.test.js',
  'scripts/product-analytics-schema-parity.test.js',
  '&& npm run test:analysis-authorization:db',
].join(' ');

// Job meditation-quality. The engine links apps/meditation/node_modules from the
// main checkout; when the verified lockfile differs, the copy installs its own.
const MEDITATION_CHECKS = [
  'node scripts/check-monorepo-boundaries.js --meditation',
  'cd apps/meditation',
  '{ cmp -s package-lock.json "$VERIFY_LOCAL_ROOT/apps/meditation/package-lock.json"'
    + ' || { rm -rf node_modules && npm ci --prefer-offline --no-audit --no-fund; }; }',
  'EXPO_OFFLINE=1 npm run dependencies:check',
  'npm run typecheck',
  'npm run lint',
  'npm test -- --ci',
].join(' && ');
const MEDITATION_DEPS = {
  command: 'test -d apps/meditation/node_modules',
  hint: 'install Meditation in the main checkout first: (cd apps/meditation && npm ci)',
};

// Job edge-functions (lint runs in `lint`, PGlite in db-contracts).
const EDGE_CHECKS = [
  'cd supabase/functions',
  'deno check --frozen api/index.ts analysis-job-worker/index.ts image-job-worker/index.ts revenuecat-webhook/index.ts',
  'deno test --frozen --allow-env --allow-net=deno.land --allow-read=../migrations api revenuecat-webhook',
].join(' && ');
const DENO = {
  command: 'deno --version',
  hint: 'install Deno 2.7.14 (`mise install`), or run the Edge checks in a manual CircleCI pipeline and pass --external <check>="<pipeline> on <SHA>"',
};

const TESTERARMY = {
  command: 'test -d tools/e2e/node_modules/@e2e-dev/web',
  hint: 'run `npm run test:testerarmy:setup && npm run test:testerarmy:browsers` in the main checkout, or pass --external <check>="<manual CircleCI pipeline> on <SHA>"',
};

// The four passes of tools/e2e/README.md that jointly qualify every Dreamer case.
const DREAMER_PASSES = [
  'EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_LOCALE=en-US node tools/e2e/run.mjs dreamer web run',
  'EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_LOCALE=fr-FR node tools/e2e/run.mjs dreamer web run --tag locale-fr-FR',
  'EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_LOCALE=de-DE node tools/e2e/run.mjs dreamer web run --tag locale-de-DE',
  "EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=false E2E_WEB_LOCALE=en-US node tools/e2e/run.mjs dreamer web run --grep 'feature sheets stay disabled by default'",
].join(' && ');

export default {
  mainBranch: 'master',
  commands: { pr: 'npm run verify:pr', release: 'npm run verify:release' },
  deps: {
    // Measured (Q10): linking the main checkout's node_modules takes under a
    // second; `npm ci` in the copy takes about 70 s and 1.8 GB.
    mode: 'link',
    lockfile: 'package-lock.json',
    install: 'npm ci --prefer-offline --no-audit --no-fund',
    copy: [],
  },
  setup: [],
  // The scripts these checks run: changing them changes what a proof proves,
  // so proof-block flags them for the owner's review like this file.
  deliveryFiles: [
    'scripts/install-git-hooks.js',
    'scripts/run-jest-changed.js',
  ],
  checks: [
    // ---- verify:pr, reused by verify:release when the inputs are identical.
    {
      name: 'verify-local-engine',
      command: 'node --test scripts/test-verify-local.mjs',
      inputs: ['scripts/verify-local.mjs', 'scripts/test-verify-local.mjs'],
    },
    { name: 'typecheck-app', command: 'npm run typecheck:app', exclude: DOCS },
    { name: 'typecheck-tests', command: 'npm run typecheck:tests', exclude: DOCS },
    { name: 'lint', command: 'npm run lint', exclude: DOCS },
    { name: 'lint-scripts', command: 'npm run lint:scripts', exclude: DOCS },
    // Root Jest tests related to the files changed since the merge-base with
    // origin/master (scripts/run-jest-changed.js). Whole tree: tests read files.
    // Picks its tests from the diff: reused only against the same merge base.
    // JEST_CHANGED_SINCE would override that base (HEAD selects no test), so
    // the check never inherits it.
    {
      name: 'jest-changed',
      perBase: true,
      command: 'npm run test:changed -- --runInBand --watchman=false',
      env: { JEST_CHANGED_SINCE: '' },
    },
    { name: 'db-contracts', command: DB_CONTRACTS },

    // ---- verify:pr, only when the commit changes that surface since origin/master.
    { name: 'site', command: 'npm run docs:build && npm run docs:check', when: SITE },
    { name: 'ci-contracts', command: CI_CONTRACTS, when: ['.circleci/'] },
    { name: 'meditation', command: MEDITATION_CHECKS, when: MEDITATION, releaseAlways: true, requires: MEDITATION_DEPS },
    { name: 'edge-functions', command: EDGE_CHECKS, when: EDGE, releaseAlways: true, specialised: true, requires: DENO },

    // ---- verify:release only: the full local validation, then the delivered builds.
    {
      name: 'release-contracts',
      command: `EXPO_OFFLINE=1 npm run dependencies:check && npm run boundaries:check && node scripts/mobile-release.js verify --app all && ${CI_CONTRACTS}`,
      kinds: ['release'],
    },
    { name: 'jest-full', command: 'npm run test:fast', kinds: ['release'] },
    // noctalia.app (Cloudflare Pages) and the Vercel web app, rebuilt for the delivered commit.
    { name: 'site-build', command: 'npm run docs:build && npm run docs:check', kinds: ['release'], perCommit: true },
    { name: 'web-build', command: 'npm run build:web', kinds: ['release'], perCommit: true },
    {
      name: 'e2e-backend',
      command: 'npm run test:e2e:backend',
      kinds: ['release'],
      specialised: true,
      requires: {
        command: 'docker info',
        hint: 'start Docker (disposable local Supabase) and install Chromium (`npx playwright install chromium`), or pass --external e2e-backend="<manual CircleCI pipeline> on <SHA>"',
      },
    },
    {
      name: 'testerarmy-tooling',
      command: 'npm run test:testerarmy:typecheck && npm run test:testerarmy:guards',
      kinds: ['release'],
      specialised: true,
      requires: TESTERARMY,
    },
    {
      name: 'testerarmy-site',
      command: 'npm run docs:build && npm run test:testerarmy:site',
      kinds: ['release'],
      specialised: true,
      requires: TESTERARMY,
    },
    { name: 'testerarmy-dreamer', command: DREAMER_PASSES, kinds: ['release'], specialised: true, requires: TESTERARMY },
    { name: 'testerarmy-lucid', command: 'npm run test:testerarmy:lucid', kinds: ['release'], specialised: true, requires: TESTERARMY },
    {
      name: 'testerarmy-meditation',
      command: 'npm run test:testerarmy:meditation',
      kinds: ['release'],
      specialised: true,
      requires: { command: `${TESTERARMY.command} && ${MEDITATION_DEPS.command}`, hint: `${TESTERARMY.hint}; ${MEDITATION_DEPS.hint}` },
    },
  ],
  hook: {
    // Tracked runtime profiles: EXPO_PUBLIC_* values and publishable keys only.
    allow: ['.env.lucid', '.env.lucid.mock', '.env.lucid.teststore', '.env.mock', '.env.playstore', '.env.teststore'],
    // PEM parsers that strip the header of a key read from the environment.
    secretAllow: ['supabase/functions/api/lib/appleTokenRevoke.ts', 'supabase/functions/api/lib/playIntegrity.ts'],
    checks: [],
  },
};
