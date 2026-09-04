import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  serializeVoiceLiveSpikeState,
  startVoiceLiveSpike,
  type VoiceLiveSpikeState,
} from '@/lib/voiceLiveSpike';
import {
  VOICE_LIVE_SPIKE_DEBUG_STORAGE_KEY,
  VOICE_LIVE_SPIKE_FLAG_STORAGE_KEY,
  VOICE_LIVE_SPIKE_SESSION_KEY_PREFIX,
} from '@/lib/voiceLiveSpikeHost';

const DREAM_ID = 'voice-live-spike-fixture';
const ORIGINAL = 'A quiet blue door stood at the end of a wet street.';

const mockStorage = new Map<string, string>();
const mockAsyncStorage = {
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
  ...mockAsyncStorage,
}));

const {
  getKey,
  load,
  loadDebugEnabled,
  loadFeatureEnabled,
  remove,
  save,
  saveDebugEnabled,
  saveFeatureEnabled,
} = require('../voiceLiveSpikeStorage') as typeof import('../voiceLiveSpikeStorage');

function startedState(): VoiceLiveSpikeState {
  return startVoiceLiveSpike({
    dreamId: DREAM_ID,
    originalTranscript: ORIGINAL,
    originalPersistedSegmentId: 'voice-live-spike-original',
    now: 1_700_000_000_000,
    mode: 'chat',
    eligibility: {
      canCaptureAudio: true,
      speechAvailable: true,
      remainingQuota: 3,
      network: 'online',
      featureEnabled: true,
    },
  }).state;
}

describe('voiceLiveSpikeStorage', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockAsyncStorage.getItem.mockReset().mockImplementation((key: string) =>
      Promise.resolve(mockStorage.get(key) ?? null)
    );
    mockAsyncStorage.setItem.mockReset().mockImplementation((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    });
    mockAsyncStorage.removeItem.mockReset().mockImplementation((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    });
  });

  it('uses a dedicated spike key, not the recall assistant sidecar', () => {
    expect(getKey(DREAM_ID)).toBe(`${VOICE_LIVE_SPIKE_SESSION_KEY_PREFIX}${DREAM_ID}`);
    expect(getKey(DREAM_ID)).not.toContain('dream_recall_assistant:');
  });

  it('round-trips a session on the spike lane', async () => {
    const state = startedState();
    await save(state);
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      `${VOICE_LIVE_SPIKE_SESSION_KEY_PREFIX}${DREAM_ID}`,
      serializeVoiceLiveSpikeState(state)
    );
    await expect(load(DREAM_ID)).resolves.toEqual(state);
  });

  it('removes only the spike lane for that dream', async () => {
    await save(startedState());
    mockStorage.set('dream_recall_assistant:voice-live-spike-fixture', '{"keep":true}');
    await remove(DREAM_ID);
    expect(mockStorage.has(`${VOICE_LIVE_SPIKE_SESSION_KEY_PREFIX}${DREAM_ID}`)).toBe(false);
    expect(mockStorage.get('dream_recall_assistant:voice-live-spike-fixture')).toBe('{"keep":true}');
  });

  it('stores debug enablement and the feature flag on separate keys', async () => {
    await expect(loadDebugEnabled()).resolves.toBe(false);
    await expect(loadFeatureEnabled()).resolves.toBe(false);
    await saveDebugEnabled(true);
    await saveFeatureEnabled(true);
    expect(mockStorage.get(VOICE_LIVE_SPIKE_DEBUG_STORAGE_KEY)).toBe('true');
    expect(mockStorage.get(VOICE_LIVE_SPIKE_FLAG_STORAGE_KEY)).toBe('true');
    await expect(loadDebugEnabled()).resolves.toBe(true);
    await expect(loadFeatureEnabled()).resolves.toBe(true);
  });
});
