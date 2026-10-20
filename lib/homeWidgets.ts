import type { DreamAnalysis } from '@/lib/types';

/** The newest dream with a painting, the one the home screen widget shows. */
export function pickLastPaintedDream(dreams: readonly DreamAnalysis[]): DreamAnalysis | null {
  let last: DreamAnalysis | null = null;
  for (const dream of dreams) {
    const painted = Boolean(dream.imageUrl?.trim() || dream.thumbnailUrl?.trim()) && !dream.imageGenerationFailed;
    if (painted && Number.isFinite(dream.id) && (!last || dream.id > last.id)) last = dream;
  }
  return last;
}

/** What names a widget's painting: a new dream, or the same dream painted again. */
export function lastDreamImageKey(dream: DreamAnalysis): string {
  return `${dream.id}-${dream.imageUpdatedAt ?? 0}`;
}
