import { generateAnalysisResult, titleFromTranscript } from '@/mock-data/generators';

describe('titleFromTranscript', () => {
  it('uses the opening sentence of the transcript instead of a canned title', () => {
    expect(titleFromTranscript('Je volais au-dessus d\'une ville violette.')).toBe(
      'Je volais au-dessus d\'une ville violette'
    );
  });

  it('falls back when the transcript is empty', () => {
    expect(titleFromTranscript('   ')).toBe('Flying Over the Ocean');
  });
});

describe('generateAnalysisResult', () => {
  it('keeps successive mock dreams distinguishable by transcript', () => {
    const forest = generateAnalysisResult(
      'I was walking through a forest at night and found a glowing door in a tree trunk.'
    );
    const flying = generateAnalysisResult('Je volais au-dessus d\'une ville violette.');

    expect(forest.title).toContain('forest');
    expect(flying.title).toContain('volais');
    expect(forest.title).not.toBe(flying.title);
  });

  it('is stable for the same transcript', () => {
    const first = generateAnalysisResult('A purple city floated above the sea.');
    const second = generateAnalysisResult('A purple city floated above the sea.');
    expect(first).toEqual(second);
  });
});
