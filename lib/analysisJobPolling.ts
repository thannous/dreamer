const ANALYSIS_JOB_POLL_DELAYS_MS = [1000, 2000, 4000, 8000, 12000, 15000] as const;

export const MAX_ANALYSIS_JOB_POLL_ATTEMPTS = 12;

export const getAnalysisJobPollDelay = (attempt: number): number => {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  return ANALYSIS_JOB_POLL_DELAYS_MS[
    Math.min(safeAttempt, ANALYSIS_JOB_POLL_DELAYS_MS.length - 1)
  ];
};
