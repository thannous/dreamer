import { getSavedAnalysisAction } from '@/lib/savedAnalysisAccess';
import type { QuotaStatus } from '@/lib/types';

const status = (canAnalyze: boolean, remaining: number, extra: Partial<QuotaStatus> = {}): QuotaStatus => ({
  tier: 'free', canAnalyze, canExplore: false,
  usage: { analysis: { used: 3 - remaining, limit: 3, remaining } }, ...extra,
} as QuotaStatus);

it.each([0, -1, 2])('uses denied permission rather than the remaining metric (%s)', remaining => {
  expect(getSavedAnalysisAction({ tier: 'free', loading: false, status: status(false, remaining) })).toBe('upgrade');
});

it('honors resolved permission even if the displayed count is stale', () => {
  expect(getSavedAnalysisAction({ tier: 'free', loading: false, status: status(true, 0) })).toBe('analyze');
});

it.each(['degraded', 'disabled'] as const)('does not sell an upgrade for %s guest access', guestBootstrapStatus => {
  expect(getSavedAnalysisAction({ tier: 'guest', loading: false, status: status(false, 2, { guestBootstrapStatus }) })).toBe('check');
});

it('keeps missing, errored and loading permissions explicit', () => {
  expect(getSavedAnalysisAction({ tier: 'free', loading: true, status: status(false, 0) })).toBe('checking');
  expect(getSavedAnalysisAction({ tier: 'free', loading: false })).toBe('check');
  expect(getSavedAnalysisAction({ tier: 'free', loading: false, status: status(false, 0), error: new Error('offline') })).toBe('check');
});
