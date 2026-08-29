import {
  getRecordingDraftProgress,
  isTranscriptSaveable,
} from '@/lib/recordingDraftProgress';

describe('isTranscriptSaveable', () => {
  it('treats any trimmed fragment as saveable, including short remembered notes', () => {
    expect(isTranscriptSaveable('maman')).toBe(true);
    expect(isTranscriptSaveable('Porte rouge')).toBe(true);
    expect(isTranscriptSaveable('loup blanc')).toBe(true);
    expect(isTranscriptSaveable('  maman  ')).toBe(true);
  });

  it('rejects empty and whitespace-only transcripts', () => {
    expect(isTranscriptSaveable('')).toBe(false);
    expect(isTranscriptSaveable('   ')).toBe(false);
    expect(isTranscriptSaveable('\n\t')).toBe(false);
  });
});

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

  it('classifies whitespace-only drafts as empty and not saveable', () => {
    expect(getRecordingDraftProgress('   ', 100).state).toBe('empty');
    expect(isTranscriptSaveable('   ')).toBe(false);
  });

  it('returns short state for early notes', () => {
    const result = getRecordingDraftProgress('A blue door', 100);

    expect(result.state).toBe('short');
    expect(result.charCount).toBe(11);
    expect(result.remaining).toBe(89);
    expect(result.ratio).toBeCloseTo(0.11);
  });

  it('keeps short remembered fragments classified as short without blocking save', () => {
    for (const fragment of ['maman', 'Porte rouge', 'loup blanc']) {
      expect(getRecordingDraftProgress(fragment, 100).state).toBe('short');
      expect(isTranscriptSaveable(fragment)).toBe(true);
    }
  });

  it('becomes ready at the minimum fragment length', () => {
    expect(getRecordingDraftProgress('A short fragment!!', 100).state).toBe('ready');
    expect(getRecordingDraftProgress('A short fragment!', 100).state).toBe('short');
  });

  it('returns ready state after enough detail is captured', () => {
    const text = 'I was walking through a station with gold windows and someone was calling my name.';

    expect(getRecordingDraftProgress(text, 200).state).toBe('ready');
  });

  it('saturates the visual bar without blocking or reporting a limit', () => {
    const result = getRecordingDraftProgress('abcdef', 3);

    expect(result).toEqual({
      charCount: 6,
      limit: 3,
      remaining: 0,
      ratio: 1,
      state: 'short',
    });
  });

  it('keeps actual counts past the 600-character visual reference and stays saveable', () => {
    const overReference = 'x'.repeat(601);
    const muchLonger = 'y'.repeat(1200);
    const veryLong = 'z'.repeat(10_000);

    expect(getRecordingDraftProgress(overReference)).toMatchObject({
      charCount: 601,
      remaining: 0,
      ratio: 1,
      state: 'ready',
    });
    expect(getRecordingDraftProgress(muchLonger).charCount).toBe(1200);
    expect(getRecordingDraftProgress(veryLong).charCount).toBe(10_000);
    expect(getRecordingDraftProgress(veryLong).state).toBe('ready');
    expect(isTranscriptSaveable(overReference)).toBe(true);
    expect(isTranscriptSaveable(veryLong)).toBe(true);
  });
});
