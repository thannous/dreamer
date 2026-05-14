const {
  commands,
  exitCodeForUnexpectedStatus,
  getResultError,
  runCommands,
} = require('./verify-subscription-qa-local');

function memoryStream() {
  let value = '';
  return {
    write(chunk) {
      value += chunk;
    },
    value() {
      return value;
    },
  };
}

describe('subscription QA local verifier', () => {
  it('requires the QA report to surface current session readiness blockers', () => {
    const reportCommand = commands.find((command) => command.label === 'report: subscription QA coverage');

    expect(reportCommand.expectedStdoutIncludes).toEqual(
      expect.arrayContaining([
        '## Current Session Readiness',
        'Test Store signed-in account env',
        'Account switch second account env',
        'Device app user id extraction',
        'RevenueCat product prodfce10ef2a8 must expose billing period P1M',
      ])
    );
  });

  it('returns a non-zero exit when a command expected to fail exits successfully', () => {
    expect(exitCodeForUnexpectedStatus({ status: 0 })).toBe(1);
    expect(
      getResultError({ label: 'expected failure', expectedStatus: 1 }, { status: 0, stdout: '', stderr: '' })
    ).toMatchObject({
      exitCode: 1,
      messages: ['Subscription QA local verification failed at: expected failure', 'Expected exit 1, got 0.'],
    });
  });

  it('requires expected output for commands with expectedStdoutIncludes', () => {
    expect(
      getResultError(
        { label: 'release gate', expectedStatus: 1, expectedStdoutIncludes: ['Manual or external gates remaining: 7'] },
        { status: 1, stdout: 'Full RevenueCat workflow is not complete', stderr: '' }
      )
    ).toMatchObject({
      exitCode: 1,
      messages: [
        'Subscription QA local verification failed at: release gate',
        'Missing expected output: Manual or external gates remaining: 7',
      ],
    });
  });

  it('rejects forbidden output even when the exit status matches', () => {
    expect(
      getResultError(
        { label: 'release gate', expectedStatus: 1, forbiddenStdoutIncludes: ['Blocked checks:'] },
        { status: 1, stdout: 'Blocked checks: 1', stderr: '' }
      )
    ).toMatchObject({
      exitCode: 1,
      messages: ['Subscription QA local verification failed at: release gate', 'Unexpected output: Blocked checks:'],
    });
  });

  it('runs injected commands and reports success without spawning real npm', () => {
    const stdout = memoryStream();
    const stderr = memoryStream();
    const status = runCommands(
      [
        {
          label: 'fake command',
          command: 'fake',
          args: ['ok'],
          expectedStdoutIncludes: ['done'],
        },
      ],
      {
        cwd: '/tmp',
        baseEnv: {},
        spawn: () => ({ status: 0, stdout: 'done', stderr: '' }),
        stdout,
        stderr,
      }
    );

    expect(status).toBe(0);
    expect(stdout.value()).toContain('Subscription QA local verification passed.');
    expect(stderr.value()).toBe('');
  });
});
