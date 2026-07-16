import { describe, expect, it } from '@jest/globals';

import {
  PENDING_ANALYSIS_RECOVERY_DELAY_MS,
  isRecoverablePendingAnalysis,
} from '../analysisRequest';

describe('analysisRequest recovery', () => {
  const now = 1_000_000;

  it('keeps a fresh pending analysis locked', () => {
    expect(
      isRecoverablePendingAnalysis(
        {
          id: now - 10_000,
          analysisStatus: 'pending',
          updatedAt: now - 10_000,
        },
        now
      )
    ).toBe(false);
  });

  it('allows a stale pending analysis to resume', () => {
    expect(
      isRecoverablePendingAnalysis(
        {
          id: now - PENDING_ANALYSIS_RECOVERY_DELAY_MS - 1,
          analysisStatus: 'pending',
          updatedAt: now - PENDING_ANALYSIS_RECOVERY_DELAY_MS - 1,
        },
        now
      )
    ).toBe(true);
  });

  it('uses the newest known timestamp and ignores non-pending states', () => {
    const staleCreatedAt = now - PENDING_ANALYSIS_RECOVERY_DELAY_MS - 1;

    expect(
      isRecoverablePendingAnalysis(
        {
          id: staleCreatedAt,
          analysisStatus: 'pending',
          updatedAt: staleCreatedAt,
          clientUpdatedAt: now - 1_000,
        },
        now
      )
    ).toBe(false);
    expect(
      isRecoverablePendingAnalysis(
        { id: staleCreatedAt, analysisStatus: 'failed', updatedAt: staleCreatedAt },
        now
      )
    ).toBe(false);
  });
});
