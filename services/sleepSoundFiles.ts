import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { SleepSoundConfig, SleepSoundId } from '@/lib/sleepSounds';

const DIRECTORY_SEGMENT = 'sleep-sounds';
/** A download that receives nothing for this long is cancelled and reported as failed. */
const STALL_TIMEOUT_MS = 20_000;

const pendingFiles = new Map<string, Promise<string>>();

/**
 * Returns a playable URI for a sleep sound. `useSleepSoundPlayer` calls it as soon as
 * a sleep sound screen opens (Dreamer's sleep sounds, Lucid's Night), before Play, so
 * the loop is ready when the listener presses it. The first call downloads the
 * selected loop from noctalia.app into the document directory; later sessions reuse
 * that file offline. Web streams the same URL directly.
 */
export function ensureSleepSoundFile(sound: SleepSoundConfig): Promise<string> {
  if (Platform.OS === 'web') return Promise.resolve(sound.remoteUrl);

  // A retry while a slow download is still running joins it instead of writing
  // the same partial file twice.
  const pending = pendingFiles.get(sound.remoteUrl);
  if (pending) return pending;
  const request = resolveSleepSoundFile(sound).finally(() => {
    pendingFiles.delete(sound.remoteUrl);
  });
  pendingFiles.set(sound.remoteUrl, request);
  return request;
}

async function resolveSleepSoundFile(sound: SleepSoundConfig): Promise<string> {
  const directory = new Directory(Paths.document, DIRECTORY_SEGMENT);
  // Named after the published file, so a re-recorded loop (`rain-v2.m4a`) replaces the
  // copy a phone already kept instead of hiding behind it.
  const fileName = sound.remoteUrl.slice(sound.remoteUrl.lastIndexOf('/') + 1);
  const target = new File(directory, fileName);
  if (keepIfPlayable(target)) return target.uri;

  const legacy = new File(directory, `${sound.id}.m4a`);
  const legacyPlayable = keepIfPlayable(legacy);
  if (legacyPlayable && LEGACY_SOURCES[sound.id] === fileName) {
    // Same recording under the old name: keep it rather than download it again.
    await legacy.move(target);
    return target.uri;
  }

  directory.create({ idempotent: true, intermediates: true });
  // Android streams into the destination, so a failed download can leave a
  // partial file behind: write to a temporary name and move it into place.
  const partial = new File(directory, `${fileName}.part`);
  try {
    const downloaded = await downloadWithStallTimeout(sound.remoteUrl, partial);
    if (!isAudioContainer(downloaded)) {
      // A captive portal answers with its own page; never keep that as the loop.
      downloaded.delete();
      throw new Error(`Not an audio file: ${sound.remoteUrl}`);
    }
    await downloaded.move(target);
  } catch (error) {
    // Offline, the older recording still beats silence until the new one arrives.
    if (legacyPlayable) return legacy.uri;
    throw error;
  }
  if (legacy.exists) {
    try {
      legacy.delete();
    } catch {
      // Housekeeping only: a stale copy costs space, never playback.
    }
  }
  return target.uri;
}

async function downloadWithStallTimeout(url: string, destination: File): Promise<File> {
  const controller = new AbortController();
  let stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS);
  try {
    return await File.downloadFileAsync(url, destination, {
      idempotent: true,
      signal: controller.signal,
      onProgress: () => {
        // Slow is fine; silence is not.
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS);
      },
    });
  } finally {
    clearTimeout(stallTimer);
  }
}

/**
 * Whether a cached copy can be played. Earlier builds kept whatever a download returned,
 * so a captive-portal page may sit under the loop's name: drop it, so the next try
 * downloads the sound again instead of reloading the page.
 */
function keepIfPlayable(file: File): boolean {
  if (!file.exists) return false;
  try {
    if (isAudioContainer(file)) return true;
  } catch {
    // An unreadable copy is no better than a missing one.
  }
  try {
    file.delete();
  } catch {
    // The download below writes elsewhere and moves over it.
  }
  return false;
}

/** The loops are AAC in an MP4 container, which names itself `ftyp` at byte 4. */
function isAudioContainer(file: File): boolean {
  const handle = file.open(FileMode.ReadOnly);
  try {
    const header = handle.readBytesSync(8);
    return String.fromCharCode(...header.subarray(4, 8)) === 'ftyp';
  } finally {
    handle.close();
  }
}

/**
 * The first builds kept each loop as `<id>.m4a`. This is the published file each of
 * those copies came from, so a copy whose recording has not changed is kept.
 */
const LEGACY_SOURCES: Record<SleepSoundId, string> = {
  rain: 'rain.m4a',
  ocean: 'ocean-waves.m4a',
  'brown-noise': 'brown-noise.m4a',
};
