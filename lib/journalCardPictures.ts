import { getDreamIdentityKey } from '@/lib/dreamIdentity';
import { getDreamImageVersion } from '@/lib/imageUtils';
import type { DreamAnalysis } from '@/lib/types';

type CardPicture = { uri: string; cacheKey?: string };

/** Enough for the cards a reader passes in a session; the oldest is forgotten first. */
const KEPT = 120;
const shown = new Map<string, CardPicture>();

/** One account's view of one version of a dream's painting. */
export function getCardPictureKey(accessScope: string | null, dream: DreamAnalysis): string {
  return JSON.stringify([accessScope, getDreamIdentityKey(dream), dream.imageUrl ?? null, getDreamImageVersion(dream) ?? null]);
}

/** A journal card put this picture on screen: its source and cache, exactly. */
export function rememberCardPicture(key: string, picture: CardPicture): void {
  shown.delete(key);
  shown.set(key, picture);
  if (shown.size > KEPT) shown.delete(shown.keys().next().value!);
}

/** The picture a journal card last showed of this dream, known at once, before anything resolves. */
export function recallCardPicture(key: string): CardPicture | undefined {
  return shown.get(key);
}
