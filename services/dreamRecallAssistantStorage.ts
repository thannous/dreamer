import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  hydrateDreamRecallAssistantState,
  serializeDreamRecallAssistantState,
  type DreamRecallAssistantState,
} from '@/lib/dreamRecallAssistant';

const KEY_PREFIX = 'dream_recall_assistant:';

function assertDreamId(dreamId: string): string {
  if (typeof dreamId !== 'string' || dreamId.trim().length === 0) {
    throw new Error('dreamId is required for dream recall assistant storage.');
  }
  return dreamId;
}

export function getKey(dreamId: string): string {
  return `${KEY_PREFIX}${assertDreamId(dreamId)}`;
}

export async function load(dreamId: string): Promise<DreamRecallAssistantState | null> {
  const key = getKey(dreamId);
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;

  const hydrated = hydrateDreamRecallAssistantState(raw);
  if (!hydrated.ok) {
    throw new Error(`Cannot restore dream recall assistant: ${hydrated.reason}.`);
  }
  if (hydrated.state.dreamId !== dreamId) throw new Error('Dream recall assistant identity mismatch.');
  return hydrated.state;
}

export async function save(state: DreamRecallAssistantState): Promise<void> {
  const key = getKey(state.dreamId);
  await AsyncStorage.setItem(key, serializeDreamRecallAssistantState(state));
}

export async function remove(dreamId: string): Promise<void> {
  await AsyncStorage.removeItem(getKey(dreamId));
}
