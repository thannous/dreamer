import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DreamAnalysis } from '@/lib/types';
import { GuestQuotaProvider } from '../GuestQuotaProvider';

const mockGetDreams = vi.fn();

vi.mock('@/services/storageServiceReal', () => ({
  getSavedDreams: (...args: unknown[]) => mockGetDreams(...args),
}));

const buildDream = (overrides: Partial<DreamAnalysis>): DreamAnalysis => ({
  id: Date.now(),
  transcript: 'Dream transcript',
  title: 'Dream',
  interpretation: '',
  shareableQuote: '',
  theme: undefined,
  dreamType: 'Dream',
  imageUrl: '',
  chatHistory: [],
  isAnalyzed: false,
  analysisStatus: 'none',
  ...overrides,
});

describe('GuestQuotaProvider', () => {
  beforeEach(() => {
    mockGetDreams.mockReset();
  });

  it('blocks analysis when guest limit is reached', async () => {
    const analyzedDreams: DreamAnalysis[] = [
      buildDream({ id: 1, isAnalyzed: true }),
      buildDream({ id: 2, isAnalyzed: true }),
    ];
    mockGetDreams.mockResolvedValueOnce(analyzedDreams);

    const provider = new GuestQuotaProvider();
    await expect(provider.canAnalyzeDream(null)).resolves.toBe(false);
  });

  it('allows continued exploration on already explored dream', async () => {
    const dream = buildDream({ id: 5, explorationStartedAt: Date.now() });
    mockGetDreams.mockResolvedValueOnce([dream]);
    const provider = new GuestQuotaProvider();

    await expect(provider.canExploreDream({ dreamId: dream.id }, null)).resolves.toBe(true);
  });

  it('returns detailed quota status with reasons', async () => {
    const dreamA = buildDream({ id: 10, isAnalyzed: true });
    const dreamB = buildDream({ id: 11, isAnalyzed: true, explorationStartedAt: Date.now(), chatHistory: [
      { role: 'user', text: 'hello' },
      { role: 'model', text: 'hi' },
      { role: 'user', text: 'follow-up' },
    ] });
    mockGetDreams.mockResolvedValueOnce([dreamA, dreamB]);

    const provider = new GuestQuotaProvider();
    const status = await provider.getQuotaStatus(null, { dreamId: dreamB.id });

    expect(status.usage.analysis.used).toBe(2);
    expect(status.usage.messages.used).toBe(2);
    expect(status.canAnalyze).toBe(false);
    expect(status.reasons?.[0]).toContain('Guest analysis limit');
  });
});
