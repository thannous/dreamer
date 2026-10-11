import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { SleepSoundConfig } from '@/lib/sleepSounds';

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

  directory.create({ idempotent: true, intermediates: true });
  // Android streams into the destination, so a failed download can leave a
  // partial file behind: write to a temporary name and move it into place.
  const partial = new File(directory, `${fileName}.part`);
  const downloaded = await File.downloadFileAsync(sound.remoteUrl, partial, { idempotent: true });
  downloaded.move(target);
  removeSupersededCopy(directory, sound.id, fileName);
  return target.uri;
}

/** The first builds kept each loop as `<id>.m4a`; drop it once its replacement is in place. */
function removeSupersededCopy(directory: Directory, soundId: string, fileName: string) {
  const legacy = new File(directory, `${soundId}.m4a`);
  if (legacy.uri === new File(directory, fileName).uri || !legacy.exists) return;
  try {
    legacy.delete();
  } catch {
    // Housekeeping only: a stale copy costs space, never playback.
  }
}
