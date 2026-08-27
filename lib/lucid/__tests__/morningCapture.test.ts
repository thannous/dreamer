import { createLucidProgramProgress } from '@/lib/lucid/domain';
import {
  getLucidDateKeyInTimeZone,
  resolvePreviousNightTechniqueLink,
} from '@/lib/lucid/morningCapture';
import type { LucidProgramProgress, LucidTechnique } from '@/lib/lucid/model';

const NOW = Date.UTC(2026, 7, 27, 8, 0, 0);

function progress(
  technique: LucidTechnique,
  practiceDates: string[],
  updatedAt: number
): LucidProgramProgress {
  return {
    ...createLucidProgramProgress(technique, updatedAt),
    status: 'active',
    practiceDates,
    startedAt: updatedAt,
    updatedAt,
  };
}

describe('previous-night technique auto-link', () => {
  it('returns null without inventing a technique when evidence is missing', () => {
    expect(resolvePreviousNightTechniqueLink([], NOW, 'UTC')).toBeNull();
    expect(
      resolvePreviousNightTechniqueLink(
        [progress('mild', ['2026-08-20'], NOW)],
        NOW,
        'UTC'
      )
    ).toBeNull();
    expect(resolvePreviousNightTechniqueLink([progress('wbtb', ['2026-08-27'], NOW)], NOW, 'Mars/Olympus')).toBeNull();
  });

  it('links today or yesterday in the given timezone so post-midnight WBTB still counts', () => {
    expect(getLucidDateKeyInTimeZone(NOW, 'UTC')).toBe('2026-08-27');

    expect(
      resolvePreviousNightTechniqueLink(
        [progress('wbtb', ['2026-08-27'], NOW)],
        NOW,
        'UTC'
      )
    ).toEqual({
      technique: 'wbtb',
      source: 'program_practice',
      practiceDate: '2026-08-27',
    });

    expect(
      resolvePreviousNightTechniqueLink(
        [progress('mild', ['2026-08-26', '2026-08-20'], NOW)],
        NOW,
        'UTC'
      )
    ).toEqual({
      technique: 'mild',
      source: 'program_practice',
      practiceDate: '2026-08-26',
    });
  });

  it('uses timezone calendar boundaries rather than the UTC date of the timestamp', () => {
    const parisJustAfterMidnight = Date.UTC(2026, 7, 26, 22, 30, 0);
    expect(getLucidDateKeyInTimeZone(parisJustAfterMidnight, 'Europe/Paris')).toBe('2026-08-27');
    expect(getLucidDateKeyInTimeZone(parisJustAfterMidnight, 'UTC')).toBe('2026-08-26');

    expect(
      resolvePreviousNightTechniqueLink(
        [progress('ssild', ['2026-08-27'], NOW)],
        parisJustAfterMidnight,
        'Europe/Paris'
      )
    ).toEqual({
      technique: 'ssild',
      source: 'program_practice',
      practiceDate: '2026-08-27',
    });

    const pacificPreviousEvening = Date.UTC(2026, 7, 27, 6, 0, 0);
    expect(getLucidDateKeyInTimeZone(pacificPreviousEvening, 'America/Los_Angeles')).toBe(
      '2026-08-26'
    );
    expect(
      resolvePreviousNightTechniqueLink(
        [progress('mild', ['2026-08-27'], NOW)],
        pacificPreviousEvening,
        'America/Los_Angeles'
      )
    ).toBeNull();
    expect(
      resolvePreviousNightTechniqueLink(
        [progress('mild', ['2026-08-26'], NOW)],
        pacificPreviousEvening,
        'America/Los_Angeles'
      )
    ).toEqual({
      technique: 'mild',
      source: 'program_practice',
      practiceDate: '2026-08-26',
    });
  });

  it('ignores a future practice date when the same progress item also has an eligible date', () => {
    expect(
      resolvePreviousNightTechniqueLink(
        [progress('mild', ['2026-08-20', '2026-08-26', '2026-09-01'], NOW)],
        NOW,
        'UTC'
      )
    ).toEqual({
      technique: 'mild',
      source: 'program_practice',
      practiceDate: '2026-08-26',
    });
  });

  it('prefers the newest eligible practice date, then updatedAt, then technique order', () => {
    expect(
      resolvePreviousNightTechniqueLink(
        [
          progress('mild', ['2026-08-26'], NOW + 50),
          progress('wbtb', ['2026-08-27'], NOW),
        ],
        NOW,
        'UTC'
      )
    ).toEqual({
      technique: 'wbtb',
      source: 'program_practice',
      practiceDate: '2026-08-27',
    });

    expect(
      resolvePreviousNightTechniqueLink(
        [
          progress('ssild', ['2026-08-27'], NOW + 1),
          progress('mild', ['2026-08-27'], NOW + 10),
        ],
        NOW,
        'UTC'
      )
    ).toEqual({
      technique: 'mild',
      source: 'program_practice',
      practiceDate: '2026-08-27',
    });

    expect(
      resolvePreviousNightTechniqueLink(
        [
          progress('wbtb', ['2026-08-27'], NOW),
          progress('ssild', ['2026-08-27'], NOW),
          progress('mild', ['2026-08-27'], NOW),
        ],
        NOW,
        'UTC'
      )
    ).toEqual({
      technique: 'mild',
      source: 'program_practice',
      practiceDate: '2026-08-27',
    });
  });
});
