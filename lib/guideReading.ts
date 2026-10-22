import type { DreamGuideId } from '@/lib/dreamGuideTypes';

export const GUIDE_READING_IDS: readonly DreamGuideId[] = [
  'understand-dreams', 'remember-dreams', 'dream-journal', 'lucid-dreaming',
  'most-common-dream-symbols', 'scary-dream-symbols', 'animal-dream-symbols', 'water-dream-symbols',
];
export type GuideReadingScope = 'guest' | `user:${string}`;
export type GuideReadingEntry = { section: number; updatedAt: number; completedAt?: number };
export type GuideReadingEntries = Partial<Record<DreamGuideId, GuideReadingEntry>>;
export type GuideReadingStatus = 'new' | 'visited' | 'inProgress' | 'completed';

export function guideReadingStatus(entry?: GuideReadingEntry): GuideReadingStatus {
  return entry?.completedAt ? 'completed' : entry ? entry.section > 0 ? 'inProgress' : 'visited' : 'new';
}

export function parseGuideReading(value: unknown): GuideReadingEntries {
  const entries: GuideReadingEntries = {};
  if (!value || typeof value !== 'object') return entries;
  for (const id of GUIDE_READING_IDS) {
    const entry = (value as Record<string, unknown>)[id] as GuideReadingEntry | undefined;
    if (!entry || !Number.isInteger(entry.section) || entry.section < 0 || entry.section > 100
      || !Number.isSafeInteger(entry.updatedAt) || entry.updatedAt <= 0) continue;
    entries[id] = { section: entry.section, updatedAt: entry.updatedAt,
      ...(Number.isSafeInteger(entry.completedAt) && entry.completedAt! > 0 ? { completedAt: entry.completedAt } : {}) };
  }
  return entries;
}

/** Latest bookmark wins; completing a guide is permanent, even if an older device returns. */
export function mergeGuideReading(a: GuideReadingEntries, b: GuideReadingEntries): GuideReadingEntries {
  const result = { ...a };
  for (const id of GUIDE_READING_IDS) {
    const left = a[id]; const right = b[id];
    if (!right) continue;
    if (!left) { result[id] = right; continue; }
    const completedAt = left.completedAt && right.completedAt ? Math.min(left.completedAt, right.completedAt)
      : left.completedAt ?? right.completedAt;
    result[id] = { ...(left.updatedAt > right.updatedAt ? left : right), ...(completedAt ? { completedAt } : {}) };
  }
  return result;
}
