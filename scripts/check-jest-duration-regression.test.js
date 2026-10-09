'use strict';
/* global describe, expect, it, jest */

const {
  checkJestDurationRegression,
  compareDurations,
  escapeWorkflowCommand,
  getJestDurationMs,
  parseArgs,
  updateTimingHistory,
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

  it('keeps the 20% budget strict when bootstrap is allowed and a baseline exists', () => {
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
      allowMissingBaseline: true,
      baselinePath: 'baseline.json',
      currentPath: 'current.json',
      fsImpl,
      logger,
    });

    expect(result).toMatchObject({ passed: false, skipped: false });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('delta=+30.0%')
    );
    expect(logger.log).not.toHaveBeenCalled();
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
      '--history',
      'history.json',
      '--history-limit',
      '3',
      '--threshold',
      '0.25',
    ])).toEqual({
      allowMissingBaseline: false,
      baselinePath: 'before.json',
      currentPath: 'now.json',
      historyLimit: 3,
      historyPath: 'history.json',
      threshold: 0.25,
      updateHistory: false,
    });
    expect(parseArgs(['--allow-missing-baseline'])).toMatchObject({
      allowMissingBaseline: true,
    });
    expect(parseArgs(['--update-history'])).toMatchObject({
      updateHistory: true,
    });
    expect(() => parseArgs(['--history-limit', '0'])).toThrow(
      '--history-limit must be a positive integer'
    );
    expect(escapeWorkflowCommand('bad%\nvalue')).toBe('bad%25%0Avalue');
  });

  it('averages the recorded master history for the baseline', () => {
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    const files = {
      'current.json': JSON.stringify(jestResult(1_000, 2_150)),
      'history.json': JSON.stringify({
        entries: [
          { durationMs: 800, recordedAt: null },
          { durationMs: 1_000, recordedAt: '2026-10-08T00:00:00.000Z' },
          { durationMs: 1_200, recordedAt: '2026-10-09T00:00:00.000Z' },
        ],
      }),
    };
    const fsImpl = {
      existsSync: (filePath) => filePath in files,
      readFileSync: (filePath) => files[filePath],
    };

    // Baseline is the mean (1000); 1150 stays within the +20% budget.
    const result = checkJestDurationRegression({
      baselinePath: 'baseline.json',
      currentPath: 'current.json',
      fsImpl,
      historyPath: 'history.json',
      logger,
    });

    expect(result).toMatchObject({
      baselineMs: 1_000,
      baselineRunCount: 3,
      currentMs: 1_150,
      passed: true,
    });
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('(baseline averages 3 master runs)')
    );
  });

  it('fails against the averaged baseline above the budget', () => {
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    const files = {
      'current.json': JSON.stringify(jestResult(1_000, 2_300)),
      'history.json': JSON.stringify({
        entries: [
          { durationMs: 900, recordedAt: null },
          { durationMs: 1_100, recordedAt: null },
        ],
      }),
    };
    const fsImpl = {
      existsSync: (filePath) => filePath in files,
      readFileSync: (filePath) => files[filePath],
    };

    expect(checkJestDurationRegression({
      baselinePath: 'baseline.json',
      currentPath: 'current.json',
      fsImpl,
      historyPath: 'history.json',
      logger,
    })).toMatchObject({ baselineMs: 1_000, passed: false });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('delta=+30.0%'));
  });

  it('falls back to the legacy single-run baseline without usable history', () => {
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    const files = {
      'baseline.json': JSON.stringify(jestResult(1_000, 2_000)),
      'current.json': JSON.stringify(jestResult(1_000, 2_100)),
      'history.json': 'not json at all',
    };
    const fsImpl = {
      existsSync: (filePath) => filePath in files,
      readFileSync: (filePath) => files[filePath],
    };

    const result = checkJestDurationRegression({
      baselinePath: 'baseline.json',
      currentPath: 'current.json',
      fsImpl,
      historyPath: 'history.json',
      logger,
    });

    expect(result).toMatchObject({ baselineMs: 1_000, baselineRunCount: 1, passed: true });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Ignoring unreadable timing history at history.json')
    );
    expect(logger.log).toHaveBeenCalledWith(expect.not.stringContaining('averages'));
  });

  it('seeds the history from the legacy baseline and trims it to the limit', () => {
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    const written = {};
    const files = {
      'baseline.json': JSON.stringify(jestResult(1_000, 1_800)),
      'current.json': JSON.stringify(jestResult(1_000, 2_200)),
    };
    const fsImpl = {
      existsSync: (filePath) => filePath in files,
      mkdirSync: jest.fn(),
      readFileSync: (filePath) => files[filePath],
      writeFileSync: (filePath, contents) => {
        written[filePath] = contents;
      },
    };

    const seeded = updateTimingHistory({
      baselinePath: 'baseline.json',
      currentPath: 'current.json',
      fsImpl,
      historyPath: 'history.json',
      logger,
      now: () => '2026-10-09T00:00:00.000Z',
    });

    expect(seeded).toMatchObject({ baselineMs: 1_000, currentMs: 1_200, passed: true });
    expect(JSON.parse(written['history.json'])).toEqual({
      entries: [
        { durationMs: 800, recordedAt: null },
        { durationMs: 1_200, recordedAt: '2026-10-09T00:00:00.000Z' },
      ],
    });

    files['history.json'] = written['history.json'];
    const trimmed = updateTimingHistory({
      baselinePath: 'baseline.json',
      currentPath: 'current.json',
      fsImpl,
      historyLimit: 2,
      historyPath: 'history.json',
      logger,
      now: () => '2026-10-09T01:00:00.000Z',
    });

    expect(trimmed.entries).toEqual([
      { durationMs: 1_200, recordedAt: '2026-10-09T00:00:00.000Z' },
      { durationMs: 1_200, recordedAt: '2026-10-09T01:00:00.000Z' },
    ]);
  });
});
