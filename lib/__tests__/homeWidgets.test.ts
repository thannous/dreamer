import { pickLastPaintedDream } from '../homeWidgets';
import type { DreamAnalysis } from '../types';

// The home screen widget shows the newest painting: a newer dream still waiting for its
// painting, or one whose painting failed, must not empty it.

const dream = (id: number, painting: Partial<DreamAnalysis>): DreamAnalysis => ({
  id,
  transcript: 'x',
  title: `Dream ${id}`,
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  ...painting,
});

describe('pickLastPaintedDream', () => {
  it('keeps the newest dream that has a painting', () => {
    const dreams = [
      dream(1, { imageUrl: 'dreams/1.webp' }),
      dream(3, { thumbnailUrl: 'dreams/3-thumb.webp' }),
      dream(4, { imageUrl: 'dreams/4.webp', imageGenerationFailed: true }),
      dream(5, {}),
      dream(2, { imageUrl: 'dreams/2.webp' }),
    ];

    expect(pickLastPaintedDream(dreams)?.id).toBe(3);
    expect(pickLastPaintedDream([dream(5, { imageUrl: '  ' })])).toBeNull();
  });
});
