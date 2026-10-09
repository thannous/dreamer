'use strict';

const { verifyFast, selectsNoProductSurface } = require('./verify-fast');

const quiet = {
  run_noctalia: false,
  run_meditation: false,
  run_site: false,
  run_edge_functions: false,
  run_edge_contracts: false,
  run_changed_tests: false,
  run_full_tests: false,
};

describe('verify:fast', () => {
  it('treats an all-false classification as documentation outside site content', () => {
    expect(selectsNoProductSurface(quiet)).toBe(true);
    expect(selectsNoProductSurface({ ...quiet, run_site: true })).toBe(false);
    expect(selectsNoProductSurface({ ...quiet, run_meditation: undefined })).toBe(false);
  });

  it('skips lint when the classifier selects no product surface', () => {
    const runNpmImpl = jest.fn(() => 0);
    const log = jest.fn();
    const runPrePushImpl = jest.fn(({ observeImpl }) => {
      observeImpl(quiet);
      return 0;
    });
    expect(verifyFast({ runPrePushImpl, runNpmImpl, log })).toBe(0);
    expect(runNpmImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('lint and lint:scripts skipped'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('SHA is still bound'));
  });

  it('still lints when site content is selected', () => {
    const runNpmImpl = jest.fn(() => 0);
    const runPrePushImpl = jest.fn(({ observeImpl }) => {
      observeImpl({ ...quiet, run_site: true });
      return 0;
    });
    expect(verifyFast({ runPrePushImpl, runNpmImpl, log: jest.fn() })).toBe(0);
    expect(runNpmImpl.mock.calls).toEqual([['lint'], ['lint:scripts']]);
  });

  it('does not skip lint when a classification flag is missing', () => {
    const runNpmImpl = jest.fn(() => 0);
    const runPrePushImpl = jest.fn(({ observeImpl }) => {
      observeImpl({ ...quiet, run_edge_functions: undefined });
      return 0;
    });
    expect(verifyFast({ runPrePushImpl, runNpmImpl, log: jest.fn() })).toBe(0);
    expect(runNpmImpl.mock.calls.map((call) => call[0])).toEqual(['lint', 'lint:scripts']);
  });

  it('does not lint when pre-push fails', () => {
    const runNpmImpl = jest.fn(() => 0);
    expect(verifyFast({
      runPrePushImpl: () => 2,
      runNpmImpl,
      log: jest.fn(),
    })).toBe(2);
    expect(runNpmImpl).not.toHaveBeenCalled();
  });

  it('returns the lint failure and does not start lint:scripts', () => {
    const runNpmImpl = jest.fn((script) => (script === 'lint' ? 1 : 0));
    const runPrePushImpl = jest.fn(({ observeImpl }) => {
      observeImpl({ ...quiet, run_noctalia: true, run_changed_tests: true });
      return 0;
    });
    expect(verifyFast({ runPrePushImpl, runNpmImpl, log: jest.fn() })).toBe(1);
    expect(runNpmImpl.mock.calls).toEqual([['lint']]);
  });
});
