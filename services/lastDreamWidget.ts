import { Directory, File, Paths } from 'expo-file-system';

import { matchesDreamTarget } from '@/lib/dreamIdentity';
import { resolveWithDiskCache } from '@/lib/dreamMediaDiskCache';
import { getDreamRouteParams } from '@/lib/dreamRoute';
import { lastDreamImageKey } from '@/lib/homeWidgets';
import { createScopedLogger } from '@/lib/logger';
import type { DreamAnalysis } from '@/lib/types';
import { appLink, getNoctaliaWidgets } from '@/services/noctaliaWidgets';
import type { LastDreamWidgetProps } from '@/widgets/LastDreamWidget';

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
function removePaintings(shared: Directory, keep: readonly string[] = []): void {
  for (const entry of shared.exists ? shared.list() : []) {
    if (entry instanceof File && entry.name.startsWith(PAINTING_PREFIX) && !keep.includes(entry.uri)) entry.delete();
  }
}

/** A day the widget gives to a dream noted on that date a month or a year before. */
export type WidgetAnniversary = {
  /** Its local midnight, and the next one. */
  from: number;
  until: number;
  dream: DreamAnalysis;
  title: string;
  /** « Il y a un mois cette nuit », in the app's language. */
  eyebrow: string;
};

type LastDreamUpdate = {
  dream: DreamAnalysis | null;
  userId: string | null;
  /** The dream's title, or its untitled wording, in the app's language. */
  title: string;
  date: string | null;
  /** The same day without its weekday, for the small widget. */
  shortDate?: string | null;
  empty: string;
  /** The coming days that show an anniversary instead, oldest first. */
  anniversaries?: readonly WidgetAnniversary[];
};

/** The link that opens a dream, with the journal's own identity: an id alone opens nothing when two match. */
function dreamLink(dream: DreamAnalysis): string {
  const { id, ...identity } = getDreamRouteParams(dream);
  return appLink(`journal/${id}`, identity);
}

/** Whose dream the widget shows, as far as this launch knows. */
let shown: { userId: string | null; dream: Pick<DreamAnalysis, 'id' | 'remoteId' | 'clientRequestId'> } | null = null;
let latest = 0;
let queue: Promise<unknown> = Promise.resolve();

async function publish({ dream, userId, title, date, shortDate, empty, anniversaries = [] }: LastDreamUpdate, current: () => boolean): Promise<boolean> {
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
  const last: LastDreamWidgetProps = {
    image,
    title,
    ...(date ? { date } : {}),
    ...(shortDate ? { shortDate } : {}),
    url: dreamLink(dream),
    empty,
  };
  // An anniversary whose painting cannot be fetched now leaves its day to the last dream.
  const days: { from: number; until: number; props: LastDreamWidgetProps & { image: string } }[] = [];
  for (const day of anniversaries) {
    const painting = await copyPainting(day.dream, userId, found.directory).catch((error: unknown) => {
      log.warn('Anniversary painting not copied for the widget', error);
      return null;
    });
    if (painting) days.push({ ...day, props: { image: painting, title: day.title, eyebrow: day.eyebrow, url: dreamLink(day.dream), empty } });
  }
  if (!current()) return false;
  if (days.length === 0) {
    found.lastDream.updateSnapshot(last);
  } else {
    // The last dream, then each anniversary from its midnight to the next, then the last dream again.
    const timeline: { date: Date; props: LastDreamWidgetProps }[] = [];
    let cursor = Date.now();
    for (const day of days) {
      if (day.until <= cursor) continue;
      if (day.from > cursor) timeline.push({ date: new Date(cursor), props: last });
      timeline.push({ date: new Date(Math.max(day.from, cursor)), props: day.props });
      cursor = day.until;
    }
    timeline.push({ date: new Date(cursor), props: last });
    found.lastDream.updateTimeline(timeline);
  }
  shown = { userId, dream: { id: dream.id, remoteId: dream.remoteId, clientRequestId: dream.clientRequestId } };
  // Only now are the paintings it showed no longer needed.
  removePaintings(new Directory(found.directory), [image, ...days.map((day) => day.props.image)]);
  // An anniversary left out for now is tried again on the next update.
  return days.length === anniversaries.length;
}

/**
 * Lays the last painted dream on the home screen widget, or its waiting words when there
 * is none, giving the coming anniversaries their days. Updates run one at a time, and
 * only the latest is laid. A painting that cannot be fetched now (offline) leaves an
 * older dream of the same dreamer in place and clears anything else; the result is false
 * until the widget shows this dream and each of its coming anniversaries.
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
