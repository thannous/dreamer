/* global __dirname, describe, it, expect */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  checkAndroidReleaseGates,
  checkEasWorkflowTriggers,
  formatReport,
  parseDotEnv,
} = require('./check-android-release-gates');

const SCRIPT = path.join(__dirname, 'check-android-release-gates.js');

function writeJson(root, relativePath, value) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeFile(root, relativePath, value) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function validEasJson() {
  const profile = {
    env: {
      EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER: '359653779023',
      EXPO_PUBLIC_ANALYSIS_JOBS_ENABLED: 'true',
      NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'false',
    },
  };
  return {
    build: {
      preview: profile,
      release: profile,
      'production-apk': profile,
      production: profile,
      'revenuecat-teststore': {
        env: {
          NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'true',
        },
      },
    },
    submit: {
      internal: {
        android: {
          track: 'internal',
        },
      },
    },
  };
}

function validEnv() {
  return [
    'EXPO_PUBLIC_API_URL=https://example.test/api',
    'EXPO_PUBLIC_SUPABASE_URL=https://example.test',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_test',
    'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=test_key',
    'EXPO_PUBLIC_ANALYTICS_DEBUG=false',
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=web.apps.googleusercontent.com',
    'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=android.apps.googleusercontent.com',
    'EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER=359653779023',
  ].join('\n');
}

const RUN_REVISION = '0123456789abcdef0123456789abcdef01234567';
const OTHER_REVISION = 'fedcba9876543210fedcba9876543210fedcba98';
// Relative to each fixture root; the gate resolves QA_ANDROID_RELEASE_APK there.
const CANDIDATE_APK = 'build/release.apk';
const CANDIDATE_APK_BYTES = 'candidate apk bytes';
const sha256 = (value) => require('crypto').createHash('sha256').update(value).digest('hex');

function hashRunFolder(root, runDir) {
  const base = path.join(root, runDir);
  const hashes = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(base, full).split(path.sep).join('/');
      if (entry.isDirectory()) walk(full);
      else if (relative !== 'files.json' && relative !== 'end.json') hashes[relative] = sha256(fs.readFileSync(full));
    }
  };
  walk(base);
  return Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// The files tools/e2e/run.mjs writes for a qualified native run of a Release
// build, with files.json written last before end.json, as the runner does.
function writeTesterArmyRun(root, {
  name = '1760000000000-1-run',
  versionCode = 33,
  profile = 'production-apk',
  bundle = 'com.tanuki75.noctalia',
  product = 'dreamer',
  applicationQualified = true,
  exitCode = 0,
  revision = RUN_REVISION,
  buildRevision = revision,
  workingTree = '',
  args = ['--install-release'],
  sourceStable = true,
  sourceClean = true,
  apkBytes = CANDIDATE_APK_BYTES,
  sourceEnd = {},
} = {}) {
  const runDir = `tools/e2e/.e2e/dreamer-android/${name}`;
  writeFile(root, CANDIDATE_APK, CANDIDATE_APK_BYTES);
  const binary = { bundle, version: '2.0.2', build: String(versionCode), sha256: sha256(apkBytes), path: `/builds/${name}/release.apk` };
  writeJson(root, `${runDir}/evidence.json`, {
    product,
    platform: 'android',
    revision,
    workingTree,
    binary,
    command: ['node', 'tools/e2e/run.mjs', product, 'android', 'run', ...args],
  });
  writeJson(root, `${runDir}/release-used.json`, { profile: { name: profile }, source: { revision: buildRevision }, binary });
  // The shape of tools/e2e/qualification.mjs sourceSnapshot, as the #387 runner
  // writes it before and after the run (source-end.json comes before files.json).
  const sourceFiles = {
    'app.json': sha256('app.json bytes'),
    'app/recording.tsx': sha256('recording bytes'),
    'package.json': sha256('package.json bytes'),
  };
  const snapshot = { revision, workingTree, files: sourceFiles, outputs: {}, allowedOutputPrefixes: [] };
  writeJson(root, `${runDir}/source-start.json`, snapshot);
  writeJson(root, `${runDir}/source-end.json`, { ...snapshot, ...sourceEnd });
  writeJson(root, `${runDir}/collection.json`, { pairs: [{ file: 'tests/dreamer.mobile.e2e.ts' }] });
  writeJson(root, `${runDir}/report.json`, {
    run: { vcs: { commit: revision }, status: 'passed', exitCode: 0, summary: { failed: 0, interrupted: 0 } },
  });
  writeJson(root, `${runDir}/qualification.json`, {
    revision,
    target: 'dreamer-android',
    passed: [{ targetId: 'dreamer-android', testId: 'release' }],
  });
  writeJson(root, `${runDir}/installed-start.json`, { bundle, binarySha256: binary.sha256, buildSource: buildRevision });
  writeJson(root, `${runDir}/installed-end.json`, { bundle, binarySha256: binary.sha256, buildSource: buildRevision });
  writeFile(root, `${runDir}/results/release/trace.md`, 'trace');
  writeJson(root, `${runDir}/files.json`, hashRunFolder(root, runDir));
  writeJson(root, `${runDir}/end.json`, {
    finishedAt: '2026-10-15T10:00:00.000Z',
    exitCode,
    applicationQualified,
    stability: { sourceStable, sourceClean },
  });
  return runDir;
}

function setupFixture({ versionCode = 33 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'android-gates-'));
  writeJson(root, 'app.json', {
    expo: {
      version: '2.0.2',
      android: {
        package: 'com.tanuki75.noctalia',
        versionCode,
      },
      plugins: [
        [
          'expo-build-properties',
          {
            android: {
              enableMinifyInReleaseBuilds: true,
              enableShrinkResourcesInReleaseBuilds: true,
            },
          },
        ],
      ],
    },
  });
  writeJson(root, 'eas.json', validEasJson());
  writeFile(root, '.env.teststore', validEnv());
  writeFile(
    root,
    '.eas/workflows/android-release-qualification.yml',
    [
      'on:',
      '  workflow_dispatch:',
      '    inputs:',
      '      release_tag:',
      '        type: string',
      '        required: true',
      'jobs:',
      '  validate_android_release_ref:',
      '    env:',
      "      RELEASE_TAG: ${{ inputs.release_tag }}",
      '    steps:',
      '      - run: node ./scripts/check-android-release-ref.js',
      '  build_android:',
      '    needs:',
      '      - validate_android_release_ref',
      '    type: build',
      '    params:',
      '      profile: production-apk',
      '',
    ].join('\n')
  );
  writeFile(
    root,
    '.eas/workflows/android-release-smoke.yml',
    [
      'on:',
      '  workflow_dispatch:',
      '    inputs:',
      '      release_tag:',
      '        type: string',
      '        required: true',
      'jobs:',
      '  validate_android_release_ref:',
      '    env:',
      "      RELEASE_TAG: ${{ inputs.release_tag }}",
      '    steps:',
      '      - run: node ./scripts/check-android-release-ref.js',
      '  build_android_release_smoke:',
      '    needs: [validate_android_release_ref]',
      '    type: build',
      '    params:',
      '      profile: release-smoke',
      '',
    ].join('\n')
  );
  // Any other workflow is held to the dispatch-only rule as well.
  writeFile(
    root,
    '.eas/workflows/on-demand.yml',
    ['on:', '  workflow_dispatch: {}', 'jobs:', '  build_on_demand:', '    type: build', ''].join('\n')
  );
  writeTesterArmyRun(root, { versionCode });
  return root;
}

function writeGooglePlayTrackSnapshot(root, versionCode, status = 'completed') {
  writeJson(root, 'doc_web_interne/docs/google-play-track-state.local.json', {
    package_name: 'com.tanuki75.noctalia',
    track: 'internal',
    expected_version_code: String(versionCode),
    expected_status: 'completed',
    releases: [
      {
        name: `candidate-${versionCode}`,
        status,
        version_codes: [String(versionCode)],
      },
    ],
  });
}

function writeGoogleCloudProjectSnapshot(root, overrides = {}) {
  writeJson(root, 'doc_web_interne/docs/google-cloud-project-state.local.json', {
    project_number: '359653779023',
    project_id: 'gen-lang-client-0336445544',
    name: 'dreamweaver',
    lifecycle_state: 'ACTIVE',
    checked_at: '2026-05-14T12:00:00.000Z',
    source: 'test',
    ...overrides,
  });
}

function writeGoogleOAuthAndroidClientSnapshot(root, overrides = {}) {
  writeJson(root, 'doc_web_interne/docs/google-oauth-android-client-state.local.json', {
    client_id: '359653779023-5dhs012rh7l3cjf0leoknn7j0dlgq0ok.apps.googleusercontent.com',
    name: 'Noctalia Android Production',
    package_name: 'com.tanuki75.noctalia',
    sha1: 'BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59',
    checked_at: '2026-05-14T12:00:00.000Z',
    source: 'test',
    ...overrides,
  });
}

function writeSupabasePlayIntegritySecretsSnapshot(root, overrides = {}) {
  writeJson(root, 'doc_web_interne/docs/supabase-play-integrity-secrets-state.local.json', {
    checked_at: '2026-05-14T21:30:00.000Z',
    source: 'test',
    project_ref: 'usuyppgsmmowzizhaoqj',
    secrets: {
      PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64: {
        label: 'Play Integrity service account JSON',
        status: 'present',
      },
      PLAY_INTEGRITY_PACKAGE_NAME: {
        label: 'Play Integrity package name',
        status: 'present',
        value: 'com.tanuki75.noctalia',
      },
      GUEST_SESSION_SECRET: {
        label: 'Guest session signing secret',
        status: 'present',
      },
    },
    ...overrides,
  });
}

describe('android release gate preflight', () => {
  const previousApk = process.env.QA_ANDROID_RELEASE_APK;
  beforeEach(() => {
    process.env.QA_ANDROID_RELEASE_APK = CANDIDATE_APK;
  });
  afterAll(() => {
    if (previousApk === undefined) delete process.env.QA_ANDROID_RELEASE_APK;
    else process.env.QA_ANDROID_RELEASE_APK = previousApk;
  });
  function npmRunScript(args) {
    const runIndex = args.indexOf('run');
    return runIndex === -1 ? null : args[runIndex + 1];
  }

  function spawnWithTools({
    subscriptionGateStatus = 0,
    subscriptionReportStatus = 0,
    adbDevices = true,
    adbMdnsStdout = 'List of discovered mdns services\n',
    adbUsbStdout = '',
    gitHead = RUN_REVISION,
  } = {}) {
    return (command, args) => {
      if (command === 'git' && args[0] === 'rev-parse' && args[1] === 'HEAD') {
        return gitHead ? { status: 0, stdout: `${gitHead}\n`, stderr: '' } : { status: 128, stdout: '', stderr: 'not a git repository' };
      }
      if (['which', 'where'].includes(command) && args[0] === 'adb') return { status: 0 };
      if (command === 'adb' && args[0] === 'devices') {
        return {
          status: 0,
          stdout: adbDevices
            ? 'List of devices attached\nemulator-5554\tdevice\n'
            : 'List of devices attached\n',
        };
      }
      if (command === 'adb' && args[0] === 'mdns') {
        return { status: 0, stdout: adbMdnsStdout, stderr: '' };
      }
      if (command === 'ioreg') {
        return { status: 0, stdout: adbUsbStdout, stderr: '' };
      }
      if (npmRunScript(args) === 'subscription:qa:release-gate') {
        return {
          status: subscriptionGateStatus,
          stdout:
            subscriptionGateStatus === 0
              ? '[subscription-release-smoke] assertions: 3/3\n[subscription-release-smoke] PASS - final release smoke\n'
              : '[subscription-release-smoke] assertions: 1/3\n[subscription-release-smoke] BLOCKED - final release smoke\n',
          stderr: '',
        };
      }
      if (npmRunScript(args) === 'subscription:qa:report') {
        return {
          status: subscriptionReportStatus,
          stdout:
            subscriptionReportStatus === 0
              ? 'Subscription local/config checks passed.\n'
              : 'Blocked checks: 1\n',
          stderr: '',
        };
      }
      return { status: 1, stdout: '', stderr: '' };
    };
  }

  it('parses dotenv values without exposing comments or quotes', () => {
    expect(parseDotEnv("A=one\n# nope\nB='two'\nC=\"three\"")).toEqual({
      A: 'one',
      B: 'two',
      C: 'three',
    });
  });

  it('documents the two-phase prebuild and qualification modes', () => {
    const result = spawnSync(process.execPath, [SCRIPT, '--help'], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--prebuild');
    expect(result.stdout).toContain('defer candidate Play evidence and track readiness');
  });

  it('lets prebuild create a candidate before Play evidence exists', () => {
    const root = setupFixture({ versionCode: 41 });
    writeGooglePlayTrackSnapshot(root, 40);
    const calls = [];
    const baseSpawn = spawnWithTools({
      subscriptionGateStatus: 1,
      subscriptionReportStatus: 0,
    });
    const spawn = (command, args, options) => {
      calls.push([command, ...args]);
      return baseSpawn(command, args, options);
    };

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn,
      phase: 'prebuild',
    });

    expect(report.ok).toBe(true);
    expect(report.phase).toBe('prebuild');
    expect(calls.some((call) => npmRunScript(call.slice(1)) === 'subscription:qa:report')).toBe(true);
    expect(
      calls.some((call) => npmRunScript(call.slice(1)) === 'subscription:qa:release-gate')
    ).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'manual' &&
          check.title === 'Google Play internal track release' &&
          check.details.includes('versionCode 41')
      )
    ).toBe(true);
    expect(formatReport(report)).toContain('Android release prebuild gate');
  });

  it('keeps prebuild fail-closed when subscription wiring checks fail', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools({ subscriptionReportStatus: 1 }),
      phase: 'prebuild',
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'fail' &&
          check.title === 'RevenueCat subscription QA prebuild wiring gate'
      )
    ).toBe(true);
  });

  it('fails prebuild when the Release build workflow is missing', () => {
    const root = setupFixture();
    fs.rmSync(path.join(root, '.eas/workflows/android-release-qualification.yml'));

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools(),
      phase: 'prebuild',
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'fail',
          title: 'EAS Android Release build workflow',
        }),
      ])
    );
  });

  const DISPATCH_HEADER = [
    'on:',
    '  workflow_dispatch:',
    '    inputs:',
    '      release_tag:',
    '        type: string',
    '        required: true',
    '',
  ].join('\n');
  const QUALIFICATION = 'android-release-qualification.yml';
  const SMOKE = 'android-release-smoke.yml';
  const REF_JOB = [
    '  validate_android_release_ref:',
    '    env:',
    '      RELEASE_TAG: ${{ inputs.release_tag }}',
    '    steps:',
    '      - run: node ./scripts/check-android-release-ref.js',
    '',
  ].join('\n');
  const EXTRA_TRIGGERS = [
    ['push tags', '  push:\n    tags:\n      - v*\n'],
    ['pull_request', '  pull_request:\n    branches: [\'*\']\n'],
    ['pull_request_comment', '  pull_request_comment:\n    types: [created]\n'],
    ['pull_request_labeled', '  pull_request_labeled:\n    - Test\n'],
    ['app_store_connect', '  app_store_connect:\n    build_upload: {}\n'],
    ['schedule', '  schedule:\n    - cron: \'0 0 * * *\'\n'],
    ['ref_delete', '  ref_delete:\n    tags: [v*]\n'],
    ['an unknown trigger', '  some_future_trigger: {}\n'],
  ];

  function gateReport(file, transform) {
    const root = setupFixture();
    const workflowPath = path.join(root, '.eas/workflows', file);
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const changed = transform(workflow);
    expect(changed).not.toBe(workflow);
    fs.writeFileSync(workflowPath, changed, 'utf8');
    return checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools(), phase: 'prebuild' });
  }

  function expectCheckFails(report, title) {
    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'fail', title })]));
  }

  const QUALIFICATION_TITLE = 'EAS Android Release build workflow';
  const TRIGGERS_TITLE = 'EAS workflows dispatch only';

  it('passes both workflow checks on the fixture and on the real .eas/workflows', () => {
    const report = checkAndroidReleaseGates({ rootDir: setupFixture(), spawn: spawnWithTools(), phase: 'prebuild' });
    for (const title of [QUALIFICATION_TITLE, TRIGGERS_TITLE]) {
      expect(report.checks).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'pass', title })]));
    }
    const real = checkEasWorkflowTriggers(path.resolve(__dirname, '..'));
    expect(real.problems).toEqual([]);
    expect(real.files).toEqual(expect.arrayContaining([QUALIFICATION, SMOKE]));
  });

  it.each(EXTRA_TRIGGERS)('fails prebuild when the Release workflow has %s next to workflow_dispatch', (_name, extraTrigger) => {
    const report = gateReport(QUALIFICATION, (workflow) => workflow.replace(DISPATCH_HEADER, `${DISPATCH_HEADER}${extraTrigger}`));
    expectCheckFails(report, QUALIFICATION_TITLE);
    expectCheckFails(report, TRIGGERS_TITLE);
  });

  it('fails prebuild when the Release workflow dispatch has no required release_tag input', () => {
    expectCheckFails(gateReport(QUALIFICATION, (w) => w.replace(DISPATCH_HEADER, 'on:\n  workflow_dispatch: {}\n')), QUALIFICATION_TITLE);
    expectCheckFails(gateReport(QUALIFICATION, (w) => w.replace('        required: true\n', '        required: false\n')), QUALIFICATION_TITLE);
  });

  describe.each([
    [QUALIFICATION, 'build_android', QUALIFICATION_TITLE],
    [SMOKE, 'build_android_release_smoke', TRIGGERS_TITLE],
  ])('release tag check wiring in %s', (file, buildJob, title) => {
    it('fails when the ref check survives only as a comment', () => {
      expectCheckFails(gateReport(file, (w) => w
        .replace(REF_JOB, '')
        .replace('jobs:\n', 'jobs:\n  # node ./scripts/check-android-release-ref.js\n')), title);
    });

    it('fails when the ref job is removed', () => {
      expectCheckFails(gateReport(file, (w) => w.replace(REF_JOB, '')), title);
    });

    it('fails when RELEASE_TAG is missing', () => {
      expectCheckFails(gateReport(file, (w) => w.replace('    env:\n      RELEASE_TAG: ${{ inputs.release_tag }}\n', '')), title);
    });

    it('fails when RELEASE_TAG is hardcoded', () => {
      expectCheckFails(gateReport(file, (w) => w.replace('RELEASE_TAG: ${{ inputs.release_tag }}', 'RELEASE_TAG: v3.5.0')), title);
    });

    it(`fails when ${buildJob} does not need the ref job`, () => {
      expectCheckFails(gateReport(file, (w) => w
        .replace('    needs:\n      - validate_android_release_ref\n', '')
        .replace('    needs: [validate_android_release_ref]\n', '')), title);
    });
  });

  const CHECK_STEP = '      - run: node ./scripts/check-android-release-ref.js\n';
  const BYPASSES = [
    ['if: ${{ false }}', 'if: ${{ false }}'],
    ['if: false', 'if: false'],
    ['continue-on-error', 'continue-on-error: true'],
    ['continue_on_error', 'continue_on_error: true'],
  ];
  const BUILD_BYPASSES = [
    ['if: ${{ always() }}', 'if: ${{ always() }}'],
    ['if: false', 'if: false'],
    ['continue-on-error', 'continue-on-error: true'],
    ['continue_on_error', 'continue_on_error: true'],
  ];

  describe.each([
    [QUALIFICATION, 'build_android', QUALIFICATION_TITLE],
    [SMOKE, 'build_android_release_smoke', TRIGGERS_TITLE],
  ])('release tag check bypasses in %s', (file, buildJob, title) => {
    it.each(BYPASSES)('fails with %s on the check job', (_name, line) => {
      expectCheckFails(gateReport(file, (w) => w.replace(
        '  validate_android_release_ref:\n', `  validate_android_release_ref:\n    ${line}\n`)), title);
    });

    it.each(BYPASSES)('fails with %s on the check step', (_name, line) => {
      expectCheckFails(gateReport(file, (w) => w.replace(CHECK_STEP, `${CHECK_STEP}        ${line}\n`)), title);
    });

    it.each(BUILD_BYPASSES)(`fails with %s on ${buildJob}`, (_name, line) => {
      expectCheckFails(gateReport(file, (w) => w.replace(`  ${buildJob}:\n`, `  ${buildJob}:\n    ${line}\n`)), title);
    });

    it('fails when the check step overrides RELEASE_TAG in its env', () => {
      expectCheckFails(gateReport(file, (w) => w.replace(
        CHECK_STEP, `${CHECK_STEP}        env:\n          RELEASE_TAG: v3.5.0\n`)), title);
    });

    it('fails when another step sets RELEASE_TAG in its env', () => {
      expectCheckFails(gateReport(file, (w) => w.replace(
        '    steps:\n', '    steps:\n      - run: echo before\n        env:\n          RELEASE_TAG: v3.5.0\n')), title);
    });

    it('fails when a second type: build job needs nothing', () => {
      expectCheckFails(gateReport(file, (w) =>
        `${w}  sneaky_build:\n    type: build\n    params:\n      profile: production-apk\n`), title);
    });

    it('fails when a second type: build job needs only a job outside the check', () => {
      expectCheckFails(gateReport(file, (w) =>
        `${w}  setup:\n    steps:\n      - run: echo setup\n  sneaky_build:\n    needs: [setup]\n    type: build\n    params:\n      profile: production-apk\n`), title);
    });

    it('fails when a second type: build job needs the check only through another job', () => {
      expectCheckFails(gateReport(file, (w) =>
        `${w}  late_build:\n    needs: [${buildJob}]\n    type: build\n    params:\n      profile: production-apk\n`), title);
    });

    it('fails when the build job needs the check only through an intermediate job with if: failure()', () => {
      expectCheckFails(gateReport(file, (w) => w
        .replace('    needs:\n      - validate_android_release_ref\n', '    needs:\n      - bridge\n')
        .replace('    needs: [validate_android_release_ref]\n', '    needs: [bridge]\n')
        .concat('  bridge:\n    needs: [validate_android_release_ref]\n    if: ${{ failure() }}\n    steps:\n      - run: echo bridge\n')), title);
    });
  });

  describe('top-level keys of an EAS workflow (YAML 1.1 booleans, non-string keys)', () => {
    const E2E = 'on-demand.yml';
    const withTopLevel = (extra) => (w) => `${w}${extra}`;
    const YAML11_BOOLEANS = [
      'y', 'Y', 'yes', 'Yes', 'YES', 'n', 'N', 'no', 'No', 'NO',
      'true', 'True', 'TRUE', 'false', 'False', 'FALSE',
      'On', 'ON', 'off', 'Off', 'OFF',
    ];

    it.each(YAML11_BOOLEANS)('fails with a top-level %s: key holding push next to on:', (key) => {
      const report = gateReport(E2E, withTopLevel(`${key}:\n  push: {}\n`));
      expectCheckFails(report, TRIGGERS_TITLE);
      expect(report.checks.find((check) => check.title === TRIGGERS_TITLE).details).toMatch(/top-level key/);
    });

    it('fails with a second plain on: key (duplicate)', () => {
      expectCheckFails(gateReport(E2E, withTopLevel('on:\n  push: {}\n')), TRIGGERS_TITLE);
    });

    it('fails with a quoted "on" next to a plain on:', () => {
      expectCheckFails(gateReport(E2E, withTopLevel('"on":\n  push: {}\n')), TRIGGERS_TITLE);
    });

    it.each([
      ['a number', '1:\n  push: {}\n'],
      ['null', '~:\n  push: {}\n'],
      ['a flow sequence', '? [a]\n: push\n'],
    ])('fails with a non-string top-level key (%s)', (_name, extra) => {
      const report = gateReport(E2E, withTopLevel(extra));
      expectCheckFails(report, TRIGGERS_TITLE);
      expect(report.checks.find((check) => check.title === TRIGGERS_TITLE).details).toMatch(/not a plain string/);
    });

    it('fails with a %YAML 1.1 directive', () => {
      const report = gateReport(E2E, (w) => `%YAML 1.1\n---\n${w}`);
      expectCheckFails(report, TRIGGERS_TITLE);
      expect(report.checks.find((check) => check.title === TRIGGERS_TITLE).details).toMatch(/YAML directive/);
    });

    it('fails with a top-level <<: merge key', () => {
      expectCheckFails(gateReport(E2E, withTopLevel('<<: {on: {push: {}}}\n')), TRIGGERS_TITLE);
    });

    it('fails with an unknown top-level key', () => {
      expectCheckFails(gateReport(E2E, withTopLevel('triggers:\n  push: {}\n')), TRIGGERS_TITLE);
    });

    it('fails with a second YAML document', () => {
      expectCheckFails(gateReport(E2E, withTopLevel('---\non:\n  push: {}\n')), TRIGGERS_TITLE);
    });

    it('fails a release workflow with a yes: key holding push', () => {
      const report = gateReport(QUALIFICATION, withTopLevel('yes:\n  push: {}\n'));
      expectCheckFails(report, QUALIFICATION_TITLE);
      expectCheckFails(report, TRIGGERS_TITLE);
    });

    it('passes every EAS top-level key', () => {
      const root = setupFixture();
      const workflowPath = path.join(root, '.eas/workflows', E2E);
      fs.writeFileSync(workflowPath, `name: e2e\nrun_name: e2e run\ndefaults:\n  image: auto\nconcurrency:\n  cancel_in_progress: true\n  group: g\n${fs.readFileSync(workflowPath, 'utf8')}`);
      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools(), phase: 'prebuild' });
      expect(report.checks).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'pass', title: TRIGGERS_TITLE })]));
    });
  });

  it('fails prebuild when the smoke workflow has no required release_tag input', () => {
    expectCheckFails(gateReport(SMOKE, (w) => w.replace('        required: true\n', '        required: false\n')), TRIGGERS_TITLE);
    expectCheckFails(gateReport(SMOKE, (w) => w.replace(DISPATCH_HEADER, 'on:\n  workflow_dispatch: {}\n')), TRIGGERS_TITLE);
  });

  describe.each([SMOKE, 'on-demand.yml'])('dispatch-only triggers of %s', (file) => {
    it.each(EXTRA_TRIGGERS)('fails prebuild with %s next to workflow_dispatch', (_name, extraTrigger) => {
      expectCheckFails(gateReport(file, (w) => w.replace('  workflow_dispatch', `${extraTrigger}  workflow_dispatch`)), TRIGGERS_TITLE);
    });
  });

  it('fails prebuild when a new EAS workflow has an automatic trigger', () => {
    const root = setupFixture();
    writeFile(root, '.eas/workflows/new-workflow.yml', 'on:\n  pull_request: {}\njobs: {}\n');
    expectCheckFails(checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools(), phase: 'prebuild' }), TRIGGERS_TITLE);
  });

  it('fails prebuild when the smoke workflow is missing', () => {
    const root = setupFixture();
    fs.rmSync(path.join(root, '.eas/workflows', SMOKE));
    expectCheckFails(checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools(), phase: 'prebuild' }), TRIGGERS_TITLE);
  });

  it('passes prebuild local config checks without requiring Play-installed purchase evidence', () => {
    const root = setupFixture();
    const spawn = spawnWithTools();

    const report = checkAndroidReleaseGates({ rootDir: root, spawn, phase: 'prebuild' });

    expect(report.ok).toBe(true);
    expect(report.counts.fail || 0).toBe(0);
    expect(report.counts.blocked || 0).toBe(0);
    expect(report.checks.some((check) => check.title === 'Play payments profile for Billing')).toBe(true);
    expect(report.checks.some((check) => check.title === 'Supabase Play Integrity secrets')).toBe(true);
    expect(
      report.checks.some(
        (check) =>
          check.title === 'Play App Signing SHA-1 for Google OAuth' &&
          check.details.includes('BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59') &&
          check.remediation.includes('Android OAuth client')
      )
    ).toBe(true);
    expect(report.checks.some((check) => check.title === 'Play-installed RevenueCat purchase and restore')).toBe(false);
  });

  it('reports the enabled Android Release optimizations', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools(),
      phase: 'prebuild',
    });

    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'pass',
          title: 'Android Release R8 minification and resource shrinking',
          details:
            'expo-build-properties Android: enableMinifyInReleaseBuilds=true, enableShrinkResourcesInReleaseBuilds=true.',
        }),
      ])
    );
  });

  it.each([
    ['minification', 'enableMinifyInReleaseBuilds'],
    ['resource shrinking', 'enableShrinkResourcesInReleaseBuilds'],
  ])('fails prebuild when Android Release %s is disabled', (_label, property) => {
    const root = setupFixture();
    const appConfig = JSON.parse(
      fs.readFileSync(path.join(root, 'app.json'), 'utf8')
    );
    appConfig.expo.plugins[0][1].android[property] = false;
    writeJson(root, 'app.json', appConfig);

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools(),
      phase: 'prebuild',
    });
    const optimizationCheck = report.checks.find(
      (check) =>
        check.title ===
        'Android Release R8 minification and resource shrinking'
    );

    expect(report.ok).toBe(false);
    expect(optimizationCheck).toMatchObject({
      status: 'fail',
    });
    expect(optimizationCheck.details).toContain(`${property}=false`);
    expect(formatReport(report)).toContain(
      'Next: Set expo-build-properties android.enableMinifyInReleaseBuilds and android.enableShrinkResourcesInReleaseBuilds to true in app.json.'
    );
  });

  it('passes the Google Cloud project number check from a local snapshot', () => {
    const root = setupFixture();
    writeGoogleCloudProjectSnapshot(root);

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(
      report.checks.some(
        (check) =>
          check.status === 'pass' &&
          check.title === 'Google Cloud project number confirmation' &&
          check.details.includes('359653779023 -> gen-lang-client-0336445544/ACTIVE')
      )
    ).toBe(true);
  });

  it('blocks a completed Play track snapshot for an older version than the app.json candidate', () => {
    const root = setupFixture({ versionCode: 41 });
    writeGooglePlayTrackSnapshot(root, 40);

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Google Play internal track release' &&
          check.details.includes('internal/missing/41')
      )
    ).toBe(true);
  });

  it('keeps strict qualification blocked when the candidate Play track snapshot is missing', () => {
    const root = setupFixture({ versionCode: 41 });

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Google Play internal track release' &&
          check.details.includes('has not been recorded for candidate versionCode 41')
      )
    ).toBe(true);
  });

  it('passes Play track readiness for the app.json candidate versionCode', () => {
    const root = setupFixture({ versionCode: 41 });
    writeGooglePlayTrackSnapshot(root, 41);

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(
      report.checks.some(
        (check) =>
          check.status === 'pass' &&
          check.title === 'Google Play internal track release' &&
          check.details.includes('internal/candidate-41/completed/versionCode=41')
      )
    ).toBe(true);
  });

  it('passes the Play App Signing OAuth SHA check from a local snapshot', () => {
    const root = setupFixture();
    writeGoogleOAuthAndroidClientSnapshot(root);

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(
      report.checks.some(
        (check) =>
          check.status === 'pass' &&
          check.title === 'Play App Signing SHA-1 for Google OAuth' &&
          check.details.includes('359653779023-5dhs012rh7l3cjf0leoknn7j0dlgq0ok') &&
          check.details.includes('BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59')
      )
    ).toBe(true);
  });

  it('passes the Supabase Play Integrity secrets check from a local snapshot', () => {
    const root = setupFixture();
    writeSupabasePlayIntegritySecretsSnapshot(root);

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(
      report.checks.some(
        (check) =>
          check.status === 'pass' &&
          check.title === 'Supabase Play Integrity secrets' &&
          check.details.includes('Required Supabase Play Integrity secrets are present')
      )
    ).toBe(true);
  });

  it('blocks the Supabase Play Integrity secrets check when a required secret is missing', () => {
    const root = setupFixture();
    writeSupabasePlayIntegritySecretsSnapshot(root, {
      secrets: {
        PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64: {
          label: 'Play Integrity service account JSON',
          status: 'missing',
        },
        PLAY_INTEGRITY_PACKAGE_NAME: {
          label: 'Play Integrity package name',
          status: 'present',
          value: 'com.example.other',
        },
        GUEST_SESSION_SECRET: {
          label: 'Guest session signing secret',
          status: 'present',
        },
      },
    });

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Supabase Play Integrity secrets' &&
          check.details.includes('PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64/missing') &&
          check.details.includes('PLAY_INTEGRITY_PACKAGE_NAME/value=com.example.other')
      )
    ).toBe(true);
  });

  it('blocks the Play App Signing OAuth SHA check when the snapshot disagrees', () => {
    const root = setupFixture();
    writeGoogleOAuthAndroidClientSnapshot(root, { sha1: 'AA:BB' });

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Play App Signing SHA-1 for Google OAuth' &&
          check.details.includes('expected BC:CF:C2:96')
      )
    ).toBe(true);
  });

  it('blocks the Google Cloud project number check when the snapshot disagrees with env', () => {
    const root = setupFixture();
    writeGoogleCloudProjectSnapshot(root, { project_number: '000000000000' });

    const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Google Cloud project number confirmation' &&
          check.details.includes('does not match')
      )
    ).toBe(true);
  });

  describe('TesterArmy production-apk release evidence', () => {
    const TITLE = 'TesterArmy Android Release journeys (production-apk)';
    const VOICE_TITLE = 'Release voice transcription, save and analysis';
    const testerArmyCheck = (report) => report.checks.find((check) => check.title === TITLE);
    const voiceCheck = (report) => report.checks.find((check) => check.title === VOICE_TITLE);

    function qualificationRoot(versionCode = 33) {
      const root = setupFixture({ versionCode });
      writeGooglePlayTrackSnapshot(root, versionCode);
      fs.rmSync(path.join(root, 'tools/e2e/.e2e'), { recursive: true });
      return root;
    }

    it('passes qualification with a qualified run of the candidate production-apk build', () => {
      const root = qualificationRoot();
      const runDir = writeTesterArmyRun(root);

      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

      expect(testerArmyCheck(report)).toMatchObject({ status: 'pass' });
      expect(testerArmyCheck(report).details).toContain(runDir);
      expect(testerArmyCheck(report).details).toContain('versionCode 33');
      expect(report.ok).toBe(true);
    });

    it('blocks qualification without any TesterArmy run', () => {
      const report = checkAndroidReleaseGates({ rootDir: qualificationRoot(), spawn: spawnWithTools() });

      expect(report.ok).toBe(false);
      expect(testerArmyCheck(report)).toMatchObject({ status: 'blocked' });
      expect(testerArmyCheck(report).remediation).toContain('npm run test:testerarmy:mobile -- dreamer android run --install-release');
    });

    it.each([
      ['another versionCode', { versionCode: 32 }],
      ['a mock-persistent build', { profile: 'mock-persistent' }],
      ['another bundle', { bundle: 'com.tanuki75.noctalia.qa' }],
      ['another product', { product: 'lucid' }],
      ['a run that did not qualify the application', { applicationQualified: false }],
      ['a run with a non-zero final exit', { exitCode: 1 }],
    ])('blocks qualification when the only run is %s', (_name, overrides) => {
      const root = qualificationRoot();
      writeTesterArmyRun(root, overrides);

      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

      expect(report.ok).toBe(false);
      expect(testerArmyCheck(report)).toMatchObject({ status: 'blocked' });
      expect(testerArmyCheck(report).details).toContain('1 run(s) found');
    });

    it.each([
      ['is stale: it ran on another commit', { revision: OTHER_REVISION, buildRevision: OTHER_REVISION }, 'not 0123456789ab'],
      ['tested a build from another source commit', { buildRevision: OTHER_REVISION }, 'its build came from fedcba987654'],
      ['ran on a modified working tree', { workingTree: ' M app.json' }, 'modified working tree'],
      ['saw its source change during the run', { sourceStable: false }, 'source changed'],
      ['tested another APK than the candidate', { apkBytes: 'another apk' }, 'not the candidate APK'],
      ['was filtered with --grep', { args: ['--grep', 'onboarding', '--install-release'] }, 'filtered with --grep'],
      ['was filtered with --tag', { args: ['--tag', '@smoke'] }, 'filtered with --tag'],
      ['was one shard', { args: ['--shard', '1/2'] }, 'filtered with --shard'],
    ])('blocks qualification when the qualified run of the candidate %s', (_name, overrides, reason) => {
      const root = qualificationRoot();
      writeTesterArmyRun(root, overrides);

      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

      expect(report.ok).toBe(false);
      expect(testerArmyCheck(report)).toMatchObject({ status: 'blocked' });
      expect(testerArmyCheck(report).details).toContain(reason);
    });

    // end.json is not covered by files.json, so these runs keep an end.json that
    // says exit 0, qualified, stable and clean: the gate must still read the
    // source snapshots itself.
    it.each([
      ['source-end.json shows a changed file map', { sourceEnd: { files: { 'app.json': sha256('app.json bytes'), 'app/recording.tsx': sha256('edited during the run'), 'package.json': sha256('package.json bytes') } } }, 'source file map changed during the run'],
      ['source-end.json shows a file added during the run', { sourceEnd: { files: { 'app.json': sha256('app.json bytes'), 'app/new.tsx': sha256('new'), 'app/recording.tsx': sha256('recording bytes'), 'package.json': sha256('package.json bytes') } } }, 'source file map changed during the run'],
      ['source-end.json shows a dirty working tree', { sourceEnd: { workingTree: ' M app/recording.tsx' } }, 'source-end.json records a dirty working tree'],
      ['source-end.json names another commit', { sourceEnd: { revision: OTHER_REVISION } }, 'source-end.json names fedcba987654, not 0123456789ab'],
      ['source-end.json has no file map', { sourceEnd: { files: {} } }, 'source-end.json has no source file map'],
    ])('blocks qualification when end.json says OK but %s', (_name, overrides, reason) => {
      const root = qualificationRoot();
      const runDir = writeTesterArmyRun(root, overrides);
      expect(JSON.parse(fs.readFileSync(path.join(root, runDir, 'end.json'), 'utf8'))).toMatchObject({
        exitCode: 0,
        applicationQualified: true,
        stability: { sourceStable: true, sourceClean: true },
      });

      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

      expect(report.ok).toBe(false);
      expect(testerArmyCheck(report)).toMatchObject({ status: 'blocked' });
      expect(testerArmyCheck(report).details).toContain(reason);
    });

    it('blocks qualification when only end.json is rewritten to say OK over a refused run', () => {
      const root = qualificationRoot();
      const runDir = writeTesterArmyRun(root, { sourceEnd: { workingTree: ' M app.json' }, sourceStable: false, sourceClean: false, exitCode: 3, applicationQualified: false });
      writeJson(root, `${runDir}/end.json`, {
        finishedAt: '2026-10-15T10:00:00.000Z',
        exitCode: 0,
        applicationQualified: true,
        stability: { sourceStable: true, sourceClean: true },
      });

      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

      expect(report.ok).toBe(false);
      expect(testerArmyCheck(report)).toMatchObject({ status: 'blocked' });
      expect(testerArmyCheck(report).details).toContain('source-end.json records a dirty working tree');
    });

    it.each([
      ['a file was edited after files.json', (root, runDir) => writeJson(root, `${runDir}/qualification.json`, { revision: RUN_REVISION, target: 'dreamer-android', passed: [{}, {}] }), 'EVIDENCE_CHANGED'],
      ['a file was added after files.json', (root, runDir) => writeFile(root, `${runDir}/results/extra.txt`, 'x'), 'EVIDENCE_CHANGED'],
      ['a file listed in files.json is gone', (root, runDir) => fs.rmSync(path.join(root, runDir, 'results/release/trace.md')), 'EVIDENCE_CHANGED'],
      ['files.json is missing', (root, runDir) => fs.rmSync(path.join(root, runDir, 'files.json')), 'files.json is missing'],
      ['a required file is missing', (root, runDir) => fs.rmSync(path.join(root, runDir, 'report.json')), 'report.json is missing'],
    ])('blocks qualification when %s (engine verifyEvidenceFiles)', (_name, tamper, reason) => {
      const root = qualificationRoot();
      const runDir = writeTesterArmyRun(root);
      tamper(root, runDir);

      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

      expect(report.ok).toBe(false);
      expect(testerArmyCheck(report)).toMatchObject({ status: 'blocked' });
      expect(testerArmyCheck(report).details).toContain(reason);
    });

    it('blocks qualification without the candidate APK to compare', () => {
      const root = qualificationRoot();
      writeTesterArmyRun(root);
      delete process.env.QA_ANDROID_RELEASE_APK;

      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

      expect(testerArmyCheck(report)).toMatchObject({ status: 'blocked' });
      expect(testerArmyCheck(report).details).toContain('QA_ANDROID_RELEASE_APK is not set');
    });

    it('blocks qualification when the current commit cannot be read', () => {
      const root = qualificationRoot();
      writeTesterArmyRun(root);

      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools({ gitHead: null }) });

      expect(testerArmyCheck(report)).toMatchObject({ status: 'blocked' });
      expect(testerArmyCheck(report).details).toContain('the current commit cannot be read');
    });

    it('accepts an older qualified run when a newer run of the candidate failed', () => {
      const root = qualificationRoot();
      writeTesterArmyRun(root, { name: '1760000000000-1-good' });
      writeTesterArmyRun(root, { name: '1760000999999-2-failed', applicationQualified: false, exitCode: 1 });

      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

      expect(testerArmyCheck(report)).toMatchObject({ status: 'pass' });
      expect(testerArmyCheck(report).details).toContain('1760000000000-1-good');
    });

    it('ignores an unreadable run record', () => {
      const root = qualificationRoot();
      writeFile(root, 'tools/e2e/.e2e/dreamer-android/1760000000001-1-broken/end.json', '{not json');

      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

      expect(testerArmyCheck(report)).toMatchObject({ status: 'blocked' });
    });

    it('defers the run to qualification during prebuild', () => {
      const root = setupFixture({ versionCode: 41 });
      fs.rmSync(path.join(root, 'tools/e2e/.e2e'), { recursive: true });

      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools(), phase: 'prebuild' });

      expect(report.ok).toBe(true);
      expect(testerArmyCheck(report)).toMatchObject({ status: 'manual' });
      expect(testerArmyCheck(report).details).toContain('versionCode 41');
    });

    it('lists the real voice journey as an optional manual checklist', () => {
      const report = checkAndroidReleaseGates({ rootDir: qualificationRoot(), spawn: spawnWithTools() });

      expect(voiceCheck(report)).toMatchObject({ status: 'manual' });
      expect(voiceCheck(report).remediation).toContain('doc_web_interne/docs/android-release-checklist.md');
    });

    it('passes strict qualification with the voice check left manual (owner decision 2026-10-17)', () => {
      const root = qualificationRoot();
      writeTesterArmyRun(root);

      const report = checkAndroidReleaseGates({ rootDir: root, spawn: spawnWithTools() });

      expect(voiceCheck(report)).toMatchObject({ status: 'manual' });
      expect(testerArmyCheck(report)).toMatchObject({ status: 'pass' });
      expect(report.ok).toBe(true);
    });
  });

  it('fails when the RevenueCat subscription release gate is still red', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools({ subscriptionGateStatus: 1 }),
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'fail' &&
          check.title === 'RevenueCat subscription QA release gate' &&
          check.details.includes('assertions: 1/3') &&
          check.remediation.includes('single final verdict')
      )
    ).toBe(true);
  });

  it('blocks when Android CLI tooling is unavailable', () => {
    const root = setupFixture();
    const spawn = () => ({ status: 1, stdout: '', stderr: '' });

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn,
      env: { HOME: path.join(root, 'missing-home') },
      existsSync: () => false,
    });

    expect(report.ok).toBe(false);
    expect(report.checks.some((check) => check.status === 'blocked' && check.title.includes('adb'))).toBe(true);
    expect(formatReport(report)).toContain('BLOCKED');
  });

  it('surfaces wireless debugging services when adb has no ready device', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools({
        adbDevices: false,
        adbMdnsStdout:
          'List of discovered mdns services\nadb-123._adb-tls-pairing._tcp.\t_adb-tls-pairing._tcp.\t192.168.1.24:37123\n',
        adbUsbStdout: '"USB Product Name" = "POCO F8 Ultra"\n"USB Vendor Name" = "Xiaomi"\n',
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Android ADB device visibility' &&
          check.details.includes('USB visible') &&
          check.details.includes('wireless debugging is visible') &&
          check.details.includes('192.168.1.24:37123') &&
          check.remediation.includes('adb pair')
      )
    ).toBe(true);
  });

  it('surfaces missing USB and missing wireless diagnostics when no adb device is ready', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools({
        adbDevices: false,
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Android ADB device visibility' &&
          check.details.includes('USB not visible') &&
          check.details.includes('ADB mDNS does not show wireless debugging services')
      )
    ).toBe(true);
  });

  it('prioritizes USB debugging authorization when macOS sees a phone but adb has no ready device', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools({
        adbDevices: false,
        adbUsbStdout: '"USB Product Name" = "POCO F8 Ultra"\n"USB Vendor Name" = "Xiaomi"\n',
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Android ADB device visibility' &&
          check.details.includes('USB visible') &&
          check.remediation.includes('accept the RSA fingerprint prompt') &&
          check.remediation.includes('revoke USB debugging authorizations')
      )
    ).toBe(true);
  });

  it('does not treat emulator mDNS as phone wireless debugging', () => {
    const root = setupFixture();
    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools({
        adbDevices: false,
        adbMdnsStdout:
          'List of discovered mdns services\nadb-EMULATOR36X5X11X0\t_adb._tcp\t10.0.2.16:5555\n',
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'blocked' &&
          check.title === 'Android ADB device visibility' &&
          check.details.includes('ADB mDNS only sees 1 emulator service') &&
          !check.details.includes('wireless debugging is visible') &&
          check.remediation.includes('emulator mDNS services are ignored')
      )
    ).toBe(true);
  });

  it('uses adb from the standard macOS Android SDK location when PATH misses it', () => {
    const root = setupFixture();
    writeGooglePlayTrackSnapshot(root, 33);
    const fakeHome = path.join(root, 'home');
    const adbPath = path.join(fakeHome, 'Library/Android/sdk/platform-tools/adb');
    writeFile(root, 'home/Library/Android/sdk/platform-tools/adb', '');
    const spawn = (command, args) => {
      if (command === 'git' && args[0] === 'rev-parse') return { status: 0, stdout: `${RUN_REVISION}\n`, stderr: '' };
      if (command === 'which' && args[0] === 'adb') return { status: 1 };
      if (npmRunScript(args) === 'subscription:qa:release-gate') {
        return { status: 0, stdout: 'ok\n', stderr: '' };
      }
      if (command === adbPath && args[0] === 'devices') {
        return {
          status: 0,
          stdout: 'List of devices attached\nemulator-5554\tdevice\n',
        };
      }
      return { status: 1, stdout: '', stderr: '' };
    };

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn,
      env: { HOME: fakeHome, QA_ANDROID_RELEASE_APK: CANDIDATE_APK },
      platform: 'darwin',
    });

    expect(report.ok).toBe(true);
    expect(
      report.checks.some(
        (check) => check.status === 'pass' && check.details.includes(adbPath)
      )
    ).toBe(true);
  });

  it('fails when Play Integrity env is missing from an EAS profile', () => {
    const root = setupFixture();
    const eas = validEasJson();
    delete eas.build.production.env.EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER;
    writeJson(root, 'eas.json', eas);

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools(),
    });

    expect(report.ok).toBe(false);
    expect(report.checks.some((check) => check.status === 'fail' && check.details.includes('production'))).toBe(true);
  });

  it('fails when monthly analysis and image bundles are disabled in production', () => {
    const root = setupFixture();
    const eas = validEasJson();
    delete eas.build.production.env.EXPO_PUBLIC_ANALYSIS_JOBS_ENABLED;
    writeJson(root, 'eas.json', eas);

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools(),
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'fail' &&
          check.title === 'Monthly analysis and image bundles enabled in EAS profiles' &&
          check.details.includes('production')
      )
    ).toBe(true);
  });

  it('fails when Test Store debuggability is not isolated from Play profiles', () => {
    const root = setupFixture();
    const eas = validEasJson();
    eas.build.preview = {
      env: {
        ...eas.build.preview.env,
        NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE: 'true',
      },
    };
    writeJson(root, 'eas.json', eas);

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools(),
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'fail' &&
          check.title === 'RevenueCat Test Store debuggability isolated in EAS profiles' &&
          check.details.includes('preview')
      )
    ).toBe(true);
  });

  it('fails when the Test Store profile is not explicitly debuggable', () => {
    const root = setupFixture();
    const eas = validEasJson();
    delete eas.build['revenuecat-teststore'].env.NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE;
    writeJson(root, 'eas.json', eas);

    const report = checkAndroidReleaseGates({
      rootDir: root,
      spawn: spawnWithTools(),
    });

    expect(report.ok).toBe(false);
    expect(
      report.checks.some(
        (check) =>
          check.status === 'fail' &&
          check.title === 'RevenueCat Test Store debuggability isolated in EAS profiles' &&
          check.details.includes('revenuecat-teststore')
      )
    ).toBe(true);
  });
});
