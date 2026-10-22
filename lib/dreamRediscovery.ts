import type { DreamAnalysis } from './types';
import { getDreamIdentityKey } from './dreamIdentity';

/** A quiet daily invitation, including unread and unillustrated dreams. */
export function pickDreamRediscovery(dreams: readonly DreamAnalysis[], now: number): DreamAnalysis | null {
  const day = new Date(now);
  const cutoff = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 30).getTime();
  const candidates = dreams.filter(dream => Number.isFinite(dream.id) && dream.id > 0 && dream.id <= cutoff && dream.transcript.trim())
    .sort((a, b) => a.id - b.id || getDreamIdentityKey(a).localeCompare(getDreamIdentityKey(b)));
  if (!candidates.length) return null;
  const dailyIndex = Math.floor(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / 86400000);
  return candidates[dailyIndex % candidates.length];
}
