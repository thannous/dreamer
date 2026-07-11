'use strict';
/* global describe, expect, it, jest */

const {
  checkJestDurationRegression,
  compareDurations,
  escapeWorkflowCommand,
  getJestDurationMs,
  parseArgs,
} = require('./check-jest-duration-regression');

function jestResult(startTime, endTime) {
  return {
    startTime,
    testResults: [
      { endTime: startTime + 100 },
      { endTime },
    ],
  };
}

describe('check-jest-duration-regression', () => {
  it('extracts wall duration from raw Jest JSON', () => {
    expect(getJestDurationMs(jestResult(1_000, 2_500))).toBe(1_500);
  });

  it('allows a duration exactly at the 20% limit', () => {
    expect(compareDurations(1_200, 1_000)).toMatchObject({
      deltaRatio: 0.2,
      limitMs: 1_200,
      passed: true,
    });
  });

  it('fails a duration above the 20% limit', () => {
    expect(compareDurations(1_201, 1_000)).toMatchObject({
      passed: false,
      threshold: 0.2,
    });
  });

  it('fails with a GitHub error when no master baseline exists', () => {
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    const current = JSON.stringify(jestResult(1_000, 2_500));
    const fsImpl = {
      existsSync: () => false,
      readFileSync: (filePath) => {
        expect(filePath).toBe('current.json');
        return current;
      },
    };

    expect(checkJestDurationRegression({
      baselinePath: 'baseline.json',
      currentPath: 'current.json',
      env: { GITHUB_ACTIONS: 'true' },
      fsImpl,
      logger,
    })).toEqual({ currentMs: 1_500, passed: false, skipped: true });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('::error title=Jest timing baseline::')
    );
  });

  it('allows an explicit baseline bootstrap', () => {
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    const current = JSON.stringify(jestResult(1_000, 2_500));
    const fsImpl = {
      existsSync: () => false,
      readFileSync: () => current,
    };

    expect(checkJestDurationRegression({
      allowMissingBaseline: true,
      baselinePath: 'baseline.json',
      currentPath: 'current.json',
      fsImpl,
      logger,
    })).toEqual({ currentMs: 1_500, passed: true, skipped: true });
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Baseline bootstrap is explicitly allowed.')
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('reports a regression using injected JSON inputs', () => {
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    const files = {
      'baseline.json': JSON.stringify(jestResult(1_000, 2_000)),
      'current.json': JSON.stringify(jestResult(1_000, 2_300)),
    };
    const fsImpl = {
      existsSync: (filePath) => filePath in files,
      readFileSync: (filePath) => files[filePath],
    };

    const result = checkJestDurationRegression({
      baselinePath: 'baseline.json',
      currentPath: 'current.json',
      fsImpl,
      logger,
    });

    expect(result).toMatchObject({ passed: false, skipped: false });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('delta=+30.0%')
    );
  });

  it('parses custom files and threshold and escapes workflow output', () => {
    expect(parseArgs([
      '--current',
      'now.json',
      '--baseline',
      'before.json',
      '--threshold',
      '0.25',
    ])).toEqual({
      allowMissingBaseline: false,
      baselinePath: 'before.json',
      currentPath: 'now.json',
      threshold: 0.25,
    });
    expect(parseArgs(['--allow-missing-baseline'])).toMatchObject({
      allowMissingBaseline: true,
    });
    expect(escapeWorkflowCommand('bad%\nvalue')).toBe('bad%25%0Avalue');
  });
});
