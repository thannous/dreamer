import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DreamAnalysis } from '@/lib/types';
import { MockQuotaProvider } from '../MockQuotaProvider';

const mockGetSavedDreams = vi.fn<[], Promise<DreamAnalysis[]>>();

vi.mock('@/services/storageService', () => ({
  getSavedDreams: (...args: unknown[]) => mockGetSavedDreams(...args),
}));

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: Date.now(),
  transcript: 'Mock transcript',
  title: 'Dream title',
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: false,
  analysisStatus: 'done',
  ...overrides,
});

describe('MockQuotaProvider', () => {
  beforeEach(() => {
    mockGetSavedDreams.mockReset();
  });

  it('counts only dreams that have both isAnalyzed and analyzedAt set', async () => {
    const dreams = [
      buildDream({ id: 1, isAnalyzed: true }), // missing analyzedAt
      buildDream({ id: 2, isAnalyzed: true, analyzedAt: Date.now() }),
      buildDream({ id: 3 }),
    ];
    mockGetSavedDreams.mockResolvedValueOnce(dreams);

    const provider = new MockQuotaProvider();
    await expect(provider.getUsedAnalysisCount(null)).resolves.toBe(1);
  });

  it('refreshes cached dreams after invalidate()', async () => {
    const analyzedDream = buildDream({ id: 4, isAnalyzed: true, analyzedAt: Date.now() });
    mockGetSavedDreams.mockResolvedValueOnce([analyzedDream]);

    const provider = new MockQuotaProvider();
    await provider.getUsedAnalysisCount(null);

    mockGetSavedDreams.mockResolvedValueOnce([]);
    provider.invalidate();

    const refreshedCount = await provider.getUsedAnalysisCount(null);
    expect(refreshedCount).toBe(0);
    expect(mockGetSavedDreams).toHaveBeenCalledTimes(2);
  });
});
