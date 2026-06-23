import { describe, expect, it } from '@jest/globals';

import { getRecordingActivationInsight } from '@/lib/recordingActivationInsight';

describe('getRecordingActivationInsight', () => {
  it('stays hidden when the user has not added a useful fragment yet', () => {
    expect(getRecordingActivationInsight({ transcript: '' })).toBeNull();
    expect(getRecordingActivationInsight({ transcript: 'eau' })).toBeNull();
  });

  it('detects early personal signals from a current dream fragment', () => {
    const insight = getRecordingActivationInsight({
      transcript: 'Je suis dans une maison avec ma mere, j ai peur et je vois une porte bleue.',
    });

    expect(insight).toEqual({
      tone: 'signals',
      signalIds: ['emotion', 'place', 'person', 'symbol'],
      charCount: 75,
    });
  });

  it('turns a remembered dream into an anchor before text is long', () => {
    const insight = getRecordingActivationInsight({
      transcript: 'Toujours la meme route.',
      captureIntent: 'remembered',
      rememberedKind: 'recurring',
      strongestFragment: 'place',
    });

    expect(insight).toEqual({
      tone: 'memory',
      signalIds: ['memory', 'recurrence', 'place'],
      charCount: 23,
    });
  });
});
