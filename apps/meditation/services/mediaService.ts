import type { AudioSource } from 'expo-audio';

import { getMediaBaseUrl } from '@/lib/env';
import type { SessionId } from '@/lib/types';

/**
 * Where a session's audio comes from.
 *
 * Only a handful of sessions ship inside the bundle — 24 narrations at 48 kbps
 * is roughly 86 MB, well past what an app should carry (spec §8.2). The rest
 * are served as static files from the media bucket.
 *
 * PLACEHOLDER: no narration has been recorded yet, so the bundled sessions
 * point at an ambience loop. That makes the player genuinely testable today;
 * swapping in the real files changes this map and nothing else.
 */
const PLACEHOLDER = require('@/assets/audio/ambience/rain.m4a');

const BUNDLED: Record<SessionId, AudioSource> = {
  'sleep-descent': PLACEHOLDER,
  'sleep-quick-fall': PLACEHOLDER,
  'stress-shoulders': PLACEHOLDER,
  'anxiety-ground': PLACEHOLDER,
};

export type ResolvedAudio =
  | { kind: 'bundled'; source: AudioSource }
  | { kind: 'remote'; source: AudioSource; url: string }
  /** No bucket configured, or no network on first play. A real product state. */
  | { kind: 'unavailable' };

export const isBundled = (sessionId: SessionId): boolean => sessionId in BUNDLED;

/**
 * Resolves what to hand the player.
 *
 * `expo-audio` streams a remote URL and can be told to download first, so this
 * deliberately does NOT reimplement a download queue: the explicit
 * "keep offline" button is v1.2 (spec §19), and until then the platform's own
 * buffering is the right amount of machinery.
 */
export function resolveSessionAudio(sessionId: SessionId): ResolvedAudio {
  const bundled = BUNDLED[sessionId];
  if (bundled) return { kind: 'bundled', source: bundled };

  const base = getMediaBaseUrl();
  if (!base) return { kind: 'unavailable' };

  const url = `${base.replace(/\/$/, '')}/sessions/${sessionId}.m4a`;
  return { kind: 'remote', url, source: { uri: url } };
}
