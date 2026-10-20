import { Directory, File, Paths } from 'expo-file-system';

import { matchesDreamTarget } from '@/lib/dreamIdentity';
import { resolveWithDiskCache } from '@/lib/dreamMediaDiskCache';
import { getDreamRouteParams } from '@/lib/dreamRoute';
import { lastDreamImageKey } from '@/lib/homeWidgets';
import { createScopedLogger } from '@/lib/logger';
import type { DreamAnalysis } from '@/lib/types';
import { appLink, getNoctaliaWidgets } from '@/services/noctaliaWidgets';

const log = createScopedLogger('[LastDreamWidget]');

const PAINTING_PREFIX = 'last-dream-';
/** Wide enough for the medium widget on the largest iPhone, small enough for its memory. */
const PAINTING_WIDTH = 720;

/**
 * Copies the dream's painting into the folder the widgets read, sized for them. A painting
 * already there is not fetched again. The one it replaces stays until the widget moves on.
 */
async function copyPainting(dream: DreamAnalysis, userId: string | null, directory: string): Promise<string> {
  const key = lastDreamImageKey(dream, userId);
  const target = new File(new Directory(directory), `${PAINTING_PREFIX}${key}.jpg`);
  if (!target.exists) {
    const media = await resolveWithDiskCache(dream, userId, false);
    const source = media.imageStatus === 'ready' && media.imageUrl ? media.imageUrl : media.thumbnailUrl;
    if (!source) throw new Error(`No painting for the widget (${media.imageStatus})`);
    const download = /^https?:/i.test(source)
      ? await File.downloadFileAsync(source, new File(Paths.cache, `${PAINTING_PREFIX}${key}.download`), { idempotent: true })
      : null;
    try {
      // Loaded with the first painting, not with the app.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { manipulateAsync, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
      const sized = await manipulateAsync(download?.uri ?? source, [{ resize: { width: PAINTING_WIDTH } }], {
        compress: 0.82,
        format: SaveFormat.JPEG,
      });
      await new File(sized.uri).move(target);
    } finally {
      if (download?.exists) download.delete();
    }
  }
  return target.uri;
}

/** Removes the paintings the widget no longer shows: another dream's, or every one after a sign-out. */
function removePaintings(shared: Directory, keep?: string): void {
  for (const entry of shared.exists ? shared.list() : []) {
    if (entry instanceof File && entry.name.startsWith(PAINTING_PREFIX) && entry.uri !== keep) entry.delete();
  }
}

type LastDreamUpdate = {
  dream: DreamAnalysis | null;
  userId: string | null;
  /** The dream's title, or its untitled wording, in the app's language. */
  title: string;
  date: string | null;
  empty: string;
};

/** Whose dream the widget shows, as far as this launch knows. */
let shown: { userId: string | null; dream: Pick<DreamAnalysis, 'id' | 'remoteId' | 'clientRequestId'> } | null = null;
let latest = 0;
let queue: Promise<unknown> = Promise.resolve();

async function publish({ dream, userId, title, date, empty }: LastDreamUpdate, current: () => boolean): Promise<boolean> {
  const found = getNoctaliaWidgets();
  if (!found) return false;
  const clear = () => {
    found.lastDream.updateSnapshot({ url: appLink('recording'), empty });
    shown = null;
    if (found.directory) removePaintings(new Directory(found.directory));
  };
  if (!dream || !found.directory) {
    clear();
    return true;
  }
  const image = await copyPainting(dream, userId, found.directory).catch((error: unknown) => {
    log.warn('Painting not copied for the widget', error);
    return null;
  });
  // A newer update is on its way: this one would only put an older state back.
  if (!current()) return false;
  if (!image) {
    // Offline, the widget may stay on an older dream of the same dreamer, or on this very
    // dream, for a while. Never on another dreamer's dream (a sign-out), nor on a dream as
    // new as this one or newer (a deletion: a synced dream may share this one's local id).
    const kept = shown?.userId === userId && (shown.dream.id < dream.id || matchesDreamTarget(shown.dream, dream));
    if (!kept) clear();
    return false;
  }
  // The same identity as the journal's own links: an id alone opens nothing when two match.
  const { id, ...identity } = getDreamRouteParams(dream);
  found.lastDream.updateSnapshot({
    image,
    title,
    ...(date ? { date } : {}),
    url: appLink(`journal/${id}`, identity),
    empty,
  });
  shown = { userId, dream: { id: dream.id, remoteId: dream.remoteId, clientRequestId: dream.clientRequestId } };
  // Only now is the painting it showed no longer needed.
  removePaintings(new Directory(found.directory), image);
  return true;
}

/**
 * Lays the last painted dream on the home screen widget, or its waiting words when there
 * is none. Updates run one at a time, and only the latest is laid. A painting that cannot
 * be fetched now (offline) leaves an older dream of the same dreamer in place and clears
 * anything else; the result is false until the widget shows this dream.
 */
export function updateLastDreamWidget(update: LastDreamUpdate): Promise<boolean> {
  const turn = ++latest;
  const current = () => turn === latest;
  const run = queue
    .then(() => (current() ? publish(update, current) : false))
    .catch((error: unknown) => {
      log.warn('Last dream widget not updated', error);
      return false;
    });
  queue = run;
  return run;
}
