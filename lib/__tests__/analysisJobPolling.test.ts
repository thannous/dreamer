import {
  getAnalysisJobPollDelay,
  MAX_ANALYSIS_JOB_POLL_ATTEMPTS,
} from '../analysisJobPolling';

describe('analysis job polling', () => {
  it('backs off and caps the polling delay', () => {
    expect([0, 1, 2, 3, 4, 5, 99].map(getAnalysisJobPollDelay)).toEqual([
      1000,
      2000,
      4000,
      8000,
      12000,
      15000,
      15000,
    ]);
    expect(MAX_ANALYSIS_JOB_POLL_ATTEMPTS).toBeGreaterThan(5);
  });

  it('normalizes invalid attempts', () => {
    expect(getAnalysisJobPollDelay(-1)).toBe(1000);
    expect(getAnalysisJobPollDelay(Number.NaN)).toBe(1000);
  });
});
