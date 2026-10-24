// Checks of the common delivery rule for this repository, read by
// scripts/verify-local.mjs. The rule is this repository's own copy,
// doc_web_interne/docs/regle-commune-livraison.md; what is specific to dreamer
// is in AGENTS.md, "Notes dreamer". The engine and its tests are this repository's own
// copy: each repository pins its own ENGINE_SHA256 (below) and verifies it
// locally; an engine fix is worth porting to the others, but nothing checks
// that across repositories. This file is standalone data; the verifier copies it outside the checkout.
//
//   npm run verify:pr       before every push: the former pre-push `verify:fast`, split
//                           into checks, plus the surfaces the PR changed.
//   npm run verify:release  before a publish: the PR checks, run again, plus the
//                           full local validation of
//                           doc_web_interne/docs/circleci-migration.md
//                           (`release --target app`). The web app and mobile
//                           releases need it.
//   npm run verify:release:site
//                           before a noctalia.app publish only: the same run
//                           without the checks of the `app` target (the web
//                           app build, its native backend journey and
//                           the TesterArmy app campaigns), which the static
//                           site does not ship.
//
// A check without `when` is reused by a later PR run whose inputs are identical;
// a release reuses nothing. A `when` check runs only
// when the commit changes those paths since origin/master; on the published
// master commit nothing changed, so a
// surface a release always needs carries releaseAlways, and the release-only
// checks at the end carry the rest of the full portfolio.

// Markdown and planning documents feed no compiler and no linter.
const DOCS = ['**/*.md', '**/*.mdx', 'doc_web_interne/**', 'marketing/**', 'specs/**'];

// Site-only sources and the TesterArmy journeys: tsc (no allowJs; tools/e2e is
// excluded from tsconfig.json) and the lint paths of package.json never read
// them, and no TypeScript file imports them. The site check and the TesterArmy
// typecheck cover them. docs-src/static/img and docs-src/static/data stay
// inputs (app components and TesterArmy journeys import them), like data/.
const SITE_ONLY = [
  'docs-src/static/scripts/**',
  'docs-src/static/js/**',
  'docs-src/static/css/**',
  'docs-src/templates/**',
  'docs-src/locales/**',
  'docs-src/experience/**',
  'tools/e2e/tests/**',
];

// A scope that takes everything but these globs (see `when` in the engine).
const not = (globs) => globs.map((glob) => `!${glob}`);

// What the two tsc programs (tsconfig.json, tsconfig.test.json) can read: the
// TypeScript sources their include patterns take, everything under tests/
// (tsconfig.test.json takes tests/**/*), the JSON their sources import, the
// tsconfigs, package.json and package-lock.json (the installed types), the
// route files the type generator lists, and the scripts of the command. No
// asset, document, site page or site data: a PR changing only those skips
// both typechecks. scripts/verify-local-config.test.js lists both programs and
// checks that every tracked file they read is in this scope.
const TYPESCRIPT = [
  '**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.json', 'tests/', 'app/', 'routes/',
  'scripts/generate-shared-route-types.cjs', 'scripts/lib/replace-file.cjs', 'scripts/verify-cache.mjs',
  // tsconfig.json leaves these out; tests import one file of supabase/functions.
  '!apps/', '!tools/e2e/', '!outputs/', '!supabase/functions/', 'supabase/functions/api/lib/fullMoon.ts',
  // Site and repository data no source imports.
  '!docs-src/**/*.json', 'docs-src/static/data/curation-pages.json', '!data/**/*.json', 'data/app/',
  ...not(DOCS),
];

// What `lint` can read: the files of its targets and everything they import,
// assets included (import/no-unresolved checks that they exist), the ESLint,
// TypeScript and Babel settings, the packages, and what brand:check compares.
// No linted file imports a document, a site-only source, a migration or a CI
// or EAS workflow: scripts/verify-local-config.test.js checks it on the
// import graph scripts/check-lint-warnings.js reads.
const LINT = ['**', ...not(DOCS), ...not(SITE_ONLY), '!supabase/migrations/', '!.circleci/', '!.eas/'];

// What `lint-scripts` (expo lint scripts) can read: scripts/, the files
// outside it that scripts import (and those they re-export), and the ESLint
// settings and packages. The same test checks the import graph against this
// list; that graph keys app.json and app/index.tsx alike, hence the latter.
const LINT_SCRIPTS = [
  'scripts/', 'eslint.config.js', 'package.json', 'package-lock.json', 'tsconfig.json', 'babel.config.js', 'jest.config.js',
  'app.config.ts', 'app.json', 'apps/meditation/app.json', 'apps/meditation/app/index.tsx', 'apps/site/dependencies.js',
  'context/DreamsContext.tsx', 'context/ThemeContext.tsx', 'lib/types.ts', 'lib/journalSyncContracts.ts',
  'services/storageService.ts', 'services/supabaseDreamService.ts', 'data/site-manifest.json',
  'docs-src/config/cloudflare-pages.json', 'plugins/', 'tools/e2e/qualification.mjs',
];

// What jest-changed can select tests from: a module or a snapshot under a
// root of one of the Jest projects (Jest leaves out a changed file outside
// its haste map), and the Jest and Babel settings and the packages, whose
// breakage fails the run before any test. The same test checks the roots and
// extensions against jest.config.js.
const JEST_ROOTS = ['app', 'components', 'constants', 'context', 'hooks', 'lib', 'services', 'tests', 'scripts'];
const JEST_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'json', 'node', 'snap'];
const JEST = [
  ...JEST_ROOTS.flatMap((root) => JEST_EXTENSIONS.map((extension) => `${root}/**/*.${extension}`)),
  'jest.config*.js', 'jest.setup.ts', 'babel.config.js', 'package.json', 'package-lock.json',
];

// What `docs:build` and `docs:check` read: every tracked file they opened,
// traced with strace on master 3cd790554, plus the scripts their require graph
// reaches on other paths (scripts/verify-local-config.test.js keeps the list
// covering that graph). A PR that changes none of them skips the site check,
// and a later push that leaves them as they were reuses its pass. A release
// rebuilds the site whatever changed.
const SITE_SCRIPTS = [
  'build-content-manifest', 'build-experience', 'build-guides-pages', 'build-site-manifest',
  'check-article-date-contract', 'check-content-hub-contract', 'check-content-release-gates',
  'check-docs-deploy-surface', 'check-docs-links', 'check-docs-shell', 'check-image-seo-contract',
  'check-intent-ownership', 'check-public-url-stability', 'check-public-url-stability.test',
  'check-symbol-illustration-parity', 'check-symbol-image-contract', 'check-web-performance-contract',
  'docs-build', 'docs-check', 'generate-blog-responsive-images', 'generate-image-seo-assets',
  'generate-sitemap-v2', 'generate-symbol-avif-images', 'generate-symbol-hero-posters',
  'generate-symbol-responsive-images', 'optimize-homepage-hero', 'sync-app-symbol-dictionary',
  'validate-i18n-seo',
].map((name) => `scripts/${name}.js`);
const SITE_LIBS = [
  'ahrefs-analytics', 'alternatives-table', 'article-date-contract', 'atlas-motion',
  'canonical-organization', 'content-hub-registry', 'docs-check-helpers', 'docs-deploy-staging',
  'docs-renderer', 'docs-seo-utils', 'docs-site-config', 'docs-source-utils', 'docs-view-transitions',
  'educational-diagram-v2', 'experience-tier', 'generated-page-writer', 'guide-dictionary-model',
  'image-build-cache', 'image-seo-assets', 'landing-stylesheet', 'lucide-inline',
  'minify-static-stylesheets', 'page-illustrations', 'pages-redirect-contract', 'site-manifest',
  'site-media', 'symbol-image-assets', 'symbol-locales',
].map((name) => `scripts/lib/${name}.js`);
const SITE = [
  'docs-src/',
  'data/',
  ...SITE_SCRIPTS,
  ...SITE_LIBS,
  'scripts/lib/docs-components/',
  // docs:check scans the archived one-shot SEO scripts.
  'scripts/archive/seo-one-shots/',
  // The plan facts the pages state, and the site's own dependency manifest.
  'constants/limits.ts',
  'apps/site/dependencies.js',
  'apps/site/package.json',
  'package.json',
  'package-lock.json',
  '.npmrc',
  '.nvmrc',
];

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
// The release gate also loads the TesterArmy evidence engine
// (tools/e2e/qualification.mjs verifyEvidenceFiles and compareSnapshots).
const EAS_WORKFLOWS = [
  '.eas/workflows/',
  'eas.json',
  'scripts/check-android-release-ref.js',
  'scripts/check-android-release-gates.js',
  'tools/e2e/qualification.mjs',
];
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
  'node --test .circleci/tests/e2e-preparation.test.mjs tools/e2e/install-browsers.test.mjs',
  'node --test .circleci/tests/benchmark.test.mjs tools/e2e/benchmark-setup.test.mjs',
].join(' && ');

// Former CI edge-contracts and edge-functions (PGlite), now local only.
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
  '&& node --test scripts/ai-daily-budget-migration.test.cjs scripts/dream-sync-limits-migration.test.cjs',
].join(' ');

// What db-contracts reads: the migrations, the database contract manifest and
// the API sources its tests compare with them (supabase/), the tests and the
// scripts they load (scripts/; the site configuration one of them loads reads
// docs-src/config and docs-src/locales), the three app files the tests read,
// Jest (its Expo project reads tsconfig.json) and the packages (PGlite).
// scripts/verify-local-config.test.js runs the tests with every file they read
// recorded and checks them against this list.
const DB = [
  'supabase/', 'scripts/', 'constants/limits.ts', 'services/storageServiceReal.ts', 'lib/productAnalytics.ts',
  'docs-src/config/', 'docs-src/locales/', 'jest.config*.js', 'babel.config.js', 'tsconfig.json',
  'package.json', 'package-lock.json', '.npmrc',
];

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
// The image worker owns regression tests outside api/; checking its entrypoint
// alone does not execute its privacy, ownership and retry protections.
const EDGE_CHECKS = [
  'cd supabase/functions',
  'deno check --frozen api/index.ts analysis-job-worker/index.ts image-job-worker/index.ts revenuecat-webhook/index.ts',
  'deno test --frozen --allow-env --allow-net=deno.land --allow-read=../migrations api revenuecat-webhook image-job-worker analysis-job-worker',
].join(' && ');
const DENO = {
  command: 'deno --version',
  hint: 'run it locally where you run verify:pr (Deno 2.9.8: `mise install`); if this machine cannot, pass --external <check>="owner-machine: <host> <note> on <SHA>" from the machine that ran it; until then the proof is incomplete: do not push, report it as a blocker',
};

const TESTERARMY = {
  command: 'test -d tools/e2e/node_modules/@e2e-dev/web',
  hint: 'run it locally where you run verify:pr (after `npm run test:testerarmy:setup && npm run test:testerarmy:browsers` in the main checkout); if this machine cannot, pass --external <check>="owner-machine: <host> <note> on <SHA>" from the machine that ran it; until then the proof is incomplete: do not push, report it as a blocker',
};

// The full campaign and release gate share these four complete coverage contexts.
export const DREAMER_CAMPAIGN_CONTEXTS = [
  { locale: 'en-US', featureSheets: true, args: [] },
  { locale: 'fr-FR', featureSheets: true, args: ['--tag', 'locale-fr-FR'] },
  { locale: 'de-DE', featureSheets: true, args: ['--tag', 'locale-de-DE'] },
  { locale: 'en-US', featureSheets: false, args: ['--grep', 'feature sheets stay disabled when switched off'] },
];

// The four passes of tools/e2e/README.md that jointly qualify every Dreamer case.
const shellQuote = arg => `'${arg.replaceAll("'", "'\"'\"'")}'`;
const DREAMER_PASSES = DREAMER_CAMPAIGN_CONTEXTS.map(({ locale, featureSheets, args }) =>
  `EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=${featureSheets} E2E_WEB_LOCALE=${locale} node tools/e2e/run.mjs dreamer web run${args.length ? ' ' + args.map(shellQuote).join(' ') : ''}`,
).join(' && ');

const cachedTypecheck = (name, script) => {
  const info = `.cache/tsc/${name}.tsbuildinfo`;
  return `node scripts/verify-cache.mjs ${info} -- npm run ${script} -- --incremental --tsBuildInfoFile ${info}`;
};

// sha256 of this repository's own copy of scripts/verify-local.mjs. The engine
// tests compare the file with it, so an engine edit is a deliberate change of
// this pin. No other repository is read or compared.
export const ENGINE_SHA256 =
  'bd42265c67911491d230362ce61006979a76b56e1eda9930355f41dbdb3f7eb6';

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
    // Owner-requested maintenance guards: changes to their policy require review.
    'scripts/check-repository-hygiene.cjs',
    'scripts/check-repository-hygiene.test.cjs',
    'data/repository-hygiene-baseline.json',
    'scripts/check-lint-warnings.js',
    'scripts/check-lint-warnings.test.js',
    // Which new public tables may skip explicit grants: only the closed historical list.
    'scripts/check-migration-grants.cjs',
    'scripts/check-migration-grants.test.cjs',
    'scripts/lint-warnings-baseline.json',
    'scripts/install-git-hooks.js',
    'scripts/run-jest-changed.js',
    // What a verify:pr run carries over from the previous one (tsc build info).
    'scripts/verify-cache.mjs',
    'scripts/verify-cache.test.js',
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
    'scripts/lib/backend-e2e-local.cjs',
    'tools/e2e/run.mjs',
    'scripts/verify-local-config.test.js',
    'scripts/dependency-security.test.mjs',
    'scripts/dependency-security-scope.test.mjs',
    'scripts/pre-push-hook.test.js',
    // The EAS workflows and their config: any edit needs the owner's review
    // (the release gate only catches honest mistakes).
    '.eas/workflows/**',
    'eas.json',
    // The release guards eas-workflow-contracts tests, and its suites.
    'scripts/check-android-release-ref.js',
    'scripts/check-android-release-gates.js',
    'tools/e2e/qualification.mjs',
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
    'scripts/test-test-seed-auth.mjs',
    // The Expo runner re-checks a guarded branch run (marker from start-branch-e2e).
    'scripts/expo-safe-runner.js',
    'scripts/expo-safe-runner.test.js',
    'tools/e2e/e2e.config.ts',
    // The suites ci-contracts runs.
    '.circleci/tests/classify-changes.test.sh',
    '.circleci/tests/shared-build-impact.test.py',
    '.circleci/tests/fallback-jest.test.sh',
  ],
  checks: [
    // ---- verify:pr, reused by verify:release when the inputs are identical.
    {
      name: 'verify-local-engine',
      command: 'npm run test:verify-local',
      inputs: ['scripts/verify-local.mjs', 'scripts/test-verify-local*.mjs', 'scripts/test-platform-contracts.mjs', 'scripts/test-test-auth-permissions-native.mjs', 'scripts/test-auth-setup.mjs', 'scripts/test-support/**', 'scripts/run-verify-tests.mjs', 'verify-local.config.mjs', 'tools/e2e/campaign-contexts.mjs', '.gitattributes'],
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
        'tools/e2e/backend-fixtures.ts',
        'supabase/migrations/20260916185856_hd_illustration_monthly_quota.sql',
        'supabase/migrations/20260316130000_add_dream_sync_revisions.sql',
        'supabase/migrations/20260722124500_add_ai_sync_admission_control.sql',
        'supabase/functions/api/services/aiAdmission.ts',
        'supabase/functions/api/services/storage.ts',
        'tools/e2e/e2e.config.ts',
        '.gitignore',
        // The production ref is pinned against app.json.
        'app.json',
      ],
    },
    // Negative target/scheduler cases cannot safely be exercised by a live browser journey.
    {
      name: 'backend-runner-guards',
      command: 'node --test scripts/lib/backend-e2e-local.test.cjs scripts/lib/backend-e2e-process.test.cjs scripts/check-native-supabase-runtime.test.cjs',
      inputs: ['scripts/lib/backend-e2e-local.cjs', 'scripts/lib/backend-e2e-local.test.cjs', 'scripts/run-backend-e2e.cjs',
        'scripts/lib/backend-e2e-process.cjs', 'scripts/lib/backend-e2e-process.test.cjs',
        'scripts/check-native-supabase-runtime.cjs', 'scripts/check-native-supabase-runtime.test.cjs', 'supabase/config.toml'],
    },
    // CLI/index failures happen before UI journeys; keep both refusal cases local.
    // Default whole-tree inputs are intentional: every newly tracked path matters.
    {
      name: 'repository-hygiene',
      command: 'npm run repository:hygiene && npm run test:repository-hygiene',
    },
    // A new public table gets no Data API grant (Supabase from 2026-10-30, and
    // auto_expose_new_tables = false locally): its migration must enable RLS and
    // grant or revoke it for anon, authenticated and service_role.
    {
      name: 'migration-grants',
      command: 'npm run migrations:grants && npm run test:migration-grants',
      inputs: ['supabase/migrations/**', 'scripts/check-migration-grants.cjs', 'scripts/check-migration-grants.test.cjs', 'package.json'],
    },
    // Independent read-only checks share one supervised step and machine lock.
    // Route declarations are atomically replaced by generate-shared-route-types.
    // tsc keeps its incremental build info in the copy, and a PR run passes it
    // on to the next one (scripts/verify-cache.mjs): 32 s cold, 7 s from the
    // previous copy's build info. TypeScript rechecks what changed; a release
    // starts from nothing. A PR that changes nothing tsc reads (TYPESCRIPT)
    // skips both.
    { name: 'typecheck-app', command: cachedTypecheck('app', 'typecheck:app'), parallel: true, inputs: TYPESCRIPT, when: TYPESCRIPT },
    { name: 'typecheck-tests', command: cachedTypecheck('tests', 'typecheck:tests'), parallel: true, inputs: TYPESCRIPT, when: TYPESCRIPT },
    // `npm run lint` with ESLint narrowed, in a PR, to the files changed since
    // the merge base and the files importing them (scripts/check-lint-warnings.js
    // --changed); a change to the ESLint config, the packages or the baseline,
    // and every release, lint every file. On PR #570: 190 files of 1,580. The
    // files linted come from the diff: reused only against the same merge base.
    { name: 'lint', command: 'npm run brand:check && npm run lint:warnings -- --changed', perBase: true, parallel: true, inputs: LINT, when: LINT },
    // All of scripts/ with no warning allowed, for a PR that changes scripts/
    // or what they import (LINT_SCRIPTS): 21 to 29 s.
    { name: 'lint-scripts', command: 'npm run lint:scripts', parallel: true, inputs: LINT_SCRIPTS, when: LINT_SCRIPTS },
    // Root Jest tests related to the files changed since the merge-base with
    // origin/master (scripts/run-jest-changed.js). Whole tree: tests read files.
    // Picks its tests from the diff: reused only against the same merge base.
    // JEST_CHANGED_SINCE would override that base (HEAD selects no test), so
    // the check never inherits it. Workers come from jest.config.js: on PR
    // #570's 1,314 related tests, 95 s in band against 42 s on 4 workers. A PR
    // run keeps Jest's cache in the shared git directory (the copy's path stays
    // the same from one run to the next): 24 s cold, 8 s warm on components/.
    // A PR changing no file Jest can relate a test to (JEST) skips it.
    {
      name: 'jest-changed',
      perBase: true,
      when: JEST,
      command: 'npm run test:changed -- --watchman=false',
      env: { JEST_CHANGED_SINCE: '' },
    },
    // A PR that changes nothing these tests read (DB) skips them: 11 s.
    { name: 'db-contracts', command: DB_CONTRACTS, inputs: DB, when: DB },
    {
      name: 'dependency-security',
      command: 'node --test scripts/dependency-security.test.mjs scripts/dependency-security-scope.test.mjs',
      env: { DEPENDENCY_SECURITY_PROJECT: 'root' },
      when: ['package.json', 'package-lock.json', '.npmrc', 'tools/braces/', 'tools/image-size-compat/', 'scripts/dependency-security*.mjs'],
    },
    // Independent lockfiles must exercise their own installed graph. A patched
    // root package cannot qualify Meditation, the legacy docs or site tooling.
    {
      name: 'dependency-security-meditation', command: 'node --test scripts/dependency-security.test.mjs',
      env: { DEPENDENCY_SECURITY_PROJECT: 'meditation' },
      when: ['apps/meditation/package.json', 'apps/meditation/package-lock.json', 'apps/meditation/.npmrc', 'tools/braces/', 'tools/image-size-compat/', 'scripts/dependency-security*.mjs'],
      requires: MEDITATION_DEPS,
    },
    {
      name: 'dependency-security-documentation', command: 'node --test scripts/dependency-security.test.mjs',
      env: { DEPENDENCY_SECURITY_PROJECT: 'documentation' },
      when: ['doc_web_interne/docs/package.json', 'doc_web_interne/docs/package-lock.json', 'doc_web_interne/docs/.npmrc', 'tools/braces/', 'scripts/dependency-security*.mjs'],
      requires: {
        command: 'test -d doc_web_interne/docs/node_modules',
        hint: 'install the standalone documentation dependencies first: (cd doc_web_interne/docs && npm ci)',
      },
    },
    {
      name: 'dependency-security-site', command: 'node --test scripts/dependency-security.test.mjs',
      env: { DEPENDENCY_SECURITY_PROJECT: 'site' },
      when: ['apps/site/package.json', 'apps/site/package-lock.json', 'apps/site/.npmrc', 'scripts/dependency-security*.mjs'],
      requires: {
        command: 'test -d apps/site/node_modules',
        hint: 'install the standalone site dependencies first: (cd apps/site && npm ci)',
      },
    },

    // ---- verify:pr, only when the commit changes that surface since origin/master.
    { name: 'site', command: 'npm run docs:build && npm run docs:check', inputs: SITE, when: SITE },
    {
      name: 'ci-contracts', command: CI_CONTRACTS,
      when: [
        '.circleci/', 'package.json',
        'tools/e2e/package.json', 'tools/e2e/package-lock.json',
        'tools/e2e/benchmark-setup.mjs', 'tools/e2e/benchmark-setup.test.mjs',
        'tools/e2e/install-browsers.mjs', 'tools/e2e/install-browsers.test.mjs',
      ],
    },
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
    // The Vercel web app, rebuilt for the delivered commit. noctalia.app needs no
    // check of its own here: a release runs `site` above on that commit too.
    // `targets: ['app']` marks what only an app release runs (npm run
    // verify:release, which web:deploy:prod requires); npm run
    // verify:release:site, enough for the static site, leaves it out.
    { name: 'web-build', command: 'npm run build:web', kinds: ['release'], targets: ['app'], perCommit: true },
    {
      name: 'e2e-backend',
      command: 'npm run test:e2e:backend',
      kinds: ['release'],
      targets: ['app'],
      specialised: true,
      // The probe only answers whether the native Supabase runtime can start here
      // (pinned CLI 2.119+, Linux amd64/arm64 with glibc 2.35+ or macOS 14+ on Apple
      // silicon). When it fails the check is unavailable, never passed; when it
      // succeeds the journeys really run and must pass.
      requires: {
        command: 'node scripts/check-native-supabase-runtime.cjs',
        hint: 'native Supabase runtime, no Docker: needs Linux glibc>=2.35 (WSL2 on Windows) or macOS 14+ Apple silicon, the pinned CLI from `npm ci` and Chromium (`npm run test:testerarmy:browsers`); if this machine cannot, a machine where the probe passes runs it and passes --external e2e-backend="owner-machine: <host> <note> on <SHA>" (the fixed evidence keyword); until then the proof is incomplete: do not push, report it as a blocker',
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
    { name: 'testerarmy-dreamer', command: DREAMER_PASSES, kinds: ['release'], targets: ['app'], specialised: true, requires: TESTERARMY },
    { name: 'testerarmy-lucid', command: 'npm run test:testerarmy:lucid', kinds: ['release'], targets: ['app'], specialised: true, requires: TESTERARMY },
    {
      name: 'testerarmy-meditation',
      command: 'npm run test:testerarmy:meditation',
      kinds: ['release'],
      targets: ['app'],
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
