import { getLocalDateKey } from '@/lib/ritualProgressUtils';
import type { DreamAnalysis } from '@/lib/types';

/** A dream noted on this very date, a month or a year ago: shown that day only. */
export type DreamAnniversary = { dream: DreamAnalysis; span: 'month' | 'year' };

/** One day of the widget's timeline: from its midnight to the next, this anniversary. */
export type AnniversaryDay = { from: number; until: number; anniversary: DreamAnniversary };

const isPainted = (dream: DreamAnalysis) =>
  Boolean(dream.imageUrl?.trim() || dream.thumbnailUrl?.trim()) && !dream.imageGenerationFailed;

/**
 * The same date a year back, then a month back. A date that month or year never had (the
 * 31st after a 30-day month, the 29th of February) has no anniversary.
 */
function anniversaryDays(day: Date): { span: DreamAnniversary['span']; key: string }[] {
  const year = new Date(day.getFullYear() - 1, day.getMonth(), day.getDate(), 12);
  const month = new Date(day.getFullYear(), day.getMonth() - 1, day.getDate(), 12);
  return [
    ...(year.getDate() === day.getDate() ? [{ span: 'year' as const, key: getLocalDateKey(year) }] : []),
    ...(month.getDate() === day.getDate() ? [{ span: 'month' as const, key: getLocalDateKey(month) }] : []),
  ];
}

/** Each day's dream: a painted one before an unpainted one, then the last of that day. */
function dreamsByDay(dreams: readonly DreamAnalysis[], painted: boolean): Map<string, DreamAnalysis> {
  const byDay = new Map<string, DreamAnalysis>();
  for (const dream of dreams) {
    if (!Number.isFinite(dream.id) || (painted && !isPainted(dream))) continue;
    const key = getLocalDateKey(new Date(dream.id));
    const kept = byDay.get(key);
    const rank = Number(isPainted(dream)) - Number(kept ? isPainted(kept) : false);
    if (!kept || rank > 0 || (rank === 0 && dream.id > kept.id)) byDay.set(key, dream);
  }
  return byDay;
}

function anniversaryOn(byDay: Map<string, DreamAnalysis>, day: Date): DreamAnniversary | null {
  for (const { span, key } of anniversaryDays(day)) {
    const dream = byDay.get(key);
    if (dream) return { dream, span };
  }
  return null;
}

/**
 * The dream noted on today's date a year ago, or else a month ago. `painted` keeps to
 * painted dreams, as the home screen widget does.
 */
export function pickDreamAnniversary(
  dreams: readonly DreamAnalysis[],
  now: number,
  { painted = false }: { painted?: boolean } = {},
): DreamAnniversary | null {
  return anniversaryOn(dreamsByDay(dreams, painted), new Date(now));
}

/**
 * The painted anniversaries of today and the next `days` days, each from its local midnight
 * to the next: the widget lays them ahead, so the home screen keeps them without the app.
 */
export function upcomingAnniversaries(
  dreams: readonly DreamAnalysis[],
  now: number,
  days: number,
): AnniversaryDay[] {
  const byDay = dreamsByDay(dreams, true);
  const today = new Date(now);
  const upcoming: AnniversaryDay[] = [];
  for (let offset = 0; offset <= days; offset += 1) {
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset).getTime();
    const until = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset + 1).getTime();
    const anniversary = anniversaryOn(byDay, new Date(from + (until - from) / 2));
    if (anniversary) upcoming.push({ from, until, anniversary });
  }
  return upcoming;
}
