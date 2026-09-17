import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getVoiceLiveSpikeSessionKey,
  VOICE_LIVE_SPIKE_DEBUG_STORAGE_KEY,
  VOICE_LIVE_SPIKE_FLAG_STORAGE_KEY,
} from '@/lib/voiceLiveSpikeHost';
import {
  hydrateVoiceLiveSpikeState,
  serializeVoiceLiveSpikeState,
  type VoiceLiveSpikeState,
} from '@/lib/voiceLiveSpike';

function assertDreamId(dreamId: string): string {
  if (typeof dreamId !== 'string' || dreamId.trim().length === 0) {
    throw new Error('dreamId is required for the voice live spike storage lane.');
  }
  return dreamId.trim();
}

export function getKey(dreamId: string): string {
  return getVoiceLiveSpikeSessionKey(assertDreamId(dreamId));
}

export async function load(dreamId: string): Promise<VoiceLiveSpikeState | null> {
  const key = getKey(dreamId);
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
  if (raw == null) return null;

  const hydrated = hydrateVoiceLiveSpikeState(raw);
  if (!hydrated.ok) {
    await AsyncStorage.removeItem(key).catch(() => undefined);
    return null;
  }
  return hydrated.state;
}

export async function save(state: VoiceLiveSpikeState): Promise<void> {
  const key = getKey(state.dreamId);
  await AsyncStorage.setItem(key, serializeVoiceLiveSpikeState(state));
}

export async function remove(dreamId: string): Promise<void> {
  await AsyncStorage.removeItem(getKey(dreamId));
}

async function readToggle(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === 'true';
  } catch {
    return false;
  }
}

async function writeToggle(key: string, enabled: boolean): Promise<void> {
  if (enabled) {
    await AsyncStorage.setItem(key, 'true');
    return;
  }
  await AsyncStorage.removeItem(key);
}

export async function loadDebugEnabled(): Promise<boolean> {
  return readToggle(VOICE_LIVE_SPIKE_DEBUG_STORAGE_KEY);
}

export async function saveDebugEnabled(enabled: boolean): Promise<void> {
  await writeToggle(VOICE_LIVE_SPIKE_DEBUG_STORAGE_KEY, enabled);
}

export async function loadFeatureEnabled(): Promise<boolean> {
  return readToggle(VOICE_LIVE_SPIKE_FLAG_STORAGE_KEY);
}

export async function saveFeatureEnabled(enabled: boolean): Promise<void> {
  await writeToggle(VOICE_LIVE_SPIKE_FLAG_STORAGE_KEY, enabled);
}
