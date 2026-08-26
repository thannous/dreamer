import { PATTERN_BY_ID } from '@/content/breathing';
import { SESSION_BY_ID } from '@/content/sessions';
import { WORLD_BY_ID, WORLD_IDS } from '@/constants/worlds';
import { canUseBreathingPattern } from '@/lib/entitlements';
import {
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
