'use strict';
/* global describe, expect, it, jest */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  assertInstalledReleaseBinary,
  assertReleaseSuiteDoesNotStartMetro,
  assertVoiceFlowAuthorization,
  assertSensitiveFlowAuthorization,
  buildMaestroEnv,
  buildMaestroFlowEnvArgs,
  buildMaestroFlowRedactions,
  buildMaestroFlowSourceEnv,
  createRedactingWriter,
  decodeExactRegexLiteral,
  getMaestroArtifactPolicy,
  getSensitiveFlowGuardToken,
  normalizeFlow,
  parseInstalledAndroidBuild,
  readExpectedAndroidBuild,
  redactSensitiveText,
  runCommand,
  sanitizeMaestroArtifacts,
  SENSITIVE_FLOW_GUARD_ENV,
  shouldBlockNextSensitiveFlow,
  TESTSTORE_READINESS_FLOW,
  verifyInstalledReleaseBinary,
} = require('./run-maestro-android');

const EXPECTED = {
  packageName: 'com.tanuki75.noctalia',
  versionName: '3.0.1',
  versionCode: '38',
};

const RELEASE_DUMPSYS = `
  Package [com.tanuki75.noctalia] (abc123):
    versionCode=38 minSdk=33 targetSdk=36
    versionName=3.0.1
    pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]
`;

describe('run-maestro-android Release preflight', () => {
  it('reads the expected Android package and versions from app.json', () => {
    const readFileSync = jest.fn(() => JSON.stringify({
      expo: {
        version: '3.0.1',
        android: {
          package: 'com.tanuki75.noctalia',
          versionCode: 38,
        },
      },
    }));

    expect(readExpectedAndroidBuild('/repo', readFileSync)).toEqual(EXPECTED);
    expect(readFileSync).toHaveBeenCalledWith('/repo/app.json', 'utf8');
  });

  it('matches the current release metadata declared in app.json', () => {
    const appConfig = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', 'app.json'), 'utf8')
    ).expo;

    expect(readExpectedAndroidBuild()).toEqual({
      packageName: appConfig.android.package,
      versionName: appConfig.version,
      versionCode: String(appConfig.android.versionCode),
    });
  });

  it('requires one explicit target for the state-clearing voice flow', () => {
    const flows = ['maestro/release-auth-voice-analysis.yml'];

    expect(() => assertVoiceFlowAuthorization(flows, { devices: null }))
      .toThrow('exactly one explicit --device target');
    expect(() => assertVoiceFlowAuthorization(flows, { devices: ['one', 'two'] }))
      .toThrow('exactly one explicit --device target');
    expect(() => assertVoiceFlowAuthorization(flows, { devices: ['one'] }))
      .not.toThrow();
    expect(() => assertVoiceFlowAuthorization(['maestro/release-smoke.yml'], { devices: null }))
      .not.toThrow();
  });

  it('accepts an exact, non-debuggable installed Release build', () => {
    const installed = parseInstalledAndroidBuild(RELEASE_DUMPSYS);

    expect(assertInstalledReleaseBinary('emulator-5554', EXPECTED, installed))
      .toEqual({
        ...EXPECTED,
        packageFlagsAvailable: true,
        debuggable: false,
      });
  });

  it('refuses a stale installed build', () => {
    const installed = parseInstalledAndroidBuild(
      RELEASE_DUMPSYS
        .replace('versionCode=38', 'versionCode=37')
        .replace('versionName=3.0.1', 'versionName=2.0.3')
    );

    expect(() => assertInstalledReleaseBinary('emulator-5554', EXPECTED, installed))
      .toThrow('versionName 2.0.3 (expected 3.0.1); versionCode 37 (expected 38)');
  });

  it('refuses a debuggable build that could use Metro', () => {
    const installed = parseInstalledAndroidBuild(
      RELEASE_DUMPSYS.replace(
        'pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]',
        'pkgFlags=[ HAS_CODE DEBUGGABLE ALLOW_CLEAR_USER_DATA ]'
      )
    );

    expect(() => assertInstalledReleaseBinary('emulator-5554', EXPECTED, installed))
      .toThrow('installed package is DEBUGGABLE and may depend on Metro');
  });

  it('requires the dedicated debuggable binary for RevenueCat Test Store', () => {
    const debuggable = parseInstalledAndroidBuild(
      RELEASE_DUMPSYS.replace(
        'pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]',
        'pkgFlags=[ HAS_CODE DEBUGGABLE ALLOW_CLEAR_USER_DATA ]'
      )
    );

    expect(assertInstalledReleaseBinary(
      'emulator-5554',
      EXPECTED,
      debuggable,
      { expectedDebuggable: true }
    )).toMatchObject({ debuggable: true });

    const nonDebuggable = parseInstalledAndroidBuild(RELEASE_DUMPSYS);
    expect(() => assertInstalledReleaseBinary(
      'emulator-5554',
      EXPECTED,
      nonDebuggable,
      { expectedDebuggable: true }
    )).toThrow('RevenueCat Test Store rejects release binaries');
  });

  it('requires Release runs to leave Metro untouched and unused', () => {
    expect(() => assertReleaseSuiteDoesNotStartMetro({
      suite: 'release',
      startMetro: true,
    })).toThrow('requires --no-start-metro');
    expect(() => assertReleaseSuiteDoesNotStartMetro({
      suite: 'release',
      startMetro: false,
    })).not.toThrow();
    expect(() => assertReleaseSuiteDoesNotStartMetro({
      suite: 'release-analysis',
      startMetro: true,
    })).toThrow('requires --no-start-metro');
  });

  it('forwards exact QA identity selectors without exposing unrelated env', () => {
    const previous = {
      QA_EMAIL: process.env.QA_EMAIL,
      QA_EMAIL_REGEX: process.env.QA_EMAIL_REGEX,
      QA_PASSWORD: process.env.QA_PASSWORD,
      QA_SYNC_SENTINEL: process.env.QA_SYNC_SENTINEL,
      QA_PAID_EMAIL_REGEX: process.env.QA_PAID_EMAIL_REGEX,
      QA_SWITCH_FREE_PASSWORD: process.env.QA_SWITCH_FREE_PASSWORD,
      REVENUECAT_QA_SWITCH_FREE_EMAIL: process.env.REVENUECAT_QA_SWITCH_FREE_EMAIL,
      REVENUECAT_QA_SWITCH_FREE_PASSWORD: process.env.REVENUECAT_QA_SWITCH_FREE_PASSWORD,
      REVENUECAT_QA_EMAIL: process.env.REVENUECAT_QA_EMAIL,
      REVENUECAT_QA_PASSWORD: process.env.REVENUECAT_QA_PASSWORD,
      REVENUECAT_QA_APPROVAL: process.env.REVENUECAT_QA_APPROVAL,
      UPGRADE_SENTINEL: process.env.UPGRADE_SENTINEL,
      SECRET_NOT_FOR_MAESTRO: process.env.SECRET_NOT_FOR_MAESTRO,
    };
    process.env.QA_EMAIL = 'tester@example.com';
    process.env.QA_EMAIL_REGEX = '^tester@example\\.com$';
    process.env.QA_PASSWORD = 'email-secret';
    process.env.QA_SYNC_SENTINEL = 'Release authenticated offline sync 123';
    process.env.QA_PAID_EMAIL_REGEX = '^paid@example\\.com$';
    process.env.QA_SWITCH_FREE_PASSWORD = 'switch-secret';
    process.env.REVENUECAT_QA_SWITCH_FREE_EMAIL = 'release-auth@example.com';
    process.env.REVENUECAT_QA_SWITCH_FREE_PASSWORD = 'release-auth-secret';
    process.env.REVENUECAT_QA_EMAIL = 'wrapper-only@example.com';
    process.env.REVENUECAT_QA_PASSWORD = 'wrapper-only-secret';
    process.env.REVENUECAT_QA_APPROVAL = 'wrapper-only-approval';
    process.env.UPGRADE_SENTINEL = 'UPGRADE_V33_V34_TEST';
    process.env.SECRET_NOT_FOR_MAESTRO = 'do-not-forward';

    try {
      expect(buildMaestroFlowEnvArgs(
        'maestro/subscription-teststore-purchase-manual.yml'
      )).toEqual(expect.arrayContaining([
        '-e',
        'QA_EMAIL=tester@example.com',
        'QA_EMAIL_REGEX=^tester@example\\.com$',
        'QA_PASSWORD=email-secret',
      ]));
      expect(buildMaestroFlowEnvArgs(
        'maestro/subscription-teststore-purchase-google-manual.yml'
      ).join(' ')).not.toContain('QA_PASSWORD');
      expect(buildMaestroFlowEnvArgs(
        'maestro/subscription-teststore-purchase-google-manual.yml'
      ).join(' ')).not.toContain('QA_EMAIL=tester@example.com');
      expect(buildMaestroFlowEnvArgs(
        'maestro/subscription-teststore-restore-google-manual.yml'
      ).join(' ')).not.toContain('switch-secret');
      expect(buildMaestroFlowEnvArgs(
        'maestro/android-play-upgrade-seed-v33.yml'
      )).toEqual([
        '-e',
        'UPGRADE_SENTINEL=UPGRADE_V33_V34_TEST',
      ]);
      expect(buildMaestroFlowEnvArgs(
        'maestro/android-play-upgrade-seed-v33.yml'
      ).join(' ')).not.toContain('QA_EMAIL');
      expect(buildMaestroFlowEnvArgs(
        'maestro/android-play-upgrade-seed-v33.yml'
      ).join(' ')).not.toContain('do-not-forward');
      expect(buildMaestroFlowEnvArgs(
        'maestro/release-auth-analysis.yml'
      )).toEqual([
        '-e',
        'REVENUECAT_QA_SWITCH_FREE_EMAIL=release-auth@example.com',
        '-e',
        'REVENUECAT_QA_SWITCH_FREE_PASSWORD=release-auth-secret',
      ]);
      expect(buildMaestroFlowEnvArgs(
        'maestro/release-auth-voice-analysis.yml'
      )).toEqual(buildMaestroFlowEnvArgs('maestro/release-auth-analysis.yml'));
      expect(buildMaestroFlowEnvArgs(
        'maestro/subscription-teststore-paywall-auth.yml'
      )).toEqual(buildMaestroFlowEnvArgs('maestro/release-auth-analysis.yml'));
      expect(buildMaestroFlowEnvArgs(
        'maestro/release-auth-offline-sync.yml'
      )).toEqual([
        '-e',
        'QA_SYNC_SENTINEL=Release authenticated offline sync 123',
        ...buildMaestroFlowEnvArgs('maestro/release-auth-analysis.yml'),
      ]);

      const maestroEnv = buildMaestroEnv({
        ...process.env,
        MAESTRO_RUNNER_HOME: '/tmp/noctalia-maestro-env-test',
        [SENSITIVE_FLOW_GUARD_ENV]: 'internal-token',
      });
      expect(maestroEnv.QA_EMAIL).toBeUndefined();
      expect(maestroEnv.QA_PASSWORD).toBeUndefined();
      expect(maestroEnv.QA_SYNC_SENTINEL).toBeUndefined();
      expect(maestroEnv.QA_SWITCH_FREE_PASSWORD).toBeUndefined();
      expect(maestroEnv.REVENUECAT_QA_SWITCH_FREE_EMAIL).toBeUndefined();
      expect(maestroEnv.REVENUECAT_QA_SWITCH_FREE_PASSWORD).toBeUndefined();
      expect(maestroEnv.REVENUECAT_QA_EMAIL).toBeUndefined();
      expect(maestroEnv.REVENUECAT_QA_PASSWORD).toBeUndefined();
      expect(maestroEnv.REVENUECAT_QA_APPROVAL).toBeUndefined();
      expect(maestroEnv.UPGRADE_SENTINEL).toBeUndefined();
      expect(maestroEnv[SENSITIVE_FLOW_GUARD_ENV]).toBeUndefined();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('generates a fresh offline-sync sentinel while preserving an explicit override', () => {
    expect(buildMaestroFlowSourceEnv(
      'maestro/release-auth-offline-sync.yml',
      { KEEP_ME: 'yes' },
      () => 1783707000000
    )).toEqual({
      KEEP_ME: 'yes',
      QA_SYNC_SENTINEL: 'Release authenticated offline sync 1783707000000',
    });

    expect(buildMaestroFlowSourceEnv(
      'maestro/release-auth-offline-sync.yml',
      { QA_SYNC_SENTINEL: 'explicit sentinel' },
      () => 1783707000000
    ).QA_SYNC_SENTINEL).toBe('explicit sentinel');
    expect(buildMaestroFlowSourceEnv(
      'maestro/release-smoke.yml',
      {},
      () => 1783707000000
    ).QA_SYNC_SENTINEL).toBeUndefined();
  });

  it('derives redactions for email/password values and their serialized forms only', () => {
    const env = {
      QA_EMAIL: 'Qa+User@Example.COM',
      QA_EMAIL_REGEX: '^Qa\\+User@Example\\.COM$',
      QA_PASSWORD: 'S3cr"et\\value!',
      QA_PLAN: 'annual',
    };

    expect(decodeExactRegexLiteral(env.QA_EMAIL_REGEX)).toBe(env.QA_EMAIL);
    expect(decodeExactRegexLiteral('.*@example\\.com')).toBeNull();

    const redactions = buildMaestroFlowRedactions(
      'maestro/subscription-teststore-purchase-manual.yml',
      env
    );
    const serializedPassword = JSON.stringify(env.QA_PASSWORD).slice(1, -1);
    const serializedEmailRegex = JSON.stringify(env.QA_EMAIL_REGEX).slice(1, -1);
    const input = [
      `-e QA_EMAIL=${env.QA_EMAIL}`,
      `-e QA_EMAIL_REGEX=${env.QA_EMAIL_REGEX}`,
      `typed=${env.QA_EMAIL.toLowerCase()}`,
      `password=${env.QA_PASSWORD}`,
      `json-password=${serializedPassword}`,
      `json-regex=${serializedEmailRegex}`,
      `QA_PLAN=${env.QA_PLAN}`,
    ].join('\n');
    const output = redactSensitiveText(input, redactions);

    expect(output).not.toContain(env.QA_EMAIL);
    expect(output).not.toContain(env.QA_EMAIL.toLowerCase());
    expect(output).not.toContain(env.QA_EMAIL_REGEX);
    expect(output).not.toContain(env.QA_PASSWORD);
    expect(output).not.toContain(serializedPassword);
    expect(output).not.toContain(serializedEmailRegex);
    expect(output).toContain('<redacted:qa-identity>');
    expect(output).toContain('<redacted:qa-secret>');
    expect(output).toContain('QA_PLAN=annual');
  });

  it('redacts secrets split across stdout chunks without losing diagnostics', () => {
    const redactions = [
      { value: 'qa+user@example.com', replacement: '<redacted:qa-identity>' },
      { value: 'S3cret!', replacement: '<redacted:qa-secret>' },
    ];
    let output = '';
    const writer = createRedactingWriter((chunk) => {
      output += chunk;
    }, redactions);

    writer.write(Buffer.from('Starting login qa+us'));
    writer.write(Buffer.from('er@example.com\nAssertion still useful; password=S3'));
    writer.write(Buffer.from('cret!\n'));
    writer.end();

    expect(output).toBe([
      'Starting login <redacted:qa-identity>',
      'Assertion still useful; password=<redacted:qa-secret>',
      '',
    ].join('\n'));
  });

  it('captures and redacts a child process stdout and stderr before forwarding them', async () => {
    const redactions = [
      { value: 'qa+user@example.com', replacement: '<redacted:qa-identity>' },
      { value: 'S3cret!', replacement: '<redacted:qa-secret>' },
    ];
    let stdout = '';
    let stderr = '';
    const result = await runCommand(process.execPath, [
      '-e',
      [
        "process.stdout.write('account=qa+us')",
        "process.stdout.write('er@example.com\\nnon-sensitive stdout\\n')",
        "process.stderr.write('password=S3')",
        "process.stderr.write('cret!\\nnon-sensitive stderr\\n')",
      ].join(';'),
    ], {
      redactions,
      stdoutWriter: (chunk) => {
        stdout += chunk;
      },
      stderrWriter: (chunk) => {
        stderr += chunk;
      },
    });

    expect(result).toMatchObject({ ok: true, code: 0 });
    expect(stdout).toBe('account=<redacted:qa-identity>\nnon-sensitive stdout\n');
    expect(stderr).toBe('password=<redacted:qa-secret>\nnon-sensitive stderr\n');
  });

  it('redacts an email from Test Store output without an explicit identity env', async () => {
    let stdout = '';
    const result = await runCommand(process.execPath, [
      '-e',
      [
        "process.stdout.write('account=qa+us')",
        "process.stdout.write('er@example.com\\n')",
      ].join(';'),
    ], {
      redactEmails: true,
      stdoutWriter: (chunk) => {
        stdout += chunk;
      },
    });

    expect(result).toMatchObject({ ok: true, code: 0 });
    expect(stdout).toBe('account=<redacted:email>\n');
  });

  it('redacts Maestro text artifacts and removes images only inside a credential flow', () => {
    const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-maestro-redaction-'));
    const nested = path.join(outputRoot, 'nested');
    fs.mkdirSync(nested);
    const env = {
      QA_EMAIL: 'qa+user@example.com',
      QA_EMAIL_REGEX: '^qa\\+user@example\\.com$',
      QA_PASSWORD: 'S3cr"et\\value!',
      QA_PLAN: 'annual',
    };
    const redactions = buildMaestroFlowRedactions(
      'maestro/subscription-teststore-purchase-manual.yml',
      env
    );
    const logPath = path.join(outputRoot, 'maestro.log');
    const commandsPath = path.join(nested, 'commands-(flow.yml).json');
    const pngPath = path.join(outputRoot, 'screenshot-failure.png');
    const jpgPath = path.join(nested, 'screenshot-warning.jpg');
    const binaryPath = path.join(outputRoot, 'diagnostic.bin');

    try {
      fs.writeFileSync(
        logPath,
        `Assertion failed at step 7\nQA_EMAIL=${env.QA_EMAIL}\nQA_PASSWORD=${env.QA_PASSWORD}\nQA_PLAN=annual\n`,
        'utf8'
      );
      fs.writeFileSync(commandsPath, JSON.stringify({
        command: ['-e', `QA_EMAIL_REGEX=${env.QA_EMAIL_REGEX}`],
        evaluatedInput: env.QA_PASSWORD,
        diagnostic: 'element auth.submit not found',
      }, null, 2), 'utf8');
      fs.writeFileSync(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      fs.writeFileSync(jpgPath, Buffer.from([0xff, 0xd8, 0xff]));
      fs.writeFileSync(binaryPath, Buffer.from([0x00, 0x01, 0x02]));

      expect(sanitizeMaestroArtifacts(outputRoot, redactions)).toEqual({
        textFilesScanned: 2,
        textFilesRedacted: 2,
        screenshotsRemoved: 2,
      });

      const log = fs.readFileSync(logPath, 'utf8');
      const commandsText = fs.readFileSync(commandsPath, 'utf8');
      const commands = JSON.parse(commandsText);
      expect(log).not.toContain(env.QA_EMAIL);
      expect(log).not.toContain(env.QA_PASSWORD);
      expect(log).toContain('Assertion failed at step 7');
      expect(log).toContain('QA_PLAN=annual');
      expect(commandsText).not.toContain(env.QA_EMAIL_REGEX);
      expect(commandsText).not.toContain(JSON.stringify(env.QA_EMAIL_REGEX).slice(1, -1));
      expect(commandsText).not.toContain(JSON.stringify(env.QA_PASSWORD).slice(1, -1));
      expect(commands.diagnostic).toBe('element auth.submit not found');
      expect(fs.existsSync(pngPath)).toBe(false);
      expect(fs.existsSync(jpgPath)).toBe(false);
      expect(fs.readFileSync(binaryPath)).toEqual(Buffer.from([0x00, 0x01, 0x02]));
    } finally {
      fs.rmSync(outputRoot, { recursive: true, force: true });
    }
  });

  it('redacts discovered emails and removes screenshots for a guarded suite without env values', () => {
    const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-maestro-generic-redaction-'));
    const logPath = path.join(outputRoot, 'maestro.log');
    const pngPath = path.join(outputRoot, 'screenshot-failure.png');

    try {
      fs.writeFileSync(logPath, 'signed in as qa+user@example.com\n', 'utf8');
      fs.writeFileSync(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      expect(sanitizeMaestroArtifacts(outputRoot, [], { removeScreenshots: true }))
        .toEqual({
          textFilesScanned: 1,
          textFilesRedacted: 1,
          screenshotsRemoved: 1,
        });
      expect(fs.readFileSync(logPath, 'utf8')).toBe('signed in as <redacted:email>\n');
      expect(fs.existsSync(pngPath)).toBe(false);
    } finally {
      fs.rmSync(outputRoot, { recursive: true, force: true });
    }
  });

  it('forces private artifacts for every Release Test Store flow', () => {
    expect(getMaestroArtifactPolicy('release-teststore', [])).toEqual({
      redactEmails: true,
      removeScreenshots: true,
    });
    expect(getMaestroArtifactPolicy('release', [])).toEqual({
      redactEmails: false,
      removeScreenshots: false,
    });
    expect(getMaestroArtifactPolicy('release', [
      { value: 'qa@example.com', replacement: '<redacted:qa-identity>' },
    ])).toEqual({
      redactEmails: false,
      removeScreenshots: true,
    });
  });

  it('requires wrapper authorization and non-destructive readiness before sensitive flows', () => {
    const flow = 'maestro/subscription-teststore-purchase-manual.yml';
    const token = getSensitiveFlowGuardToken(flow);
    const releaseOptions = {
      suite: 'release-teststore',
      startMetro: false,
      devices: ['emulator-5554'],
    };

    expect(() => assertSensitiveFlowAuthorization([flow], releaseOptions, {
      [SENSITIVE_FLOW_GUARD_ENV]: token,
    })).toThrow(TESTSTORE_READINESS_FLOW);
    expect(() => assertSensitiveFlowAuthorization([
      TESTSTORE_READINESS_FLOW,
      flow,
    ], releaseOptions, {})).toThrow('use its guarded wrapper');
    expect(() => assertSensitiveFlowAuthorization([
      TESTSTORE_READINESS_FLOW,
      flow,
    ], releaseOptions, {
      [SENSITIVE_FLOW_GUARD_ENV]: token,
    })).not.toThrow();
    expect(() => assertSensitiveFlowAuthorization([
      TESTSTORE_READINESS_FLOW,
      flow,
    ], { suite: 'core', startMetro: false, devices: ['emulator-5554'] }, {
      [SENSITIVE_FLOW_GUARD_ENV]: token,
    })).toThrow('require the release-teststore suite');
    expect(() => assertSensitiveFlowAuthorization([
      TESTSTORE_READINESS_FLOW,
      flow,
    ], { suite: 'release-teststore', startMetro: false, devices: null }, {
      [SENSITIVE_FLOW_GUARD_ENV]: token,
    })).toThrow('exactly one explicit --device');
  });

  it('canonicalizes flow aliases before applying sensitive-flow guards', () => {
    expect(normalizeFlow('./maestro/subscription-teststore-purchase-manual.yml'))
      .toBe('maestro/subscription-teststore-purchase-manual.yml');
  });

  it('blocks a sensitive action when its readiness flow fails', () => {
    expect(shouldBlockNextSensitiveFlow(
      { ok: false },
      'maestro/subscription-teststore-purchase-manual.yml'
    )).toBe(true);
    expect(shouldBlockNextSensitiveFlow(
      { ok: true },
      'maestro/subscription-teststore-purchase-manual.yml'
    )).toBe(false);
  });

  it('inspects the selected device before accepting its installed build', () => {
    const spawn = jest.fn(() => ({
      status: 0,
      stdout: RELEASE_DUMPSYS,
      stderr: '',
    }));

    expect(verifyInstalledReleaseBinary('emulator-5554', EXPECTED, {
      adbBin: '/sdk/adb',
      spawn,
    })).toMatchObject(EXPECTED);
    expect(spawn).toHaveBeenCalledWith(
      '/sdk/adb',
      [
        '-s',
        'emulator-5554',
        'shell',
        'dumpsys',
        'package',
        'com.tanuki75.noctalia',
      ],
      expect.objectContaining({ encoding: 'utf8' })
    );
  });
});
