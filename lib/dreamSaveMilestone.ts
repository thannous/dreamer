/** Local cohort state: no account, dream content or persistent cohort identifier. */
export const DREAM_RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const UTC_DAY_MS = 24 * 60 * 60 * 1000;
export type DreamSaveCohort = { firstSavedAt: number; returned: boolean };
export type DreamSaveMilestone = { stage: 'first' | 'return_7d'; cohort_day: number };

export function nextDreamSaveMilestone(
  stored: unknown,
  isFirstDream: boolean,
  now: number
): { state: DreamSaveCohort | null; milestone: DreamSaveMilestone | null } {
  const value = stored as Partial<DreamSaveCohort> | null;
  const valid = value && typeof value.firstSavedAt === 'number' &&
    Number.isFinite(value.firstSavedAt) && value.firstSavedAt > 0 &&
    typeof value.returned === 'boolean';
  // Corrupt state cannot establish a new cohort for an existing journal.
  if (!valid) {
    return isFirstDream ? {
      state: { firstSavedAt: now, returned: false },
      milestone: { stage: 'first', cohort_day: Math.floor(now / UTC_DAY_MS) },
    } : { state: null, milestone: null };
  }
  const state = value as DreamSaveCohort;
  if (now < state.firstSavedAt) return { state, milestone: null };
  if (now - state.firstSavedAt > DREAM_RETURN_WINDOW_MS) return { state: null, milestone: null };
  const cohortDay = Math.floor(state.firstSavedAt / UTC_DAY_MS);
  // Another save on the same UTC day is not a return. Repeated first-save callbacks
  // and later saves after the first return cannot produce another milestone.
  if (isFirstDream || state.returned || Math.floor(now / UTC_DAY_MS) <= cohortDay) {
    return { state, milestone: null };
  }
  return {
    state: { ...state, returned: true },
    milestone: { stage: 'return_7d', cohort_day: cohortDay },
  };
}
