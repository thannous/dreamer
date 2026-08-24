import { getAsoStoreDreamsWithTimestamps } from '../../mock-data/asoStoreDreams';

describe('ASO Store screenshot dreams', () => {
  it('builds a coherent populated French journal', () => {
    const now = Date.UTC(2026, 7, 24, 8, 0, 0);
    const dreams = getAsoStoreDreamsWithTimestamps(now);

    expect(dreams).toHaveLength(14);
    expect(dreams.filter((dream) => dream.isFavorite)).toHaveLength(4);
    expect(dreams.every((dream) => dream.isAnalyzed && dream.analysisStatus === 'done')).toBe(true);
    expect(dreams.every((dream) => (dream.emotions?.length ?? 0) >= 3)).toBe(true);
    expect(dreams[0]).toMatchObject({
      title: 'Le pont rouge sur la rivière',
      theme: 'calm',
      dreamType: 'Symbolic Dream',
    });
    expect(dreams[0].reflectionQuestions).toHaveLength(2);
  });

  it('keeps every generated timestamp unique and in the past', () => {
    const now = Date.UTC(2026, 7, 24, 8, 0, 0);
    const dreams = getAsoStoreDreamsWithTimestamps(now);
    const ids = dreams.map((dream) => dream.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id < now)).toBe(true);
  });
});
