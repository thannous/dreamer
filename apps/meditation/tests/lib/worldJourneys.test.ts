import { PATTERN_BY_ID } from '@/content/breathing';
import { SESSION_BY_ID } from '@/content/sessions';
import { WORLD_BY_ID, WORLD_IDS } from '@/constants/worlds';
import { canUseBreathingPattern } from '@/lib/entitlements';
import {
  homeRecommendationForWorld,
  journeyStateForWorld,
  isSessionIncludedInOwnedWorld,
  isSessionInWorldJourney,
  recommendedSessionForWorld,
  resumableSessionForWorld,
  sessionOfTheDayForWorld,
  sessionsForWorld,
  upcomingSessionsForWorld,
} from '@/lib/worldJourneys';
import type { CategorySlug, SessionProgress } from '@/lib/types';

const DATE = '2026-08-23';

function progressFor(
  sessionId: string,
  positionRatio: number,
  lastPlayedISO: string
): SessionProgress {
  return {
    positionSec: Math.round(SESSION_BY_ID[sessionId].durationSec * positionRatio),
    completedCount: 0,
    lastPlayedISO,
  };
}

describe('world personalities', () => {
  it('gives every world a unique functional role and covers each category exactly once', () => {
    const personalities = WORLD_IDS.map((worldId) => WORLD_BY_ID[worldId].personality);
    const roles = personalities.map(({ role }) => role);
    const categories = personalities.map(({ primaryCategory }) => primaryCategory);
    const expectedCategories: CategorySlug[] = [
      'sleep',
      'stress',
      'focus',
      'anxiety',
      'gratitude',
      'dream-prep',
    ];

    expect(new Set(roles).size).toBe(WORLD_IDS.length);
    expect(new Set(categories).size).toBe(WORLD_IDS.length);
    expect([...categories].sort()).toEqual([...expectedCategories].sort());
  });

  it('defines a valid breathing pattern and a valid three-stage progression', () => {
    for (const worldId of WORLD_IDS) {
      const { breathingPatternId, primaryCategory, progression } =
        WORLD_BY_ID[worldId].personality;

      expect(PATTERN_BY_ID[breathingPatternId]).toBeDefined();
      expect(canUseBreathingPattern(breathingPatternId, 'free')).toEqual({ allowed: true });
      expect(progression.map(({ id }) => id)).toEqual(['discovery', 'deepen', 'inhabit']);
      expect(new Set(progression.map(({ sessionId }) => sessionId)).size).toBe(3);
      expect(SESSION_BY_ID[progression[0].sessionId].isPremium).toBe(false);
      expect(primaryCategory).toBeTruthy();
      expect(progression.every(({ sessionId }) => SESSION_BY_ID[sessionId])).toBe(true);
    }
  });

  it('includes the complete curated path with an owned one-time world', () => {
    const ownsTide = (worldId: (typeof WORLD_IDS)[number]) => worldId === 'tide';

    expect(isSessionInWorldJourney('tide', 'stress-storm')).toBe(true);
    expect(isSessionIncludedInOwnedWorld('tide', 'stress-storm', ownsTide)).toBe(true);
    expect(isSessionIncludedInOwnedWorld('tide', 'stress-storm', () => false)).toBe(false);
    expect(isSessionIncludedInOwnedWorld('forest', 'anxiety-wave', () => true)).toBe(false);
  });
});

describe('world journey recommendations', () => {
  it('is deterministic for a world and day', () => {
    const first = sessionOfTheDayForWorld('forest', DATE);
    const second = sessionOfTheDayForWorld('forest', DATE);

    expect(second.id).toBe(first.id);
    expect(sessionsForWorld('forest').map(({ id }) => id)).toContain(first.id);
  });

  it('changes the recommendation content lane when the world changes', () => {
    const recommendations = WORLD_IDS.map((worldId) =>
      sessionOfTheDayForWorld(worldId, DATE)
    );

    expect(new Set(recommendations.map(({ id }) => id)).size).toBe(WORLD_IDS.length);
    recommendations.forEach((session, index) => {
      expect(sessionsForWorld(WORLD_IDS[index]).map(({ id }) => id)).toContain(session.id);
    });
  });

  it('keeps three exclusive curated practices in each world', () => {
    const allSessionIds = WORLD_IDS.flatMap((worldId) =>
      sessionsForWorld(worldId).map(({ id }) => id)
    );

    expect(allSessionIds).toHaveLength(WORLD_IDS.length * 3);
    expect(new Set(allSessionIds).size).toBe(allSessionIds.length);
  });

  it('returns deterministic, unique upcoming sessions without repeating the active one', () => {
    const active = sessionOfTheDayForWorld('tide', DATE);
    const first = upcomingSessionsForWorld('tide', active.id);
    const second = upcomingSessionsForWorld('tide', active.id);
    const ids = first.map(({ id }) => id);

    expect(ids).toEqual(second.map(({ id }) => id));
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(active.id);
    expect(first.every(({ categorySlug }) => categorySlug === 'stress')).toBe(true);
  });

  it('drives the main recommendation from the first incomplete path step', () => {
    expect(recommendedSessionForWorld('forest', DATE, {}).id).toBe('anxiety-ground');

    const progress = {
      'anxiety-ground': {
        ...progressFor('anxiety-ground', 1, '2026-08-23T07:00:00.000Z'),
        completedCount: 1,
      },
    };

    expect(journeyStateForWorld('forest', progress)).toMatchObject({
      index: 1,
      stageId: 'deepen',
      session: { id: 'anxiety-wave' },
    });
    expect(recommendedSessionForWorld('forest', DATE, progress).id).toBe('anxiety-wave');
  });
});

describe('resumableSessionForWorld', () => {
  it('returns the latest resumable session inside the active world', () => {
    const result = resumableSessionForWorld('forest', {
      'anxiety-ground': progressFor(
        'anxiety-ground',
        0.4,
        '2026-08-21T21:00:00.000Z'
      ),
      'anxiety-wave': progressFor('anxiety-wave', 0.4, '2026-08-22T21:00:00.000Z'),
    });

    expect(result?.session.id).toBe('anxiety-wave');
  });

  it('ignores a newer resumable session from another world', () => {
    const result = resumableSessionForWorld('forest', {
      'anxiety-ground': progressFor(
        'anxiety-ground',
        0.4,
        '2026-08-21T21:00:00.000Z'
      ),
      'focus-deep': progressFor('focus-deep', 0.4, '2026-08-23T21:00:00.000Z'),
    });

    expect(result?.session.id).toBe('anxiety-ground');
  });

  it('returns null when progress belongs only to other worlds', () => {
    const result = resumableSessionForWorld('forest', {
      'focus-deep': progressFor('focus-deep', 0.4, '2026-08-23T21:00:00.000Z'),
    });

    expect(result).toBeNull();
  });
});

describe('playable home recommendation', () => {
  it('keeps the editorial step when it is already playable', () => {
    expect(
      recommendedSessionForWorld('constellation', DATE, {}, (session) => !session.isPremium).id
    ).toBe('sleep-descent');
  });

  it('falls back to a playable session when the editorial step is gated', () => {
    const progress = {
      'sleep-descent': {
        ...progressFor('sleep-descent', 1, '2026-08-23T21:00:00.000Z'),
        completedCount: 1,
      },
    };

    expect(recommendedSessionForWorld('constellation', DATE, progress).id).toBe('dream-threshold');
    expect(
      recommendedSessionForWorld('constellation', DATE, progress, (session) => !session.isPremium).id
    ).toBe('sleep-descent');
  });

  it('keeps the editorial Plus session when nothing in the world is playable', () => {
    const progress = {
      'sleep-descent': {
        ...progressFor('sleep-descent', 1, '2026-08-23T21:00:00.000Z'),
        completedCount: 1,
      },
    };

    expect(recommendedSessionForWorld('constellation', DATE, progress, () => false).id).toBe(
      'dream-threshold'
    );
  });
});

describe('personalized home recommendation', () => {
  it('lets opposing onboarding goals change the playable home practice', () => {
    const sleep = homeRecommendationForWorld('constellation', DATE, {}, undefined, {
      goals: ['sleep'],
      dailyIntentionMin: 10,
    });
    const anxiety = homeRecommendationForWorld('forest', DATE, {}, undefined, {
      goals: ['anxiety'],
      dailyIntentionMin: 5,
    });

    expect(sleep.session.categorySlug).toBe('sleep');
    expect(sleep.matchedGoal).toBe('sleep');
    expect(anxiety.session.categorySlug).toBe('anxiety');
    expect(anxiety.matchedGoal).toBe('anxiety');
    expect(sleep.session.id).not.toBe(anxiety.session.id);
    expect(sleep.reason === 'goal' || sleep.reason === 'goal-duration').toBe(true);
    expect(anxiety.reason === 'goal' || anxiety.reason === 'goal-duration').toBe(true);
  });

  it('reaches a catalogue session when no world practice fits a 5-minute intention', () => {
    const recommendation = homeRecommendationForWorld(
      'constellation',
      DATE,
      {},
      (session) => !session.isPremium,
      { goals: ['sleep'], dailyIntentionMin: 5 }
    );

    expect(recommendation.session.id).toBe('sleep-quick-fall');
    expect(recommendation.session.durationSec).toBeLessThanOrEqual(5 * 60);
    expect(recommendation.source).toBe('catalogue');
    expect(recommendation.reason).toBe('goal-duration');
  });

  it('keeps a purchased world locked to its path even when a shorter catalogue session exists', () => {
    const unlocked = homeRecommendationForWorld(
      'constellation',
      DATE,
      {},
      (session) => !session.isPremium,
      { goals: ['sleep'], dailyIntentionMin: 5 }
    );
    const locked = homeRecommendationForWorld(
      'constellation',
      DATE,
      {},
      (session) => !session.isPremium,
      { goals: ['sleep'], dailyIntentionMin: 5, lockToWorld: true }
    );

    expect(unlocked.session.id).toBe('sleep-quick-fall');
    expect(unlocked.source).toBe('catalogue');
    expect(locked.session.id).toBe('sleep-descent');
    expect(locked.source).toBe('world');
    expect(locked.reason).toBe('goal');
  });

  it('falls back editorially inside a locked world when no duration fits', () => {
    const recommendation = homeRecommendationForWorld(
      'constellation',
      DATE,
      {},
      undefined,
      { dailyIntentionMin: 5, lockToWorld: true }
    );

    expect(recommendation.session.id).toBe('sleep-descent');
    expect(recommendation.source).toBe('world');
    expect(recommendation.reason).toBe('editorial');
  });

  it('is deterministic for the same goals, duration and access state', () => {
    const preference = { goals: ['sleep'] as ['sleep'], dailyIntentionMin: 10 as const };
    const first = homeRecommendationForWorld('constellation', DATE, {}, undefined, preference);
    const second = homeRecommendationForWorld('constellation', DATE, {}, undefined, preference);

    expect(second).toEqual(first);
  });

  it('does not override a gated editorial step with an unplayable preferred session', () => {
    const progress = {
      'sleep-descent': {
        ...progressFor('sleep-descent', 1, '2026-08-23T21:00:00.000Z'),
        completedCount: 1,
      },
    };

    expect(
      recommendedSessionForWorld(
        'constellation',
        DATE,
        progress,
        (session) => !session.isPremium,
        { goals: ['dream-prep'], dailyIntentionMin: 20 }
      ).id
    ).toBe('sleep-descent');
  });
});
