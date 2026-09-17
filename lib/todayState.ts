/**
 * Pure Accueil « Aujourd'hui » kernel (TI-420).
 *
 * One primary state, one CTA. No localized copy, no account/paywall, and no
 * streak/inspiration/catalogue branch that can beat capture. Callers inject
 * `now` and `localDateKey` so tests stay deterministic across timezones.
 */

export type TodayStateId =
  | 'draft_resume'
  | 'empty'
  | 'capture_due'
  | 'continue_today'
  | 'optional_deepen'
  | 'rest';

export type TodayAction =
  | { kind: 'resume_recording' }
  | { kind: 'start_capture' }
  | { kind: 'open_dream'; dreamId: number }
  | { kind: 'open_journal' };

export type TodayActionKind = TodayAction['kind'];

export type TodayReason =
  | 'saved_draft'
  | 'first_use'
  | 'no_dream_today'
  | 'today_dream_unanalyzed'
  | 'today_dream_unexplored'
  | 'today_complete';

export type TodayDreamInput = {
  id: number;
  createdAt?: number;
  date?: number;
  isAnalyzed?: boolean;
  isExplored?: boolean;
};

export type TodayStateInput = {
  now: number;
  localDateKey: (timestamp: number) => string;
  hasDraft: boolean;
  dreams: TodayDreamInput[];
};

export type TodayState = {
  id: TodayStateId;
  action: TodayAction;
  reason: TodayReason;
};

function dreamTimestamp(dream: TodayDreamInput): number {
  return dream.createdAt ?? dream.date ?? dream.id;
}

function pickLatestTodayDream(
  dreams: readonly TodayDreamInput[],
  todayKey: string,
  localDateKey: (timestamp: number) => string
): TodayDreamInput | null {
  let latest: TodayDreamInput | null = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const dream of dreams) {
    const timestamp = dreamTimestamp(dream);
    if (!Number.isFinite(timestamp)) continue;
    if (localDateKey(timestamp) !== todayKey) continue;
    if (!latest || timestamp > latestTimestamp || (timestamp === latestTimestamp && dream.id > latest.id)) {
      latest = dream;
      latestTimestamp = timestamp;
    }
  }

  return latest;
}

export function resolveTodayState(input: TodayStateInput): TodayState {
  const todayKey = input.localDateKey(input.now);
  const todayDream = pickLatestTodayDream(input.dreams, todayKey, input.localDateKey);

  if (input.hasDraft) {
    return {
      id: 'draft_resume',
      action: { kind: 'resume_recording' },
      reason: 'saved_draft',
    };
  }

  if (input.dreams.length === 0) {
    return {
      id: 'empty',
      action: { kind: 'start_capture' },
      reason: 'first_use',
    };
  }

  if (todayDream && todayDream.isAnalyzed !== true) {
    return {
      id: 'continue_today',
      action: { kind: 'open_dream', dreamId: todayDream.id },
      reason: 'today_dream_unanalyzed',
    };
  }

  if (!todayDream) {
    return {
      id: 'capture_due',
      action: { kind: 'start_capture' },
      reason: 'no_dream_today',
    };
  }

  if (todayDream.isExplored !== true) {
    return {
      id: 'optional_deepen',
      action: { kind: 'open_dream', dreamId: todayDream.id },
      reason: 'today_dream_unexplored',
    };
  }

  return {
    id: 'rest',
    action: { kind: 'open_journal' },
    reason: 'today_complete',
  };
}
