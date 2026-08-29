import { describe, expect, it } from '@jest/globals';

import {
  resolveTodayState,
  type TodayDreamInput,
  type TodayStateInput,
} from '../todayState';

const DAY_MS = 24 * 60 * 60 * 1000;
const TODAY = Date.UTC(2026, 7, 28, 10);
const YESTERDAY = TODAY - DAY_MS;

const localDateKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const yesterdayDream: TodayDreamInput = {
  id: 27,
  createdAt: YESTERDAY,
  isAnalyzed: true,
  isExplored: true,
};

const unanalyzedToday: TodayDreamInput = {
  id: 28,
  createdAt: TODAY,
  isAnalyzed: false,
};

const analyzedToday: TodayDreamInput = {
  id: 29,
  date: TODAY,
  isAnalyzed: true,
  isExplored: false,
};

const exploredToday: TodayDreamInput = {
  id: 30,
  createdAt: TODAY,
  isAnalyzed: true,
  isExplored: true,
};

function input(overrides: Partial<TodayStateInput> = {}): TodayStateInput {
  return {
    now: TODAY,
    localDateKey,
    hasDraft: false,
    dreams: [],
    ...overrides,
  };
}

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
type Expect<T extends true> = T;

type _ActionIsDiscriminated = Expect<
  Equal<
    import('../todayState').TodayAction,
    | { kind: 'resume_recording' }
    | { kind: 'start_capture' }
    | { kind: 'open_dream'; dreamId: number }
    | { kind: 'open_journal' }
  >
>;
type _ReasonIsClosed = Expect<
  Equal<
    import('../todayState').TodayReason,
    | 'saved_draft'
    | 'first_use'
    | 'no_dream_today'
    | 'today_dream_unanalyzed'
    | 'today_dream_unexplored'
    | 'today_complete'
  >
>;

function dreamIdOf(action: import('../todayState').TodayAction): number | undefined {
  switch (action.kind) {
    case 'open_dream':
      return action.dreamId;
    case 'resume_recording':
    case 'start_capture':
    case 'open_journal':
      return undefined;
  }
}

describe('resolveTodayState priority table', () => {
  it('lets a saved draft beat an existing today dream', () => {
    const result = resolveTodayState(
      input({
        hasDraft: true,
        dreams: [analyzedToday],
      })
    );

    expect(result).toEqual({
      id: 'draft_resume',
      action: { kind: 'resume_recording' },
      reason: 'saved_draft',
    });
    expect(dreamIdOf(result.action)).toBeUndefined();
  });

  it('treats first use as empty capture, never account or paywall', () => {
    expect(resolveTodayState(input())).toEqual({
      id: 'empty',
      action: { kind: 'start_capture' },
      reason: 'first_use',
    });
  });

  it('continues an unanalyzed today dream before asking for a new capture', () => {
    const result = resolveTodayState(
      input({ dreams: [yesterdayDream, unanalyzedToday] })
    );

    expect(result).toEqual({
      id: 'continue_today',
      action: { kind: 'open_dream', dreamId: 28 },
      reason: 'today_dream_unanalyzed',
    });
    expect(dreamIdOf(result.action)).toBe(28);
  });

  it('marks capture due on a silent day that already has a journal', () => {
    expect(resolveTodayState(input({ dreams: [yesterdayDream] }))).toEqual({
      id: 'capture_due',
      action: { kind: 'start_capture' },
      reason: 'no_dream_today',
    });
  });

  it('offers optional deepen when today is analyzed but not explored', () => {
    const result = resolveTodayState(input({ dreams: [analyzedToday] }));

    expect(result).toEqual({
      id: 'optional_deepen',
      action: { kind: 'open_dream', dreamId: 29 },
      reason: 'today_dream_unexplored',
    });
    expect(dreamIdOf(result.action)).toBe(29);
  });

  it('rests after a completed today dream instead of competing with streak or catalogue', () => {
    const result = resolveTodayState(input({ dreams: [exploredToday] }));

    expect(result).toEqual({
      id: 'rest',
      action: { kind: 'open_journal' },
      reason: 'today_complete',
    });
    expect(dreamIdOf(result.action)).toBeUndefined();
  });

  it('resets at local midnight without carrying yesterday rest into today', () => {
    const beforeMidnight = resolveTodayState(
      input({
        now: Date.UTC(2026, 7, 27, 23, 59),
        dreams: [yesterdayDream],
      })
    );
    const afterMidnight = resolveTodayState(
      input({
        now: Date.UTC(2026, 7, 28, 0, 0),
        dreams: [yesterdayDream],
      })
    );

    expect(beforeMidnight).toEqual({
      id: 'rest',
      action: { kind: 'open_journal' },
      reason: 'today_complete',
    });
    expect(afterMidnight).toEqual({
      id: 'capture_due',
      action: { kind: 'start_capture' },
      reason: 'no_dream_today',
    });
  });
});
