import type { BreathingPatternId } from '@/content/breathing';
import type { AppLanguage, MeditationSession, PracticeEntry } from '@/lib/types';

/**
 * What a free listener may do, and what asks for Noctalia Plus.
 *
 * Pure on purpose: the paywall is the one part of the app where a wrong answer
 * either loses money or, far worse, blocks someone from a practice they were
 * promised. None of it should depend on a native module to be checked.
 */

export type SubscriptionTier = 'free' | 'plus';

/** Free listens per calendar month, across the whole catalogue. */
export const FREE_PLAYS_PER_MONTH = 3;

/** Breathing patterns a free listener can run. */
const FREE_PATTERNS: BreathingPatternId[] = ['calm', 'box', 'coherent'];

/** Longest fade timer a free listener can set, in minutes. */
export const FREE_FADE_TIMER_MAX_MIN = 15;

export type GateReason =
  | 'premium-session'
  | 'monthly-quota'
  | 'premium-pattern'
  | 'premium-timer';

export type Gate = { allowed: true } | { allowed: false; reason: GateReason };

const ALLOWED: Gate = { allowed: true };

/** Sessions listened to in the calendar month of `today` (`YYYY-MM`). */
export function playsThisMonth(log: PracticeEntry[], today: string): number {
  const month = today.slice(0, 7);
  return log.filter((entry) => entry.sessionId && entry.dateISO.startsWith(month)).length;
}

export function canPlaySession(
  session: MeditationSession,
  tier: SubscriptionTier,
  monthlyPlays: number
): Gate {
  if (tier === 'plus') return ALLOWED;
  if (session.isPremium) return { allowed: false, reason: 'premium-session' };
  if (monthlyPlays >= FREE_PLAYS_PER_MONTH) return { allowed: false, reason: 'monthly-quota' };
  return ALLOWED;
}

/**
 * Breathing stays open, with one exception.
 *
 * `coherent` is deliberately free: it is the rhythm the whole interface
 * breathes at, and charging for the thing the app already does everywhere would
 * be indefensible. Only 4-7-8, presented as the sleep technique, asks for Plus.
 */
export function canUseBreathingPattern(
  patternId: BreathingPatternId,
  tier: SubscriptionTier
): Gate {
  if (tier === 'plus') return ALLOWED;
  if (FREE_PATTERNS.includes(patternId)) return ALLOWED;
  return { allowed: false, reason: 'premium-pattern' };
}

export function canUseFadeTimer(minutes: number | null, tier: SubscriptionTier): Gate {
  if (tier === 'plus' || minutes === null) return ALLOWED;
  if (minutes <= FREE_FADE_TIMER_MAX_MIN) return ALLOWED;
  return { allowed: false, reason: 'premium-timer' };
}

/** Free listens left this month. Never negative, and meaningless for Plus. */
export function remainingFreePlays(tier: SubscriptionTier, monthlyPlays: number): number {
  if (tier === 'plus') return Number.POSITIVE_INFINITY;
  return Math.max(0, FREE_PLAYS_PER_MONTH - monthlyPlays);
}

/** First local calendar day of the next month — when the free quota resets. */
export function freeQuotaResetDay(today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`;
}

const RESET_DATE_LOCALES: Record<AppLanguage, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
};

/**
 * Human date for the quota reset. Never returns a raw `YYYY-MM-DD` string:
 * that looks like a system token on a practice screen.
 */
export function formatQuotaResetDate(day: string, language: AppLanguage): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, date));

  return new Intl.DateTimeFormat(RESET_DATE_LOCALES[language] ?? 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utc);
}
