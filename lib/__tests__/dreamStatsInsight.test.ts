import { getDreamStatsInsight } from '@/lib/dreamStatsInsight';

describe('getDreamStatsInsight', () => {
  it('suggests recording when the journal is empty', () => {
    const insight = getDreamStatsInsight({
      totalDreams: 0,
      favoriteDreams: 0,
      currentStreak: 0,
      analyzedDreams: 0,
      dreamsWithChat: 0,
    });

    expect(insight.kind).toBe('record');
    expect(insight.route).toBe('/recording');
    expect(insight.analysisRatio).toBe(0);
  });

  it('prioritizes analysis when saved dreams are waiting', () => {
    const insight = getDreamStatsInsight({
      totalDreams: 4,
      favoriteDreams: 1,
      currentStreak: 4,
      analyzedDreams: 3,
      dreamsWithChat: 3,
    });

    expect(insight.kind).toBe('analyze');
    expect(insight.route).toBe('/(tabs)/journal');
    expect(insight.analysisRatio).toBe(0.75);
    expect(insight.streakGoalRatio).toBe(1);
  });

  it('suggests exploration after all dreams are analyzed', () => {
    const insight = getDreamStatsInsight({
      totalDreams: 3,
      favoriteDreams: 1,
      currentStreak: 1,
      analyzedDreams: 3,
      dreamsWithChat: 1,
    });

    expect(insight.kind).toBe('explore');
    expect(insight.explorationRatio).toBeCloseTo(1 / 3);
  });

  it('suggests favorites when the library has no marked dreams', () => {
    const insight = getDreamStatsInsight({
      totalDreams: 3,
      favoriteDreams: 0,
      currentStreak: 1,
      analyzedDreams: 3,
      dreamsWithChat: 3,
    });

    expect(insight.kind).toBe('favorite');
  });

  it('celebrates streaks after core actions are complete', () => {
    const insight = getDreamStatsInsight({
      totalDreams: 5,
      favoriteDreams: 2,
      currentStreak: 3,
      analyzedDreams: 5,
      dreamsWithChat: 5,
    });

    expect(insight.kind).toBe('streak');
    expect(insight.streakGoalRatio).toBe(1);
  });

  it('returns steady when no stronger recommendation applies', () => {
    const insight = getDreamStatsInsight({
      totalDreams: 2,
      favoriteDreams: 1,
      currentStreak: 1,
      analyzedDreams: 2,
      dreamsWithChat: 2,
    });

    expect(insight.kind).toBe('steady');
  });
});
