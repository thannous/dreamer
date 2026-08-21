/**
 * Pure decision logic for the two engagement reminder families:
 *
 * - **streak risk** — one evening heads-up on the night an ongoing journaling
 *   streak would quietly end;
 * - **inactivity** — two comeback nudges, after 3 and after 7 silent nights,
 *   and nothing afterwards.
 *
 * Both are one-shot (dated) reminders: they are recomputed and rescheduled
 * every time a dream is saved or the app comes back to the foreground, so the
 * plan always reflects the freshest `now`.
 *
 * No React, no service and no platform import here — this module is the part
 * that unit tests can pin down.
 */

import { calculateStreaks } from './streakUtils';
import type { DreamAnalysis } from './types';

/** Local hour at which the "your streak ends tonight" reminder fires. */
export const STREAK_RISK_HOUR = 21;

/** Local hour at which the 3-night / 7-night comeback reminders fire. */
export const INACTIVITY_REMINDER_HOUR = 20;

/**
 * Below two nights there is nothing worth protecting: a single dream is not a
 * streak yet, and warning about it would read as pressure rather than help.
 */
export const MIN_STREAK_FOR_RISK_REMINDER = 2;

/** Silent nights after which a comeback reminder is sent. Nothing after the last one. */
export const INACTIVITY_REMINDER_DAYS = [3, 7] as const;

export type InactivityReminderStage = (typeof INACTIVITY_REMINDER_DAYS)[number];

export type StreakRiskReminderPlan = {
  /** Epoch ms of the evening the streak would end. Always strictly in the future. */
  triggerAt: number;
  /** Nights already recorded in the streak, used verbatim in the copy. */
  streakLength: number;
};

export type InactivityReminderPlan = {
  stage: InactivityReminderStage;
  /** Epoch ms of the evening this stage fires. Always strictly in the future. */
  triggerAt: number;
};

export type EngagementReminderPlan = {
  streakRisk: StreakRiskReminderPlan | null;
  inactivity: InactivityReminderPlan[];
};

/** Midnight of the local day a timestamp belongs to. */
export function startOfLocalDay(timestamp: number): Date {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Whole local calendar days between two instants, DST-safe.
 *
 * `Math.floor(deltaMs / 86_400_000)` is wrong twice a year: two calendar days
 * across a spring-forward boundary span 47 h and would count as one. Rounding
 * the quotient of two local midnights restores the calendar semantics.
 */
export function differenceInCalendarDays(later: number, earlier: number): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((startOfLocalDay(later).getTime() - startOfLocalDay(earlier).getTime()) / dayMs);
}

/** Local `hour:00` of the day `dayOffset` calendar days after `from`. */
export function localEvening(from: number, dayOffset: number, hour: number): number {
  const date = startOfLocalDay(from);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

/**
 * Newest dream timestamp. Dream ids double as the recording date
 * (`DreamAnalysis.id` is epoch ms), and remote ids are rebuilt from
 * `created_at`, so the max is recomputed rather than remembered.
 */
export function getLatestDreamTimestamp(dreams: readonly DreamAnalysis[]): number | null {
  let latest: number | null = null;
  for (const dream of dreams) {
    if (typeof dream.id === 'number' && Number.isFinite(dream.id) && (latest === null || dream.id > latest)) {
      latest = dream.id;
    }
  }
  return latest;
}

/**
 * The evening reminder for a streak about to end, or `null` when there is
 * nothing to protect.
 *
 * A streak stays alive for the whole day following its last entry, so the night
 * it actually ends is:
 * - a dream recorded **today** → tomorrow evening;
 * - a dream recorded **yesterday** → tonight.
 *
 * Anything older means the streak is already broken (`current` is 0) and no
 * reminder is produced. A user who already recorded today is therefore never
 * warned tonight — only pre-armed for the following evening, which the next
 * save cancels.
 */
export function resolveStreakRiskPlan(
  dreams: readonly DreamAnalysis[],
  now: number,
  hour: number = STREAK_RISK_HOUR
): StreakRiskReminderPlan | null {
  const lastDreamAt = getLatestDreamTimestamp(dreams);
  if (lastDreamAt === null) {
    return null;
  }

  const streakLength = calculateStreaks([...dreams], now).current;
  if (streakLength < MIN_STREAK_FOR_RISK_REMINDER) {
    return null;
  }

  const daysSinceLastDream = differenceInCalendarDays(now, lastDreamAt);
  // A dream dated in the future (clock skew, server timestamp ahead) would make
  // the offset jump forward; clamp it to today so the reminder stays tomorrow.
  const safeDaysSince = Math.max(0, daysSinceLastDream);
  if (safeDaysSince > 1) {
    return null;
  }

  const triggerAt = localEvening(now, 1 - safeDaysSince, hour);
  if (triggerAt <= now) {
    // The deadline evening has already passed; waking the user at 23:40 to say
    // the streak ends in twenty minutes would only be annoying.
    return null;
  }

  return { triggerAt, streakLength };
}

/**
 * The comeback reminders still ahead: 3 and 7 nights after the last dream,
 * then silence. Stages whose evening is already behind us are dropped, so a
 * user returning after a month is not greeted by a backlog of nudges.
 *
 * Users who never recorded anything get none: the daily morning reminder is
 * their onboarding path, and "we miss your dreams" makes no sense before the
 * first one.
 */
export function resolveInactivityPlan(
  dreams: readonly DreamAnalysis[],
  now: number,
  hour: number = INACTIVITY_REMINDER_HOUR
): InactivityReminderPlan[] {
  const lastDreamAt = getLatestDreamTimestamp(dreams);
  if (lastDreamAt === null) {
    return [];
  }

  const plans: InactivityReminderPlan[] = [];
  for (const stage of INACTIVITY_REMINDER_DAYS) {
    const triggerAt = localEvening(lastDreamAt, stage, hour);
    if (triggerAt > now) {
      plans.push({ stage, triggerAt });
    }
  }
  return plans;
}

/** Both families in one pass, for the scheduler that reschedules them together. */
export function buildEngagementReminderPlan(
  dreams: readonly DreamAnalysis[],
  now: number = Date.now()
): EngagementReminderPlan {
  return {
    streakRisk: resolveStreakRiskPlan(dreams, now),
    inactivity: resolveInactivityPlan(dreams, now),
  };
}

/**
 * Stable signature of a plan, so the scheduler can skip a redundant round-trip
 * to the OS scheduler when nothing changed since the previous run.
 */
export function getEngagementReminderPlanSignature(
  plan: EngagementReminderPlan,
  settings: { streakRiskEnabled?: boolean; inactivityNudgeEnabled?: boolean }
): string {
  const streak = plan.streakRisk
    ? `${plan.streakRisk.triggerAt}:${plan.streakRisk.streakLength}`
    : 'none';
  const inactivity = plan.inactivity.map((entry) => `${entry.stage}@${entry.triggerAt}`).join(',');
  return `${settings.streakRiskEnabled === true ? 1 : 0}|${settings.inactivityNudgeEnabled === true ? 1 : 0}|${streak}|${inactivity}`;
}
