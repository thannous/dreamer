import {
  isLucidDateKey,
  isLucidTimeZone,
  LUCID_TECHNIQUES,
  type LucidProgramProgress,
  type LucidTechniqueAutoLink,
} from '@/lib/lucid/model';
import { isLucidMorningVoiceNoteId } from '@/lib/lucid/morningVoiceNote';

export const LUCID_MORNING_VOICE_AUTOSTART_HREF = '/lucid/morning-voice?autoStart=1' as const;

export function getLucidDateKeyInTimeZone(
  timestamp: number,
  timeZone: string
): string | null {
  if (!Number.isFinite(timestamp) || !isLucidTimeZone(timeZone)) return null;

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(timestamp));
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (!year || !month || !day) return null;
    const dateKey = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return isLucidDateKey(dateKey) ? dateKey : null;
  } catch {
    return null;
  }
}

function shiftLucidDateKey(dateKey: string, days: number): string | null {
  if (!isLucidDateKey(dateKey) || !Number.isInteger(days)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  return isLucidDateKey(shifted) ? shifted : null;
}

function newestEligiblePracticeDate(
  progress: LucidProgramProgress,
  eligibleDates: Set<string>
): string | null {
  const dates = progress.practiceDates.filter(
    (date): date is string => isLucidDateKey(date) && eligibleDates.has(date)
  );
  if (dates.length === 0) return null;
  return dates.reduce((latest, date) => (date > latest ? date : latest));
}

/**
 * Snapshot of last night's practiced technique, if real program evidence exists.
 * Eligible dates are today and yesterday in `timeZone` so a WBTB completion
 * after local midnight still belongs to the night that just ended.
 * Never invents a technique and never copies into a user-reported field.
 */
export function resolvePreviousNightTechniqueLink(
  progress: readonly LucidProgramProgress[],
  now: number,
  timeZone: string
): LucidTechniqueAutoLink | null {
  const today = getLucidDateKeyInTimeZone(now, timeZone);
  if (!today) return null;
  const yesterday = shiftLucidDateKey(today, -1);
  if (!yesterday) return null;

  const eligibleDates = new Set([yesterday, today]);
  const candidates = progress.flatMap((item) => {
    if (!LUCID_TECHNIQUES.includes(item.technique)) return [];
    const practiceDate = newestEligiblePracticeDate(item, eligibleDates);
    if (practiceDate === null) return [];
    return [
      {
        technique: item.technique,
        practiceDate,
        updatedAt: item.updatedAt,
      },
    ];
  });

  if (candidates.length === 0) return null;

  const bestDate = candidates.reduce(
    (latest, item) => (item.practiceDate > latest ? item.practiceDate : latest),
    candidates[0].practiceDate
  );
  const tied = candidates.filter((item) => item.practiceDate === bestDate);
  tied.sort(
    (left, right) =>
      right.updatedAt - left.updatedAt ||
      LUCID_TECHNIQUES.indexOf(left.technique) - LUCID_TECHNIQUES.indexOf(right.technique)
  );

  const winner = tied[0];
  return {
    technique: winner.technique,
    source: 'program_practice',
    practiceDate: winner.practiceDate,
  };
}

function firstSearchParam(
  value: string | string[] | null | undefined
): string | null {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return typeof value === 'string' ? value : null;
}

export function parseLucidMorningVoiceNoteIdParam(
  value: string | string[] | null | undefined
): string | null {
  const candidate = firstSearchParam(value)?.trim() ?? '';
  return isLucidMorningVoiceNoteId(candidate) && candidate.startsWith('mvn_')
    ? candidate
    : null;
}

export function shouldAutoStartLucidMorningVoice(
  value: string | string[] | null | undefined
): boolean {
  return firstSearchParam(value) === '1';
}

export function buildLucidMorningReturnHref(noteId: string): string {
  if (!isLucidMorningVoiceNoteId(noteId) || !noteId.startsWith('mvn_')) {
    throw new Error('Invalid Lucid morning voice note id');
  }
  return `/lucid/morning?voiceNoteId=${encodeURIComponent(noteId)}`;
}

export function resolveLucidMorningVoiceRecallText(input: {
  title?: string | null;
  transcript?: string | null;
}): string | null {
  const transcript = input.transcript?.trim() ?? '';
  return transcript || null;
}
