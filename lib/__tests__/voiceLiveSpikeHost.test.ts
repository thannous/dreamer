import { describe, expect, it, jest } from '@jest/globals';

import {
  captureVoiceLiveSegment,
  commandForVoiceLive,
  markVoiceLiveSegmentPersisted,
  startVoiceLiveSpike,
  VOICE_LIVE_SPIKE_FEATURE_ENABLED_DEFAULT,
  VOICE_LIVE_SPIKE_FEATURE_FLAG,
  type VoiceLiveSpikeState,
} from '../voiceLiveSpike';
import {
  canMountVoiceLiveSpikeHost,
  canOperateVoiceLiveSpikeHost,
  createVoiceLiveSpikeHost,
  getVoiceLiveSpikeSessionKey,
  stubVoiceLiveSpikeAi,
  VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID,
  VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL,
  VOICE_LIVE_SPIKE_HOST_LABEL,
  VOICE_LIVE_SPIKE_SESSION_KEY_PREFIX,
  type VoiceLiveSpikeHostGate,
  type VoiceLiveSpikeSessionStore,
  visibleVoiceLiveSpikeTurns,
} from '../voiceLiveSpikeHost';

const NOW = 1_700_000_000_000;
const SEGMENT = 'Rain on the quiet glass.';

const enabledGate = (): VoiceLiveSpikeHostGate => ({
  isDev: true,
  featureEnabled: true,
  debugEnabled: true,
});

function memoryStore(initial: VoiceLiveSpikeState | null = null): VoiceLiveSpikeSessionStore & {
  states: VoiceLiveSpikeState[];
  removed: string[];
} {
  let current = initial;
  const states: VoiceLiveSpikeState[] = initial ? [initial] : [];
  const removed: string[] = [];
  return {
    states,
    removed,
    load: async (dreamId: string) => (current?.dreamId === dreamId ? current : null),
    save: async (state: VoiceLiveSpikeState) => {
      current = JSON.parse(JSON.stringify(state)) as VoiceLiveSpikeState;
      states.push(current);
    },
    remove: async (dreamId: string) => {
      removed.push(dreamId);
      if (current?.dreamId === dreamId) current = null;
    },
  };
}

describe('voice live spike host gates', () => {
  it('does not mount or operate when the flag is false or runtime is not __DEV__', () => {
    expect(VOICE_LIVE_SPIKE_FEATURE_ENABLED_DEFAULT).toBe(false);
    expect(VOICE_LIVE_SPIKE_FEATURE_FLAG).toBe('dreamer.voiceLiveSpike.v3');
    expect(canMountVoiceLiveSpikeHost({ isDev: false, featureEnabled: true, debugEnabled: true })).toBe(false);
    expect(canOperateVoiceLiveSpikeHost({ isDev: true, featureEnabled: false, debugEnabled: true })).toBe(false);
    expect(canOperateVoiceLiveSpikeHost({ isDev: true, featureEnabled: true, debugEnabled: false })).toBe(false);
    expect(canMountVoiceLiveSpikeHost(enabledGate())).toBe(true);
  });

  it('keeps a storage lane distinct from recall assistant sidecars', () => {
    expect(getVoiceLiveSpikeSessionKey(VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID)).toBe(
      `${VOICE_LIVE_SPIKE_SESSION_KEY_PREFIX}${VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID}`
    );
    expect(getVoiceLiveSpikeSessionKey(VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID)).not.toContain(
      'dream_recall_assistant:'
    );
  });
});

describe('persist-before-AI host loop', () => {
  it('does not request or speak before the captured segment is persisted', async () => {
    const store = memoryStore();
    const events: string[] = [];
    const tts = {
      speak: jest.fn(async () => {
        events.push('speak');
      }),
      stop: jest.fn(async () => {
        events.push('stop');
      }),
    };
    const host = createVoiceLiveSpikeHost({
      store: {
        ...store,
        save: async (state) => {
          events.push(
            `save:${state.status}:${String(state.pendingUserSegment?.persisted ?? 'none')}`
          );
          await store.save(state);
        },
      },
      tts,
      gate: enabledGate(),
      mode: 'chat',
      now: (() => {
        let tick = NOW;
        return () => {
          tick += 1;
          return tick;
        };
      })(),
    });

    const started = await host.start();
    expect(started.mounted).toBe(true);
    expect(started.operational).toBe(true);
    expect(started.label).toBe(VOICE_LIVE_SPIKE_HOST_LABEL);
    expect(started.command.kind).toBe('listen');
    expect(tts.speak).not.toHaveBeenCalled();
    expect(started.lastAiRequest).toBeNull();

    const spoken = await host.ingestCapturedSpeech(SEGMENT);
    expect(spoken.state.pendingUserSegment == null || spoken.state.pendingUserSegment.persisted).toBe(
      true
    );
    expect(spoken.command.kind).toBe('speak');
    expect(spoken.lastAiRequest).not.toBeNull();
    expect(JSON.stringify(spoken.lastAiRequest)).not.toContain(VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL);
    expect(JSON.stringify(spoken.state.turns)).not.toContain(VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL);
    expect(tts.speak).toHaveBeenCalledTimes(1);

    const firstSpeak = events.indexOf('speak');
    const firstPersistedSave = events.findIndex((event) => event.includes('save:thinking:true'));
    expect(events).toContain('save:await_persist:false');
    expect(firstPersistedSave).toBeGreaterThanOrEqual(0);
    expect(firstSpeak).toBeGreaterThan(firstPersistedSave);
  });

  it('stays idle and does not persist or speak when the host is not operational', async () => {
    const store = memoryStore();
    const tts = { speak: jest.fn(async () => undefined), stop: jest.fn(async () => undefined) };
    const host = createVoiceLiveSpikeHost({
      store,
      tts,
      gate: { isDev: false, featureEnabled: true, debugEnabled: true },
      mode: 'chat',
    });
    const started = await host.start();
    expect(started.mounted).toBe(false);
    expect(started.operational).toBe(false);
    expect(started.state.status).toBe('idle');
    expect(started.command).toEqual({ kind: 'ineligible', reason: 'feature_disabled' });
    expect(store.states).toHaveLength(0);
    expect(tts.speak).not.toHaveBeenCalled();
    await host.ingestCapturedSpeech(SEGMENT);
    expect(store.states).toHaveLength(0);
    expect(tts.speak).not.toHaveBeenCalled();
  });

  it('hydrates a valid stored session on remount instead of starting over', async () => {
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
    expect(persisted.state.status).toBe('thinking');
    const listening = {
      ...persisted.state,
      status: 'listening' as const,
      currentUtterance: null,
      pendingUserSegment: null,
    };
    expect(commandForVoiceLive(listening).kind).toBe('listen');

    const store = memoryStore(listening);
    const tts = { speak: jest.fn(async () => undefined), stop: jest.fn(async () => undefined) };
    const remounted = createVoiceLiveSpikeHost({
      store,
      tts,
      gate: enabledGate(),
      mode: 'chat',
      now: () => NOW + 50,
    });
    const restored = await remounted.start();
    expect(restored.state.status).toBe('listening');
    expect(restored.state.turns.some((turn) => turn.text === SEGMENT)).toBe(true);
    expect(tts.speak).not.toHaveBeenCalled();
    expect(store.removed).toEqual([]);

    await remounted.reset();
    expect(store.removed).toEqual([VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID]);
    expect(remounted.snapshot().state.status).toBe('idle');
  });

  it('never copies the original transcript into the stub AI request', () => {
    const started = startVoiceLiveSpike({
      dreamId: VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID,
      originalTranscript: VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL,
      originalPersistedSegmentId: 'voice-live-spike-original',
      now: NOW,
      mode: 'recall',
      eligibility: {
        canCaptureAudio: true,
        speechAvailable: true,
        remainingQuota: 5,
        network: 'online',
        featureEnabled: true,
      },
    });
    expect(started.command.kind).toBe('request_ai');
    const stub = stubVoiceLiveSpikeAi(started.command);
    expect(JSON.stringify(started.command)).not.toContain(VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL);
    expect(JSON.stringify(stub)).not.toContain(VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL);
  });

  it('never renders a synthetic original-lane turn', () => {
    const visible = visibleVoiceLiveSpikeTurns({
      turns: [
        { lane: 'original', text: VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL },
        { lane: 'chat', text: SEGMENT },
      ],
    });
    expect(visible).toEqual([{ lane: 'chat', text: SEGMENT }]);
    expect(visible.some((turn) => turn.lane === 'original')).toBe(false);
  });

  it('recovers an online await_persist snapshot without AI/TTS before persist', async () => {
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
    const captured = captureVoiceLiveSegment(started.state, SEGMENT, NOW + 1, 'seg-crash');
    expect(captured.command.kind).toBe('await_persist');
    expect(captured.state.pendingUserSegment?.persisted).toBe(false);

    const store = memoryStore(captured.state);
    const events: string[] = [];
    const tts = {
      speak: jest.fn(async () => {
        events.push('speak');
      }),
      stop: jest.fn(async () => undefined),
    };
    const host = createVoiceLiveSpikeHost({
      store: {
        ...store,
        load: async (dreamId) => {
          events.push('load');
          return store.load(dreamId);
        },
        save: async (state) => {
          events.push(`save:${state.status}:${String(state.pendingUserSegment?.persisted ?? 'none')}`);
          await store.save(state);
        },
      },
      tts,
      gate: enabledGate(),
      mode: 'chat',
      now: () => NOW + 80,
    });

    const recovered = await host.start();
    expect(events[0]).toBe('load');
    expect(events).toContain('save:thinking:true');
    expect(events.indexOf('speak')).toBeGreaterThan(events.indexOf('save:thinking:true'));
    expect(recovered.command.kind).toBe('speak');
    expect(recovered.state.turns.some((turn) => turn.text === SEGMENT)).toBe(true);
    expect(tts.speak).toHaveBeenCalledTimes(1);
  });

  it('recovers an offline await_persist snapshot by persisting and queueing without AI/TTS', async () => {
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
        network: 'offline',
        featureEnabled: true,
      },
    });
    const captured = captureVoiceLiveSegment(started.state, SEGMENT, NOW + 1, 'seg-offline');
    expect(captured.command.kind).toBe('await_persist');
    expect(captured.state.network).toBe('offline');

    const store = memoryStore(captured.state);
    const events: string[] = [];
    const tts = {
      speak: jest.fn(async () => {
        events.push('speak');
      }),
      stop: jest.fn(async () => undefined),
    };
    const host = createVoiceLiveSpikeHost({
      store: {
        ...store,
        load: async (dreamId) => {
          events.push('load');
          return store.load(dreamId);
        },
        save: async (state) => {
          events.push(`save:${state.status}:${String(state.pendingUserSegment?.persisted ?? 'none')}:${String(state.pendingUserSegment?.queuedOffline ?? false)}`);
          await store.save(state);
        },
      },
      tts,
      gate: enabledGate(),
      mode: 'chat',
      now: () => NOW + 90,
    });

    const recovered = await host.start();
    expect(events[0]).toBe('load');
    expect(events.some((event) => event.startsWith('save:') && event.includes(':true:'))).toBe(true);
    expect(events).not.toContain('speak');
    expect(tts.speak).not.toHaveBeenCalled();
    expect(recovered.lastAiRequest).toBeNull();
    expect(recovered.state.pendingUserSegment?.persisted).toBe(true);
    expect(recovered.state.pendingUserSegment?.queuedOffline).toBe(true);
    expect(recovered.command.kind).not.toBe('request_ai');
    expect(recovered.command.kind).not.toBe('speak');
  });
});
