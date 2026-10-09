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
  const target = new File(directory, `${sound.id}.m4a`);
  if (target.exists) return target.uri;

  directory.create({ idempotent: true, intermediates: true });
  // Android streams into the destination, so a failed download can leave a
  // partial file behind: write to a temporary name and move it into place.
  const partial = new File(directory, `${sound.id}.m4a.part`);
  const downloaded = await File.downloadFileAsync(sound.remoteUrl, partial, { idempotent: true });
  downloaded.move(target);
  return target.uri;
}
