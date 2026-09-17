import { insertDictation } from '../dictationInsertion';

describe('insertDictation', () => {
  it.each([
    ['Le jardin', 3, 3, 'grand', 'Le grand jardin', 8],
    ['jardin', 0, 0, 'Le grand', 'Le grand jardin', 8],
    ['Le jardin', 9, 9, 'fleuri', 'Le jardin fleuri', 16],
    ['Le petit jardin', 3, 8, 'grand', 'Le grand jardin', 8],
    ['Un 🌙 ici', 6, 6, 'brille', 'Un 🌙 brille ici', 12],
    ['Le jardin.\nUne porte.', 9, 9, 'fleuri', 'Le jardin fleuri.\nUne porte.', 16],
  ])('inserts speech into %j at %i–%i', (base, start, end, speech, text, caret) => {
    expect(insertDictation({ base, selection: { start, end } }, speech)).toEqual({
      text,
      selection: { start: caret, end: caret },
    });
  });

  it('replaces cumulative previews and final corrections without duplicating words', () => {
    const insertion = { base: 'Le jardin.', selection: { start: 3, end: 3 } };
    expect(insertDictation(insertion, 'ver').text).toBe('Le ver jardin.');
    expect(insertDictation(insertion, 'vert et calme').text).toBe('Le vert et calme jardin.');
    expect(insertDictation(insertion, 'grand et calme').text).toBe('Le grand et calme jardin.');
  });

  it('preserves a selected passage when no speech is recognized', () => {
    expect(insertDictation({ base: 'Le jardin', selection: { start: 3, end: 9 } }, '').text)
      .toBe('Le jardin');
  });
});
