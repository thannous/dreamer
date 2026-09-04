/**
 * Isolated Prototype A host for the Dreamer Voice Live spike V3 (TI-428).
 *
 * Dev-only. Production cannot mount or start it. AI is a local deterministic
 * stub (no Gemini, backend, quota RPC, or purchase). TTS is allowed only after
 * the latest user segment is confirmed persisted on the spike storage lane.
 */

import {
  acknowledgeVoiceLiveOfflineQueue,
  appendVoiceLiveAiUtterance,
  bargeInVoiceLive,
  captureVoiceLiveSegment,
  commandForVoiceLive,
  completeVoiceLiveUtterance,
  createIdleVoiceLiveSpike,
  goOfflineVoiceLive,
  goOnlineVoiceLive,
  isAiOrTtsCommand,
  markVoiceLiveSegmentPersisted,
  pauseVoiceLiveSpike,
  persistedVoiceLiveRequestId,
  repriseVoiceLive,
  resumeVoiceLiveSpike,
  startVoiceLiveSpike,
  VOICE_LIVE_SPIKE_FEATURE_ENABLED_DEFAULT,
  VOICE_LIVE_SPIKE_FEATURE_FLAG,
  VOICE_LIVE_SPIKE_PROTOTYPE_A,
  type VoiceLiveAiIntent,
  type VoiceLiveCommand,
  type VoiceLiveNetwork,
  type VoiceLiveSessionMode,
  type VoiceLiveSpikeState,
} from './voiceLiveSpike';

export const VOICE_LIVE_SPIKE_HOST_TICKET = 'TI-428' as const;
export const VOICE_LIVE_SPIKE_HOST_PROTOTYPE = VOICE_LIVE_SPIKE_PROTOTYPE_A.id;
export const VOICE_LIVE_SPIKE_HOST_LABEL = 'prototype / no product promise';

export const VOICE_LIVE_SPIKE_SESSION_KEY_PREFIX = 'voice_live_spike_v3:';
export const VOICE_LIVE_SPIKE_DEBUG_STORAGE_KEY = 'dreamer.voiceLiveSpike.v3.debug';
export const VOICE_LIVE_SPIKE_FLAG_STORAGE_KEY = 'dreamer.voiceLiveSpike.v3.flag';

export const VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID = 'voice-live-spike-fixture';
export const VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL =
  'A quiet blue door stood at the end of a wet street.';
export const VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL_SEGMENT_ID = 'voice-live-spike-original';

export const VOICE_LIVE_SPIKE_TEST_IDS = {
  screen: 'screen.dev.voiceLiveSpike',
  host: 'dev.voiceLiveSpike.host',
  debugEntry: 'dev.voiceLiveSpike.debugEntry',
  enable: 'dev.voiceLiveSpike.enable',
  open: 'dev.voiceLiveSpike.open',
  capture: 'dev.voiceLiveSpike.capture',
  bargeIn: 'dev.voiceLiveSpike.bargeIn',
  pause: 'dev.voiceLiveSpike.pause',
  resume: 'dev.voiceLiveSpike.resume',
  offline: 'dev.voiceLiveSpike.offline',
  online: 'dev.voiceLiveSpike.online',
  unavailable: 'dev.voiceLiveSpike.unavailable',
} as const;

export type VoiceLiveSpikeHostGate = {
  isDev: boolean;
  featureEnabled: boolean;
  debugEnabled: boolean;
};

export type VoiceLiveSpikeTts = {
  speak: (text: string) => Promise<void>;
  stop: () => Promise<void>;
};

export type VoiceLiveSpikeSessionStore = {
  load: (dreamId: string) => Promise<VoiceLiveSpikeState | null>;
  save: (state: VoiceLiveSpikeState) => Promise<void>;
  remove: (dreamId: string) => Promise<void>;
};

export type VoiceLiveSpikeAiRequestView = {
  kind: 'request_ai';
  intent: VoiceLiveAiIntent;
  dreamId: string;
  originalTranscriptHash: string;
  originalPersistedSegmentId: string;
  originalTranscriptRef?: string;
  turnIndex: number;
  persistedSegmentId: string;
  lane: 'recall' | 'analysis' | 'chat';
};

export type VoiceLiveSpikeStubUtterance = {
  text: string;
  questionKind?: 'what_else' | 'where' | 'who_else' | 'what_seen' | 'what_next';
};

export type VoiceLiveSpikeHostSnapshot = {
  mounted: boolean;
  operational: boolean;
  label: typeof VOICE_LIVE_SPIKE_HOST_LABEL;
  prototype: typeof VOICE_LIVE_SPIKE_HOST_PROTOTYPE;
  state: VoiceLiveSpikeState;
  command: VoiceLiveCommand;
  lastAiRequest: VoiceLiveSpikeAiRequestView | null;
  lastSpokenText: string | null;
};

function isDevRuntime(isDev?: boolean): boolean {
  if (typeof isDev === 'boolean') return isDev;
  return typeof __DEV__ !== 'undefined' ? __DEV__ === true : false;
}

export function resolveVoiceLiveSpikeHostGate(
  input: Partial<VoiceLiveSpikeHostGate> = {}
): VoiceLiveSpikeHostGate {
  return {
    isDev: isDevRuntime(input.isDev),
    featureEnabled: input.featureEnabled === true,
    debugEnabled: input.debugEnabled === true,
  };
}

export function canMountVoiceLiveSpikeHost(
  input: Partial<VoiceLiveSpikeHostGate> = {}
): boolean {
  const gate = resolveVoiceLiveSpikeHostGate(input);
  return (
    gate.isDev &&
    gate.featureEnabled === true &&
    gate.debugEnabled === true &&
    VOICE_LIVE_SPIKE_FEATURE_ENABLED_DEFAULT === false &&
    VOICE_LIVE_SPIKE_FEATURE_FLAG === 'dreamer.voiceLiveSpike.v3' &&
    VOICE_LIVE_SPIKE_HOST_PROTOTYPE === 'A'
  );
}

export function canOperateVoiceLiveSpikeHost(
  input: Partial<VoiceLiveSpikeHostGate> = {}
): boolean {
  return canMountVoiceLiveSpikeHost(input);
}

export function getVoiceLiveSpikeSessionKey(dreamId: string): string {
  if (typeof dreamId !== 'string' || dreamId.trim().length === 0) {
    throw new Error('dreamId is required for the voice live spike storage lane.');
  }
  return `${VOICE_LIVE_SPIKE_SESSION_KEY_PREFIX}${dreamId.trim()}`;
}

export function toVoiceLiveSpikeAiRequestView(
  command: VoiceLiveCommand
): VoiceLiveSpikeAiRequestView {
  if (command.kind !== 'request_ai') {
    throw new Error('Voice live spike AI stub requires a persisted request_ai command.');
  }
  return {
    kind: 'request_ai',
    intent: command.intent,
    dreamId: command.dreamId,
    originalTranscriptHash: command.originalTranscriptHash,
    originalPersistedSegmentId: command.originalPersistedSegmentId,
    ...(command.originalTranscriptRef
      ? { originalTranscriptRef: command.originalTranscriptRef }
      : {}),
    turnIndex: command.turnIndex,
    persistedSegmentId: command.persistedSegmentId,
    lane: command.lane,
  };
}

export function stubVoiceLiveSpikeAi(
  command: VoiceLiveCommand
): VoiceLiveSpikeStubUtterance {
  const request = toVoiceLiveSpikeAiRequestView(command);
  if (request.lane === 'recall') {
    return { text: 'What else do you remember?', questionKind: 'what_else' };
  }
  if (request.lane === 'analysis') {
    return { text: 'What stands out from this persisted fragment?' };
  }
  return { text: 'What happened after that?' };
}

function assertNoOriginalTranscript(payload: unknown, originalTranscript: string): void {
  const encoded = JSON.stringify(payload);
  if (originalTranscript && encoded.includes(originalTranscript)) {
    throw new Error('Original transcript leaked into the voice live spike AI/TTS lane.');
  }
}

function assertPersistedBeforeAiOrTts(state: VoiceLiveSpikeState, command: VoiceLiveCommand): void {
  if (!isAiOrTtsCommand(command)) return;
  if (persistedVoiceLiveRequestId(state) == null) {
    throw new Error('Voice live spike refused AI/TTS before confirmed persist.');
  }
}

const silentTts: VoiceLiveSpikeTts = {
  speak: async () => undefined,
  stop: async () => undefined,
};

export function createVoiceLiveSpikeHost(input: {
  store: VoiceLiveSpikeSessionStore;
  tts?: VoiceLiveSpikeTts;
  gate: VoiceLiveSpikeHostGate;
  dreamId?: string;
  originalTranscript?: string;
  originalPersistedSegmentId?: string;
  mode?: VoiceLiveSessionMode;
  now?: () => number;
  remainingQuota?: number;
  canCaptureAudio?: boolean;
  speechAvailable?: boolean;
  network?: VoiceLiveNetwork;
}): {
  snapshot: () => VoiceLiveSpikeHostSnapshot;
  start: () => Promise<VoiceLiveSpikeHostSnapshot>;
  ingestCapturedSpeech: (text: string) => Promise<VoiceLiveSpikeHostSnapshot>;
  bargeIn: () => Promise<VoiceLiveSpikeHostSnapshot>;
  reprise: () => Promise<VoiceLiveSpikeHostSnapshot>;
  pause: () => Promise<VoiceLiveSpikeHostSnapshot>;
  resume: () => Promise<VoiceLiveSpikeHostSnapshot>;
  goOffline: () => Promise<VoiceLiveSpikeHostSnapshot>;
  goOnline: () => Promise<VoiceLiveSpikeHostSnapshot>;
  completeUtterance: () => Promise<VoiceLiveSpikeHostSnapshot>;
  reset: () => Promise<VoiceLiveSpikeHostSnapshot>;
} {
  const tts = input.tts ?? silentTts;
  const now = input.now ?? (() => Date.now());
  const dreamId = input.dreamId ?? VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID;
  const originalTranscript = input.originalTranscript ?? VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL;
  const originalPersistedSegmentId =
    input.originalPersistedSegmentId ?? VOICE_LIVE_SPIKE_FIXTURE_ORIGINAL_SEGMENT_ID;
  const mode = input.mode ?? 'chat';
  const mounted = canMountVoiceLiveSpikeHost(input.gate);
  const operational = canOperateVoiceLiveSpikeHost(input.gate);

  let state = createIdleVoiceLiveSpike(now()).state;
  let command: VoiceLiveCommand = { kind: 'idle' };
  let lastAiRequest: VoiceLiveSpikeAiRequestView | null = null;
  let lastSpokenText: string | null = null;

  const snapshot = (): VoiceLiveSpikeHostSnapshot => ({
    mounted,
    operational,
    label: VOICE_LIVE_SPIKE_HOST_LABEL,
    prototype: VOICE_LIVE_SPIKE_HOST_PROTOTYPE,
    state,
    command,
    lastAiRequest,
    lastSpokenText,
  });

  const publish = async (
    nextState: VoiceLiveSpikeState,
    nextCommand: VoiceLiveCommand
  ): Promise<VoiceLiveSpikeHostSnapshot> => {
    assertPersistedBeforeAiOrTts(nextState, nextCommand);
    await input.store.save(nextState);
    state = nextState;
    command = nextCommand;
    return snapshot();
  };

  const fulfillAiIfNeeded = async (
    nextState: VoiceLiveSpikeState,
    nextCommand: VoiceLiveCommand
  ): Promise<VoiceLiveSpikeHostSnapshot> => {
    await publish(nextState, nextCommand);
    if (nextCommand.kind !== 'request_ai') return snapshot();

    const requestView = toVoiceLiveSpikeAiRequestView(nextCommand);
    assertNoOriginalTranscript(requestView, originalTranscript);
    lastAiRequest = requestView;

    const stub = stubVoiceLiveSpikeAi(nextCommand);
    assertNoOriginalTranscript(stub, originalTranscript);
    const spoken = appendVoiceLiveAiUtterance(nextState, stub, now());
    assertPersistedBeforeAiOrTts(spoken.state, spoken.command);
    await input.store.save(spoken.state);
    state = spoken.state;
    command = spoken.command;

    if (spoken.command.kind === 'speak') {
      assertNoOriginalTranscript({ text: spoken.command.text }, originalTranscript);
      lastSpokenText = spoken.command.text;
      await tts.speak(spoken.command.text);
    }
    return snapshot();
  };

  const start = async (): Promise<VoiceLiveSpikeHostSnapshot> => {
    if (!operational) {
      const idle = createIdleVoiceLiveSpike(now());
      state = idle.state;
      command = { kind: 'ineligible', reason: 'feature_disabled' };
      lastAiRequest = null;
      lastSpokenText = null;
      return snapshot();
    }

    const existing = await input.store.load(dreamId);
    if (existing && existing.dreamId === dreamId && existing.status !== 'idle') {
      state = existing;
      command = commandForVoiceLive(existing, now());
      lastAiRequest = command.kind === 'request_ai' ? toVoiceLiveSpikeAiRequestView(command) : null;
      lastSpokenText = command.kind === 'speak' ? command.text : null;
      if (command.kind === 'await_persist') {
        const persisted = markVoiceLiveSegmentPersisted(existing, now());
        if (persisted.state.network === 'offline' || persisted.command.kind === 'queue_offline') {
          if (persisted.command.kind === 'queue_offline') {
            const queued = acknowledgeVoiceLiveOfflineQueue(persisted.state, now());
            return publish(queued.state, queued.command);
          }
          return publish(persisted.state, persisted.command);
        }
        return fulfillAiIfNeeded(persisted.state, persisted.command);
      }
      if (command.kind === 'request_ai') {
        return fulfillAiIfNeeded(existing, command);
      }
      return snapshot();
    }

    const started = startVoiceLiveSpike({
      dreamId,
      originalTranscript,
      originalPersistedSegmentId,
      now: now(),
      mode,
      eligibility: {
        canCaptureAudio: input.canCaptureAudio !== false,
        speechAvailable: input.speechAvailable !== false,
        remainingQuota: input.remainingQuota ?? 5,
        network: input.network ?? 'online',
        featureEnabled: true,
      },
    });
    return fulfillAiIfNeeded(started.state, started.command);
  };

  const ingestCapturedSpeech = async (text: string): Promise<VoiceLiveSpikeHostSnapshot> => {
    if (!operational) return snapshot();
    const captured = captureVoiceLiveSegment(state, text, now());
    await publish(captured.state, captured.command);
    if (captured.command.kind !== 'await_persist' && captured.state.network !== 'offline') {
      return snapshot();
    }
    const persisted = markVoiceLiveSegmentPersisted(captured.state, now());
    return fulfillAiIfNeeded(persisted.state, persisted.command);
  };

  const bargeIn = async (): Promise<VoiceLiveSpikeHostSnapshot> => {
    if (!operational) return snapshot();
    await tts.stop();
    const interrupted = bargeInVoiceLive(state, now());
    return publish(interrupted.state, interrupted.command);
  };

  const reprise = async (): Promise<VoiceLiveSpikeHostSnapshot> => {
    if (!operational) return snapshot();
    const resumed = repriseVoiceLive(state, now());
    return publish(resumed.state, resumed.command);
  };

  const pause = async (): Promise<VoiceLiveSpikeHostSnapshot> => {
    if (!operational) return snapshot();
    await tts.stop();
    const paused = pauseVoiceLiveSpike(state, now());
    return publish(paused.state, paused.command);
  };

  const resume = async (): Promise<VoiceLiveSpikeHostSnapshot> => {
    if (!operational) return snapshot();
    const resumed = resumeVoiceLiveSpike(state, now());
    return fulfillAiIfNeeded(resumed.state, resumed.command);
  };

  const goOffline = async (): Promise<VoiceLiveSpikeHostSnapshot> => {
    if (!operational) return snapshot();
    await tts.stop();
    const offline = goOfflineVoiceLive(state, now());
    return publish(offline.state, offline.command);
  };

  const goOnline = async (): Promise<VoiceLiveSpikeHostSnapshot> => {
    if (!operational) return snapshot();
    const online = goOnlineVoiceLive(state, now());
    return fulfillAiIfNeeded(online.state, online.command);
  };

  const completeUtterance = async (): Promise<VoiceLiveSpikeHostSnapshot> => {
    if (!operational) return snapshot();
    const completed = completeVoiceLiveUtterance(state, now());
    return publish(completed.state, completed.command);
  };

  const reset = async (): Promise<VoiceLiveSpikeHostSnapshot> => {
    await tts.stop();
    await input.store.remove(dreamId);
    const idle = createIdleVoiceLiveSpike(now());
    state = idle.state;
    command = idle.command;
    lastAiRequest = null;
    lastSpokenText = null;
    return snapshot();
  };

  return {
    snapshot,
    start,
    ingestCapturedSpeech,
    bargeIn,
    reprise,
    pause,
    resume,
    goOffline,
    goOnline,
    completeUtterance,
    reset,
  };
}

export function visibleVoiceLiveSpikeTurns<T extends { lane: string }>(
  state: { turns: readonly T[] }
): T[] {
  return state.turns.filter((turn) => turn.lane !== 'original');
}
