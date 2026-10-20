import { fnv1a32Hex } from '@/lib/dreamAnalysisFreshness';
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

/**
 * What names a widget's painting: whose dream, which dream (two synced dreams may share a
 * local id) and which painting of it, so another dream's painting is never taken for its own.
 * A painting replaced by sync comes without imageUpdatedAt: its reference and the media
 * cache's revision fallback tell it apart.
 */
export function lastDreamImageKey(dream: DreamAnalysis, userId: string | null): string {
  const revision = dream.imageUpdatedAt ?? dream.analysisRequestId ?? dream.analyzedAt ?? '';
  const painting = fnv1a32Hex(`${dream.imageUrl ?? ''}|${dream.thumbnailUrl ?? ''}|${revision}`);
  return [userId ?? 'guest', dream.id, dream.remoteId ?? 'local', dream.clientRequestId ?? 'none', painting]
    .join('-')
    .replace(/[^\w-]/g, '_');
}
