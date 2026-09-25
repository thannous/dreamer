const {
  checkNodeSyntaxFiles,
  exitCodeForUnexpectedStatus,
  getResultError,
  runReportCommand,
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


  it('parses every CommonJS source in one process and reports syntax errors', () => {
    const valid = checkNodeSyntaxFiles(['valid.js'], {
      cwd: '/tmp',
      readFile: () => '#!/usr/bin/env node\n\'use strict\';\nconst value = 1;\n',
    });
    const invalid = checkNodeSyntaxFiles(['invalid.js'], {
      cwd: '/tmp',
      readFile: () => 'const value = ;',
    });

    expect(valid).toEqual({ status: 0, stdout: '', stderr: '' });
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('Unexpected token');
  });

  it('runs report commands through the exported generator with the same args and env', () => {
    const generateReport = jest.fn(() => ({ exitCode: 1, stdout: 'strict report', stderr: '' }));
    const result = runReportCommand(
      {
        args: ['scripts/subscription-qa-report.js', '--require-full'],
      },
      {
        cwd: '/repo',
        env: { QA: 'isolated' },
        generateReport,
      }
    );

    expect(generateReport).toHaveBeenCalledWith({
      root: '/repo',
      args: ['--require-full'],
      env: { QA: 'isolated' },
    });
    expect(result).toEqual({ status: 1, stdout: 'strict report', stderr: '' });
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

  it('runs batched syntax and report checks without spawning subprocesses', () => {
    const stdout = memoryStream();
    const stderr = memoryStream();
    const spawn = jest.fn(() => {
      throw new Error('unexpected subprocess');
    });
    const syntaxCheck = jest.fn(() => ({ status: 0, stdout: '', stderr: '' }));
    const generateReport = jest.fn(() => ({ exitCode: 0, stdout: 'report ok', stderr: '' }));
    const status = runCommands(
      [
        { type: 'syntax-batch', label: 'syntax', files: ['one.js'] },
        {
          type: 'report',
          label: 'report',
          command: process.execPath,
          args: ['scripts/subscription-qa-report.js'],
          expectedStdoutIncludes: ['report ok'],
        },
      ],
      { cwd: '/repo', baseEnv: {}, spawn, syntaxCheck, generateReport, stdout, stderr }
    );

    expect(status).toBe(0);
    expect(syntaxCheck).toHaveBeenCalledWith(['one.js'], { cwd: '/repo' });
    expect(generateReport).toHaveBeenCalledTimes(1);
    expect(spawn).not.toHaveBeenCalled();
    expect(stderr.value()).toBe('');
  });
});
