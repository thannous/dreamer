import { describe, expect, it } from 'vitest';

import {
  getAnalyzedDreamCount,
  getDreamDetailAction,
  getExploredDreamCount,
  getUserChatMessageCount,
  isDreamAnalyzed,
  isDreamExplored,
} from '@/lib/dreamUsage';
import type { DreamAnalysis } from '@/lib/types';

const buildDream = (overrides: Partial<DreamAnalysis> & { id?: number } = {}): DreamAnalysis => ({
  id: overrides.id ?? Date.now(),
  transcript: overrides.transcript ?? '',
  title: overrides.title ?? 'Test Dream',
  interpretation: overrides.interpretation ?? '',
  shareableQuote: overrides.shareableQuote ?? '',
  imageUrl: overrides.imageUrl ?? 'https://example.com/image.jpg',
  thumbnailUrl: overrides.thumbnailUrl,
  dreamType: overrides.dreamType ?? 'Symbolic Dream',
  theme: overrides.theme,
  chatHistory: overrides.chatHistory ?? [],
  isFavorite: overrides.isFavorite,
  isAnalyzed: overrides.isAnalyzed,
  analyzedAt: overrides.analyzedAt,
  explorationStartedAt: overrides.explorationStartedAt,
  pendingSync: overrides.pendingSync,
  imageGenerationFailed: overrides.imageGenerationFailed,
});

describe('dreamUsage helpers', () => {
  it('only treats dreams as analyzed when a timestamp is present', () => {
    const partial = buildDream({ id: 1, isAnalyzed: true });
    const complete = buildDream({ id: 2, isAnalyzed: true, analyzedAt: 1234 });

    expect(isDreamAnalyzed(partial)).toBe(false);
    expect(isDreamAnalyzed(complete)).toBe(true);
    expect(getAnalyzedDreamCount([partial, complete, buildDream({ id: 3 })])).toBe(1);
  });

  it('counts explored dreams using exploration timestamps', () => {
    const explored = buildDream({ id: 10, explorationStartedAt: 5000 });
    const untouched = buildDream({ id: 11 });

    expect(isDreamExplored(explored)).toBe(true);
    expect(isDreamExplored(untouched)).toBe(false);
    expect(getExploredDreamCount([explored, untouched])).toBe(1);
  });

  it('counts only user chat messages for quota usage', () => {
    const dreamWithChat = buildDream({
      id: 20,
      chatHistory: [
        { role: 'user', text: 'hello' },
        { role: 'model', text: 'hi there' },
        { role: 'user', text: 'thanks' },
      ],
    });

    expect(getUserChatMessageCount(dreamWithChat)).toBe(2);
    expect(getUserChatMessageCount(buildDream({ id: 21 }))).toBe(0);
  });

  it('derives detail CTA state based on analyzed and explored flags', () => {
    const notTaggedAnalyzed = buildDream({ id: 30, isAnalyzed: true, analysisStatus: 'done' });
    const analyzed = buildDream({ id: 31, isAnalyzed: true, analyzedAt: 5555 });
    const exploredByTimestamp = buildDream({
      id: 32,
      isAnalyzed: true,
      analyzedAt: 6666,
      explorationStartedAt: 7777,
    });
    const exploredByChat = buildDream({
      id: 33,
      isAnalyzed: true,
      analyzedAt: 8888,
      chatHistory: [
        { role: 'user', text: 'hi' },
        { role: 'model', text: 'hello' },
      ],
    });

    expect(getDreamDetailAction(notTaggedAnalyzed)).toBe('analyze');
    expect(getDreamDetailAction(analyzed)).toBe('explore');
    expect(getDreamDetailAction(exploredByTimestamp)).toBe('continue');
    expect(getDreamDetailAction(exploredByChat)).toBe('continue');
  });
});
