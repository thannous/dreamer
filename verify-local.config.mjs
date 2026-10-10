// Checks of the common delivery rule for this repository, read by
// scripts/verify-local.mjs. The rule is this repository's own copy,
// doc_web_interne/docs/regle-commune-livraison.md; what is specific to dreamer
// is in AGENTS.md, "Notes dreamer". The engine and its tests are this repository's own
// copy: each repository pins its own ENGINE_SHA256 (below) and verifies it
// locally; an engine fix is worth porting to the others, but nothing checks
// that across repositories. This file is data only (no imports).
//
//   npm run verify:pr       before every push: the former pre-push `verify:fast`, split
//                           into checks, plus the surfaces the PR changed.
//   npm run verify:release  before a publish: the PR checks, run again, plus the
//                           full local validation of
//                           doc_web_interne/docs/circleci-migration.md.
//
// A check without `when` is reused by a later PR run whose inputs are identical;
// a release reuses nothing. A `when` check runs only
// when the commit changes those paths since origin/master, like the CircleCI
// affected portfolio; on the published master commit nothing changed, so a
// surface a release always needs carries releaseAlways, and the release-only
// checks at the end carry the rest of the full portfolio.

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

// What `node scripts/mobile-release.js verify` reads: the pins of
// release/mobile-versions.json against the app manifests and EAS profiles.
const MOBILE_VERSIONS = [
  'release/',
  'scripts/mobile-release.js',
  'app.json',
  'package.json',
  'package-lock.json',
  'eas.json',
  'apps/meditation/app.json',
  'apps/meditation/package.json',
  'apps/meditation/package-lock.json',
  'apps/meditation/eas.json',
];

// Deno runtime sources; the Edge tests also read supabase/migrations.
const EDGE = ['supabase/functions/', 'supabase/lib/', 'supabase/migrations/', 'deno.lock'];

// The EAS workflow contracts. These suites read .eas/workflows and eas.json as
// files, so Jest's related-test selection (jest-changed) never picks them when
// only a workflow changes.
const EAS_WORKFLOWS = ['.eas/workflows/', 'eas.json', 'scripts/check-android-release-ref.js', 'scripts/check-android-release-gates.js'];
const EAS_WORKFLOW_CONTRACTS = [
  'npm run test:file --',
  'scripts/android-release-smoke-workflow.test.js',
  'scripts/check-android-release-ref.test.js',
  'scripts/check-android-release-gates.test.js',
].join(' ');

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
  hint: 'run it locally where you run verify:pr (Deno 2.7.14: `mise install`); if this machine cannot, pass --external <check>="owner-machine: <host> <note> on <SHA>" from the machine that ran it, or say so in the PR',
};

const TESTERARMY = {
  command: 'test -d tools/e2e/node_modules/@e2e-dev/web',
  hint: 'run it locally where you run verify:pr (after `npm run test:testerarmy:setup && npm run test:testerarmy:browsers` in the main checkout); if this machine cannot, pass --external <check>="owner-machine: <host> <note> on <SHA>" from the machine that ran it, or say so in the PR',
};

// The four passes of tools/e2e/README.md that jointly qualify every Dreamer case.
const DREAMER_PASSES = [
  'EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_LOCALE=en-US node tools/e2e/run.mjs dreamer web run',
  'EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_LOCALE=fr-FR node tools/e2e/run.mjs dreamer web run --tag locale-fr-FR',
  'EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_LOCALE=de-DE node tools/e2e/run.mjs dreamer web run --tag locale-de-DE',
  "EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=false E2E_WEB_LOCALE=en-US node tools/e2e/run.mjs dreamer web run --grep 'feature sheets stay disabled by default'",
].join(' && ');

// sha256 of this repository's own copy of scripts/verify-local.mjs. The engine
// tests compare the file with it, so an engine edit is a deliberate change of
// this pin. No other repository is read or compared.
export const ENGINE_SHA256 =
  'bcb521d64c7e1cc8872784b50c8101a7614dadee19c89a395e09d04ec231d7b2';

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
  // https:// URL prefixes of the external CI runs --external may cite. None
  // here, so only owner-machine evidence counts.
  externalSources: [],
  // The scripts these checks run: changing them changes what a proof proves,
  // so proof-block flags them for the owner's review like this file.
  deliveryFiles: [
    'scripts/install-git-hooks.js',
    'scripts/run-jest-changed.js',
    // Meditation's Jest module resolution.
    'apps/meditation/tests/jestResolver.cjs',
    // The contract checkers and runners the checks call, and the tests of
    // this config and of the hook.
    'scripts/check-brand-tokens.js',
    'scripts/check-monorepo-boundaries*.js',
    'scripts/docs-check.js',
    'scripts/mobile-release.js',
    'scripts/verify-analysis-authorization.mjs',
    'scripts/run-backend-e2e.cjs',
    'tools/e2e/run.mjs',
    'scripts/verify-local-config.test.js',
    'scripts/pre-push-hook.test.js',
    // The EAS workflows and their config: any edit needs the owner's review
    // (the release gate only catches honest mistakes).
    '.eas/workflows/**',
    'eas.json',
    // The release guards eas-workflow-contracts tests, and its suites.
    'scripts/check-android-release-ref.js',
    'scripts/check-android-release-gates.js',
    'scripts/android-release-smoke-workflow.test.js',
    'scripts/check-android-release-ref.test.js',
    'scripts/check-android-release-gates.test.js',
    // The noctalia.app production publish and its guard (site-publish-guard).
    'scripts/docs-deploy.js',
    'scripts/docs-deploy.test.ts',
    // The Cloudflare Pages project, production and preview branches docs-deploy.js reads.
    'docs-src/config/cloudflare-pages.json',
    'scripts/check-site-publish-proof.mjs',
    'scripts/test-check-site-publish-proof.mjs',
    // The Vercel web app production publish (web:deploy:prod), same guard.
    'scripts/web-deploy.js',
    'scripts/web-deploy.test.ts',
    // The Vercel project config the CLI deploy reads, and its ignored-build step.
    'vercel.json',
    'scripts/vercel-ignore-build.mjs',
    // The shared test-login guard (test-supabase-guard): production refused,
    // test projects allowlisted, fail closed.
    'scripts/test-supabase-guard.mjs',
    'scripts/test-test-supabase-guard.mjs',
    'scripts/test-supabase-targets.json',
    '.env.test.example',
    // The seed, the API login and the guarded Expo start that use it.
    'scripts/test-seed-users.mjs',
    'scripts/test-auth-setup.mjs',
    'scripts/start-branch-e2e.mjs',
    'scripts/maestro-branch-sign-in.mjs',
    'scripts/test-test-seed-auth.mjs',
    // The Expo runner re-checks a guarded branch run (marker from start-branch-e2e).
    'scripts/expo-safe-runner.js',
    'scripts/expo-safe-runner.test.js',
    'playwright.branch.config.ts',
    // The suites ci-contracts runs.
    '.circleci/tests/classify-changes.test.sh',
    '.circleci/tests/shared-build-impact.test.py',
    '.circleci/tests/fallback-jest.test.sh',
  ],
  checks: [
    // ---- verify:pr, reused by verify:release when the inputs are identical.
    {
      name: 'verify-local-engine',
      command: 'node --test scripts/test-verify-local.mjs',
      inputs: ['scripts/verify-local.mjs', 'scripts/test-verify-local.mjs', 'verify-local.config.mjs'],
    },
    // The production publish guard of noctalia.app (docs:deploy:prod) against
    // proofs written by this engine in scratch repositories.
    // Also the two production publishes that await it (docs:deploy:prod,
    // web:deploy:prod), whose tests mock the guard.
    {
      name: 'site-publish-guard',
      command: 'node --test scripts/test-check-site-publish-proof.mjs && npm run test:file -- scripts/docs-deploy.test.ts scripts/web-deploy.test.ts',
      inputs: [
        'scripts/check-site-publish-proof.mjs',
        'scripts/test-check-site-publish-proof.mjs',
        'scripts/verify-local.mjs',
        'verify-local.config.mjs',
        'scripts/docs-deploy.js',
        'scripts/docs-deploy.test.ts',
        'scripts/web-deploy.js',
        'scripts/web-deploy.test.ts',
        'package.json',
        // web-deploy.test.ts checks the vercel@62.2.0 lock entry.
        'package-lock.json',
        'vercel.json',
        'scripts/vercel-ignore-build.mjs',
        // docs-deploy.test.ts reads the real Cloudflare Pages config.
        'docs-src/config/cloudflare-pages.json',
      ],
    },
    // The test-login guard: refuses the production Supabase project and any
    // project missing from the allowlist, before any network call.
    {
      name: 'test-supabase-guard',
      command: 'node --test scripts/test-test-supabase-guard.mjs scripts/test-test-seed-auth.mjs && npm run test:file -- scripts/expo-safe-runner.test.js',
      inputs: [
        'scripts/test-supabase-guard.mjs',
        'scripts/test-test-supabase-guard.mjs',
        'scripts/test-supabase-targets.json',
        'scripts/test-seed-users.mjs',
        'scripts/test-auth-setup.mjs',
        'scripts/start-branch-e2e.mjs',
        'scripts/test-test-seed-auth.mjs',
        // The static test scans every script in scripts/.
        'scripts/**',
        // The seed mirrors this fixture's RPC call; the web origin is pinned here.
        'e2e/backend/fixtures.ts',
        'supabase/migrations/20260916185856_hd_illustration_monthly_quota.sql',
        'supabase/migrations/20260316130000_add_dream_sync_revisions.sql',
        'supabase/migrations/20260722124500_add_ai_sync_admission_control.sql',
        'supabase/functions/api/services/aiAdmission.ts',
        'supabase/functions/api/services/storage.ts',
        'maestro/e2e-account-sign-in.yml',
        'maestro/subflows/**',
        'playwright.branch.config.ts',
        '.gitignore',
        // The production ref is pinned against app.json.
        'app.json',
      ],
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
    { name: 'eas-workflow-contracts', command: EAS_WORKFLOW_CONTRACTS, when: EAS_WORKFLOWS },
    // A bad version pin fails before push rather than at publication (offline, 0.1 s).
    { name: 'mobile-versions', command: 'node scripts/mobile-release.js verify --app all', inputs: MOBILE_VERSIONS, when: MOBILE_VERSIONS },
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
        hint: 'run it locally where you run verify:pr (Docker for the disposable local Supabase, Chromium via `npx playwright install chromium`); if this machine cannot, pass --external e2e-backend="owner-machine: <host> <note> on <SHA>" from the machine that ran it, or say so in the PR',
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
