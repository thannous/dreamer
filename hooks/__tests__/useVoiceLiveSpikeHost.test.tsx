/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  captureVoiceLiveSegment,
  markVoiceLiveSegmentPersisted,
  startVoiceLiveSpike,
  type VoiceLiveSpikeState,
} from '@/lib/voiceLiveSpike';
import {
  VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID,
  VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL,
} from '@/lib/voiceLiveSpikeHost';
import { withDevFlag } from '@/tests/setDevFlag';

const NOW = 1_700_000_000_000;
const SEGMENT = 'Rain on the quiet glass.';

let stored: VoiceLiveSpikeState | null = null;
const mockLoad = jest.fn(async (dreamId: string) =>
  stored?.dreamId === dreamId ? stored : null
);
const mockSave = jest.fn(async (state: VoiceLiveSpikeState) => {
  stored = JSON.parse(JSON.stringify(state)) as VoiceLiveSpikeState;
});
const mockRemove = jest.fn(async (dreamId: string) => {
  if (stored?.dreamId === dreamId) stored = null;
});

jest.mock('@/services/voiceLiveSpikeStorage', () => ({
  load: (dreamId: string) => mockLoad(dreamId),
  save: (state: VoiceLiveSpikeState) => mockSave(state),
  remove: (dreamId: string) => mockRemove(dreamId),
  loadDebugEnabled: async () => true,
  loadFeatureEnabled: async () => true,
}));

jest.mock('@/services/voiceLiveSpikeTts', () => ({
  voiceLiveSpikeTts: {
    speak: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
  },
}));

const { useVoiceLiveSpikeHost } =
  require('../useVoiceLiveSpikeHost') as typeof import('../useVoiceLiveSpikeHost');

function listeningSession(): VoiceLiveSpikeState {
  const started = startVoiceLiveSpike({
    dreamId: VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID,
    originalTranscript: VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL,
    originalPersistedSegmentId: 'voice-live-spike-original',
    now: NOW,
    mode: 'chat',
    eligibility: {
      canCaptureAudio: true,
      speechAvailable: true,
      remainingQuota: 5,
      network: 'online',
      featureEnabled: true,
    },
  });
  const captured = captureVoiceLiveSegment(started.state, SEGMENT, NOW + 1, 'seg-rain');
  const persisted = markVoiceLiveSegmentPersisted(captured.state, NOW + 2);
  return {
    ...persisted.state,
    status: 'listening',
    currentUtterance: null,
    pendingUserSegment: null,
  };
}

describe('useVoiceLiveSpikeHost', () => {
  beforeEach(() => {
    stored = null;
    mockLoad.mockClear();
    mockSave.mockClear();
    mockRemove.mockClear();
  });

  it('does not operate when __DEV__ is false', async () => {
    const restore = withDevFlag(false);
    const { result } = renderHook(() =>
      useVoiceLiveSpikeHost({ isDev: false, featureEnabled: true, debugEnabled: true })
    );
    expect(result.current.available).toBe(false);
    expect(result.current.operational).toBe(false);
    expect(result.current.snapshot).toBeNull();
    restore();
  });

  it('hydrates the stored spike lane on remount instead of starting over', async () => {
    stored = listeningSession();
    const { result, unmount } = renderHook(() =>
      useVoiceLiveSpikeHost({ isDev: true, featureEnabled: true, debugEnabled: true })
    );

    await waitFor(() => {
      expect(result.current.snapshot?.state.turns.some((turn) => turn.text === SEGMENT)).toBe(true);
    });
    expect(mockLoad).toHaveBeenCalledWith(VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID);
    unmount();

    const remounted = renderHook(() =>
      useVoiceLiveSpikeHost({ isDev: true, featureEnabled: true, debugEnabled: true })
    );
    await waitFor(() => {
      expect(remounted.result.current.snapshot?.state.turns.some((turn) => turn.text === SEGMENT)).toBe(
        true
      );
    });
    expect(remounted.result.current.snapshot?.state.status).toBe('listening');

    await act(async () => {
      await remounted.result.current.goOffline();
    });
    expect(mockSave).toHaveBeenCalled();
  });
});
