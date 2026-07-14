import { getRecordingDraftProgress } from '@/lib/recordingDraftProgress';

describe('getRecordingDraftProgress', () => {
  it('returns empty state for blank drafts', () => {
    expect(getRecordingDraftProgress('', 100)).toEqual({
      charCount: 0,
      limit: 100,
      remaining: 100,
      ratio: 0,
      state: 'empty',
    });
  });

  it('returns short state for early notes', () => {
    const result = getRecordingDraftProgress('A blue door', 100);

    expect(result.state).toBe('short');
    expect(result.charCount).toBe(11);
    expect(result.remaining).toBe(89);
    expect(result.ratio).toBeCloseTo(0.11);
  });

  it('becomes ready at the minimum fragment length', () => {
    expect(getRecordingDraftProgress('A short fragment!!', 100).state).toBe('ready');
    expect(getRecordingDraftProgress('A short fragment!', 100).state).toBe('short');
  });

  it('returns ready state after enough detail is captured', () => {
    const text = 'I was walking through a station with gold windows and someone was calling my name.';

    expect(getRecordingDraftProgress(text, 200).state).toBe('ready');
  });

  it('caps progress at the configured limit', () => {
    const result = getRecordingDraftProgress('abcdef', 3);

    expect(result).toEqual({
      charCount: 3,
      limit: 3,
      remaining: 0,
      ratio: 1,
      state: 'full',
    });
  });
});
