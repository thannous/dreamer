import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { SleepSoundConfig, SleepSoundId } from '@/lib/sleepSounds';

const DIRECTORY_SEGMENT = 'sleep-sounds';

/**
 * Returns a playable URI for a sleep sound. The first play downloads the loop
 * from noctalia.app into the document directory, so later sessions stay offline.
 * Web streams the same URL directly.
 */
export async function ensureSleepSoundFile(sound: SleepSoundConfig): Promise<string> {
  if (Platform.OS === 'web') return sound.remoteUrl;

  const directory = new Directory(Paths.document, DIRECTORY_SEGMENT);
  // Named after the published file, so a re-recorded loop (`rain-v2.m4a`) replaces the
  // copy a phone already kept instead of hiding behind it.
  const fileName = sound.remoteUrl.slice(sound.remoteUrl.lastIndexOf('/') + 1);
  const target = new File(directory, fileName);
  if (target.exists) return target.uri;

  const legacy = new File(directory, `${sound.id}.m4a`);
  if (legacy.exists && LEGACY_SOURCES[sound.id] === fileName) {
    // Same recording under the old name: keep it rather than download it again.
    legacy.move(target);
    return target.uri;
  }

  directory.create({ idempotent: true, intermediates: true });
  // Android streams into the destination, so a failed download can leave a
  // partial file behind: write to a temporary name and move it into place.
  const partial = new File(directory, `${fileName}.part`);
  try {
    const downloaded = await File.downloadFileAsync(sound.remoteUrl, partial, { idempotent: true });
    downloaded.move(target);
  } catch (error) {
    // Offline, the older recording still beats silence until the new one arrives.
    if (legacy.exists) return legacy.uri;
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

/**
 * The first builds kept each loop as `<id>.m4a`. This is the published file each of
 * those copies came from, so a copy whose recording has not changed is kept.
 */
const LEGACY_SOURCES: Record<SleepSoundId, string> = {
  rain: 'rain.m4a',
  ocean: 'ocean-waves.m4a',
  'brown-noise': 'brown-noise.m4a',
};
