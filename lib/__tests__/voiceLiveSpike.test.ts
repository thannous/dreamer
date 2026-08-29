import { describe, expect, it } from '@jest/globals';

import { DREAM_RECALL_QUESTION_INTENT } from '../dreamRecallAssistant';
import {
  acknowledgeVoiceLiveOfflineQueue,
  appendVoiceLiveAiUtterance,
  bargeInVoiceLive,
  captureVoiceLiveSegment,
  commandForVoiceLive,
  completeVoiceLiveUtterance,
  createIdleVoiceLiveSpike,
  evaluateVoiceLiveGoNoGo,
  flagVoiceLiveSpike,
  goOfflineVoiceLive,
  goOnlineVoiceLive,
  hydrateVoiceLiveSpikeState,
  isAiOrTtsCommand,
  isVoiceLiveSpikeState,
  markVoiceLiveSegmentPersisted,
  pauseVoiceLiveSpike,
  requestVoiceLiveAi,
  repriseVoiceLive,
  resumeVoiceLiveSpike,
  serializeVoiceLiveSpikeState,
  startVoiceLiveSpike,
  validateVoiceLiveSpikeState,
  VOICE_LIVE_ANALYSIS_INTENT,
  VOICE_LIVE_CHAT_INTENT,
  VOICE_LIVE_DEVICE_PROOF_TICKET,
  VOICE_LIVE_GO_NO_GO_THRESHOLDS,
  VOICE_LIVE_SPIKE_FEATURE_ENABLED_DEFAULT,
  VOICE_LIVE_SPIKE_FEATURE_FLAG,
  VOICE_LIVE_SPIKE_PROTOTYPE_A,
  VOICE_LIVE_SPIKE_SCHEMA_VERSION,
  VOICE_LIVE_SPIKE_STATUSES,
  VOICE_LIVE_SPIKE_TICKET,
  VoiceLiveSpikeError,
  type StartVoiceLiveSpikeInput,
  type VoiceLiveGoNoGoInput,
  type VoiceLiveSpikeState,
} from '../voiceLiveSpike';

const NOW = 1_700_000_000_000;
const ORIGINAL = 'I flew over a quiet city with a blue door.';
const ORIGINAL_SEGMENT_ID = 'persisted-original-42';
const SEGMENT = 'A train passed under the door.';

const eligibility = (
  overrides: Partial<StartVoiceLiveSpikeInput['eligibility']> = {}
): StartVoiceLiveSpikeInput['eligibility'] => ({
  canCaptureAudio: true,
  speechAvailable: true,
  remainingQuota: 3,
  network: 'online',
  ...overrides,
});

const start = (overrides: Partial<StartVoiceLiveSpikeInput> = {}) =>
  startVoiceLiveSpike({
    dreamId: 'dream-42',
    originalTranscript: ORIGINAL,
    originalPersistedSegmentId: ORIGINAL_SEGMENT_ID,
    originalTranscriptRef: 'dreams/42',
    now: NOW,
    mode: 'recall',
    eligibility: eligibility({ featureEnabled: true }),
    maxAiTurns: 2,
    ...overrides,
  });

const expectCode = (code: VoiceLiveSpikeError['code'], run: () => unknown) => {
  try {
    run();
    throw new Error(`Expected VoiceLiveSpikeError(${code})`);
  } catch (error) {
    expect(error).toBeInstanceOf(VoiceLiveSpikeError);
    expect((error as VoiceLiveSpikeError).code).toBe(code);
  }
};

const persistSegment = (state: VoiceLiveSpikeState, text = SEGMENT, now = NOW + 10) => {
  const captured = captureVoiceLiveSegment(state, text, now, `seg-${now}`);
  return markVoiceLiveSegmentPersisted(captured.state, now + 1);
};

const goNoGo = (overrides: Partial<VoiceLiveGoNoGoInput> = {}): VoiceLiveGoNoGoInput => ({
  p95EndOfSpeechToPersistMs: 400,
  p95PersistToFirstTokenMs: 900,
  p95TtsAudibleMs: 300,
  p95BargeInStopMs: 120,
  estimatedCostPerFiveTurnSessionUsd: 0.02,
  persistBeforeAiViolations: 0,
  bargeInHonored: true,
  offlineQueuedWithoutResponse: true,
  originalTranscriptLeakedToAiTurns: false,
  audioRetentionDefaultOff: true,
  quotaHonored: true,
  deviceProofTicket: VOICE_LIVE_DEVICE_PROOF_TICKET,
  deviceProofComplete: true,
  ...overrides,
});

describe('idle and start', () => {
  it('starts idle with audio retention off and no AI/TTS command', () => {
    const idle = createIdleVoiceLiveSpike(NOW);
    expect(idle.state.status).toBe('idle');
    expect(idle.state.audioRetention).toBe('off');
    expect(idle.command).toEqual({ kind: 'idle' });
    expect(isAiOrTtsCommand(idle.command)).toBe(false);
    expect(VOICE_LIVE_SPIKE_STATUSES).toEqual([
      'idle',
      'listening',
      'await_persist',
      'thinking',
      'speaking',
      'interrupted',
      'paused',
      'offline',
    ]);
  });

  it('requests the first recall turn from the already persisted original', () => {
    const { state, command } = start();

    expect(state.status).toBe('thinking');
    expect(state.prototype).toBe(VOICE_LIVE_SPIKE_PROTOTYPE_A.id);
    expect(state.schemaVersion).toBe(VOICE_LIVE_SPIKE_SCHEMA_VERSION);
    expect(state.audioRetention).toBe('off');
    expect(state.bargeInEnabled).toBe(true);
    expect(state.turns).toEqual([]);
    expect(command).toEqual({
      kind: 'request_ai',
      intent: DREAM_RECALL_QUESTION_INTENT,
      dreamId: 'dream-42',
      originalTranscriptHash: state.originalTranscriptHash,
      originalPersistedSegmentId: ORIGINAL_SEGMENT_ID,
      originalTranscriptRef: 'dreams/42',
      turnIndex: 0,
      persistedSegmentId: ORIGINAL_SEGMENT_ID,
      lane: 'recall',
    });
    expect(JSON.stringify(command)).not.toContain(ORIGINAL);
    expect(JSON.stringify(state.turns)).not.toContain(ORIGINAL);
  });

  it('keeps chat listening until a user segment is persisted', () => {
    const started = start({ mode: 'chat' });
    expect(started.state.status).toBe('listening');
    expect(started.command).toEqual({ kind: 'listen' });
    expectCode('segment_not_persisted', () => requestVoiceLiveAi(started.state, NOW + 1));
  });

  it('rejects capture eligibility failures without leaving idle', () => {
    const noMic = start({ eligibility: eligibility({ featureEnabled: true, canCaptureAudio: false }) });
    expect(noMic.state.status).toBe('idle');
    expect(noMic.command).toEqual({ kind: 'ineligible', reason: 'no_microphone' });

    const noSpeech = start({ eligibility: eligibility({ featureEnabled: true, speechAvailable: false }) });
    expect(noSpeech.command).toEqual({ kind: 'ineligible', reason: 'speech_unavailable' });
  });

  it('stays idle when the local prototype flag is off by default', () => {
    expect(VOICE_LIVE_SPIKE_FEATURE_ENABLED_DEFAULT).toBe(false);
    expect(VOICE_LIVE_SPIKE_FEATURE_FLAG).toBe('dreamer.voiceLiveSpike.v3');
    const blocked = startVoiceLiveSpike({
      dreamId: 'dream-42',
      originalTranscript: ORIGINAL,
      originalPersistedSegmentId: ORIGINAL_SEGMENT_ID,
      now: NOW,
      mode: 'recall',
      eligibility: eligibility(),
    });
    expect(blocked.state.status).toBe('idle');
    expect(blocked.state.featureEnabled).toBe(false);
    expect(blocked.command).toEqual({ kind: 'ineligible', reason: 'feature_disabled' });
    expect(isAiOrTtsCommand(blocked.command)).toBe(false);
  });

  it('starts only when the local prototype flag is enabled explicitly', () => {
    const enabled = start({ eligibility: eligibility({ featureEnabled: true }) });
    expect(enabled.state.featureEnabled).toBe(true);
    expect(enabled.state.status).toBe('thinking');
    expect(enabled.command.kind).toBe('request_ai');
  });
});

describe('persist-before-AI', () => {
  it('never requests AI or TTS from an unpersisted segment', () => {
    const started = start({ mode: 'chat' });
    const captured = captureVoiceLiveSegment(started.state, SEGMENT, NOW + 2, 'seg-unpersisted');

    expect(captured.state.status).toBe('await_persist');
    expect(captured.command).toEqual({
      kind: 'await_persist',
      segmentId: 'seg-unpersisted',
      lane: 'chat',
    });
    expect(isAiOrTtsCommand(captured.command)).toBe(false);
    expectCode('segment_not_persisted', () => requestVoiceLiveAi(captured.state, NOW + 3));
    expectCode('segment_not_persisted', () =>
      appendVoiceLiveAiUtterance(captured.state, { text: 'What happened next?' }, NOW + 4)
    );

    const persisted = markVoiceLiveSegmentPersisted(captured.state, NOW + 5);
    expect(persisted.state.status).toBe('thinking');
    expect(persisted.state.pendingUserSegment?.persisted).toBe(true);
    expect(persisted.command.kind).toBe('request_ai');
    if (persisted.command.kind === 'request_ai') {
      expect(persisted.command.persistedSegmentId).toBe('seg-unpersisted');
      expect(persisted.command.intent).toBe(VOICE_LIVE_CHAT_INTENT);
      expect(persisted.command.lane).toBe('chat');
      expect(JSON.stringify(persisted.command)).not.toContain(ORIGINAL);
    }
    expect(persisted.state.turns.some((turn) => turn.text === ORIGINAL)).toBe(false);
  });

  it('keeps original, recall, analysis and chat lanes isolated', () => {
    const recall = start();
    expect(recall.command.kind).toBe('request_ai');
    if (recall.command.kind === 'request_ai') {
      expect(recall.command.intent).toBe(DREAM_RECALL_QUESTION_INTENT);
      expect(recall.command.lane).toBe('recall');
    }

    const analysis = start({ mode: 'analysis' });
    expect(analysis.command.kind).toBe('request_ai');
    if (analysis.command.kind === 'request_ai') {
      expect(analysis.command.intent).toBe(VOICE_LIVE_ANALYSIS_INTENT);
      expect(analysis.command.lane).toBe('analysis');
      expect(analysis.command.persistedSegmentId).toBe(ORIGINAL_SEGMENT_ID);
    }

    const spoken = appendVoiceLiveAiUtterance(
      recall.state,
      { text: 'What happened next?', questionKind: 'what_next' },
      NOW + 6
    );
    expect(spoken.state.status).toBe('speaking');
    expect(spoken.command).toMatchObject({ kind: 'speak', tts: 'expo-speech' });
    expect(spoken.state.turns.every((turn) => turn.lane === 'recall')).toBe(true);
    expectCode('invalid_utterance', () =>
      appendVoiceLiveAiUtterance(recall.state, { text: ORIGINAL, questionKind: 'what_next' }, NOW + 7)
    );
  });
});

describe('barge-in and reprise', () => {
  it('stops speech, preserves the last persisted segment, then resumes listening', () => {
    const started = start({ mode: 'chat' });
    const persisted = persistSegment(started.state);
    const spoken = appendVoiceLiveAiUtterance(persisted.state, { text: 'Who else was there?' }, NOW + 20);
    const interrupted = bargeInVoiceLive(spoken.state, NOW + 21);

    expect(interrupted.state.status).toBe('interrupted');
    expect(interrupted.command).toEqual({ kind: 'stop_speech' });
    expect(interrupted.state.currentUtterance).toBeNull();
    expect(interrupted.state.speechCancelled).toBe(true);
    expect(interrupted.state.turns.find((turn) => turn.role === 'user')?.text).toBe(SEGMENT);
    expectCode('interrupted', () => requestVoiceLiveAi(interrupted.state, NOW + 22));

    const resumed = repriseVoiceLive(interrupted.state, NOW + 23);
    expect(resumed.state.status).toBe('listening');
    expect(resumed.command).toEqual({ kind: 'listen' });
    expect(resumed.state.turns.find((turn) => turn.role === 'user')?.segmentId).toBe(
      persisted.state.pendingUserSegment?.id
    );

    const nextCapture = captureVoiceLiveSegment(resumed.state, 'Rain on the glass.', NOW + 24, 'seg-later');
    expect(nextCapture.state.status).toBe('await_persist');
    expect(isAiOrTtsCommand(nextCapture.command)).toBe(false);
  });
});

describe('offline queue without response', () => {
  it('persists and queues offline without AI or TTS', () => {
    const started = start({
      mode: 'chat',
      eligibility: eligibility({ featureEnabled: true, network: 'offline' }),
    });
    expect(started.state.status).toBe('offline');
    expect(started.command).toEqual({ kind: 'offline' });
    expectCode('offline', () => requestVoiceLiveAi(started.state, NOW + 30));

    const captured = captureVoiceLiveSegment(started.state, SEGMENT, NOW + 31, 'seg-offline');
    expect(captured.state.status).toBe('offline');
    expect(captured.command).toEqual({
      kind: 'await_persist',
      segmentId: 'seg-offline',
      lane: 'chat',
    });

    const persisted = markVoiceLiveSegmentPersisted(captured.state, NOW + 32);
    expect(persisted.state.status).toBe('offline');
    expect(persisted.command).toEqual({ kind: 'queue_offline', segmentId: 'seg-offline' });
    expect(isAiOrTtsCommand(persisted.command)).toBe(false);

    const queued = acknowledgeVoiceLiveOfflineQueue(persisted.state, NOW + 33);
    expect(queued.command).toEqual({ kind: 'offline' });
    expect(queued.state.pendingUserSegment).toMatchObject({
      id: 'seg-offline',
      persisted: true,
      queuedOffline: true,
    });

    const online = goOnlineVoiceLive(queued.state, NOW + 34);
    expect(online.state.status).toBe('thinking');
    expect(online.command.kind).toBe('request_ai');
  });

  it('drops in-flight thinking when the network disappears', () => {
    const started = start({ mode: 'chat' });
    const persisted = persistSegment(started.state, SEGMENT, NOW + 40);
    expect(persisted.command.kind).toBe('request_ai');
    const offline = goOfflineVoiceLive(persisted.state, NOW + 41);
    expect(offline.state.status).toBe('offline');
    expect(isAiOrTtsCommand(offline.command)).toBe(false);
    expect(offline.command.kind).toBe('queue_offline');
  });
});

describe('pause, resume, flag, budgets', () => {
  it('resumes an unpersisted capture back to await_persist', () => {
    const started = start({ mode: 'chat' });
    const captured = captureVoiceLiveSegment(started.state, SEGMENT, NOW + 50, 'seg-pause');
    const paused = pauseVoiceLiveSpike(captured.state, NOW + 51);
    expect(paused.command).toEqual({ kind: 'paused' });
    expectCode('paused', () => requestVoiceLiveAi(paused.state, NOW + 52));

    const resumed = resumeVoiceLiveSpike(paused.state, NOW + 53);
    expect(resumed.state.status).toBe('await_persist');
    expect(resumed.command).toEqual({
      kind: 'await_persist',
      segmentId: 'seg-pause',
      lane: 'chat',
    });
    expect(isAiOrTtsCommand(resumed.command)).toBe(false);
  });

  it('flags the last assistant turn and blocks exhausted quota', () => {
    const started = start({
      mode: 'analysis',
      eligibility: eligibility({ featureEnabled: true, remainingQuota: 1 }),
      maxAiTurns: 1,
    });
    const spoken = appendVoiceLiveAiUtterance(started.state, { text: 'What did you see?' }, NOW + 60);
    const flagged = flagVoiceLiveSpike(spoken.state, NOW + 61);
    expect(flagged.command).toEqual({ kind: 'flag' });
    expect(flagged.state.flagged).toBe(true);
    expect(flagged.state.turns).toEqual([
      expect.objectContaining({ role: 'assistant', flagged: true, lane: 'analysis' }),
    ]);

    const completed = completeVoiceLiveUtterance(spoken.state, NOW + 62);
    const later = persistSegment(completed.state, 'A quiet attendant.', NOW + 63);
    expect(later.command).toEqual({ kind: 'ineligible', reason: 'quota_exhausted' });
    expect(isAiOrTtsCommand(later.command)).toBe(false);
  });
});

describe('go / no-go', () => {
  it('goes on Prototype A only after TI-429 proofs and invariant gates', () => {
    expect(evaluateVoiceLiveGoNoGo(goNoGo())).toEqual({
      decision: 'go_a',
      prototype: 'A',
      optionBEligible: false,
      reasons: [],
    });

    expect(evaluateVoiceLiveGoNoGo(goNoGo({ deviceProofComplete: false })).decision).toBe(
      'blocked_ti_429'
    );
    expect(
      evaluateVoiceLiveGoNoGo(goNoGo({ persistBeforeAiViolations: 1 })).decision
    ).toBe('no_go_a');
    expect(
      evaluateVoiceLiveGoNoGo(
        goNoGo({ p95TtsAudibleMs: VOICE_LIVE_GO_NO_GO_THRESHOLDS.p95TtsAudibleMs + 1 })
      )
    ).toMatchObject({
      decision: 'consider_b_after_no_go',
      prototype: 'B',
      optionBEligible: true,
    });
    expect(VOICE_LIVE_SPIKE_TICKET).toBe('TI-428');
    expect(VOICE_LIVE_DEVICE_PROOF_TICKET).toBe('TI-429');
  });
});

describe('hydrate and immutability', () => {
  it('round-trips a valid snapshot and rejects leaked original turns', () => {
    const started = start();
    const json = serializeVoiceLiveSpikeState(started.state);
    expect(hydrateVoiceLiveSpikeState(json)).toEqual({ ok: true, state: started.state });
    expect(() => validateVoiceLiveSpikeState(started.state)).not.toThrow();
    expect(JSON.parse(json).audioRetention).toBe('off');

    expect(hydrateVoiceLiveSpikeState('{')).toEqual({ ok: false, reason: 'invalid_json' });
    expect(hydrateVoiceLiveSpikeState({ schemaVersion: 0, status: 'listening' })).toEqual({
      ok: false,
      reason: 'unsupported_schema',
    });
    expect(
      isVoiceLiveSpikeState({
        ...JSON.parse(json),
        turns: [
          {
            id: 'leaked',
            role: 'assistant',
            lane: 'recall',
            text: ORIGINAL,
            createdAt: NOW,
            flagged: false,
          },
        ],
      })
    ).toBe(false);
  });

  it('does not mutate the previous state object', () => {
    const started = start({ mode: 'chat' });
    const before = structuredClone(started.state);
    captureVoiceLiveSegment(started.state, SEGMENT, NOW + 80);
    expect(started.state).toEqual(before);
    expect(commandForVoiceLive(started.state).kind).toBe('listen');
  });

  it('rejects a forged speaking chat snapshot without a persisted segment', () => {
    const started = start({ mode: 'chat' });
    const forged = {
      ...started.state,
      status: 'speaking' as const,
      currentUtterance: {
        id: 'utt-forged',
        text: 'Who else was there?',
        createdAt: NOW + 1,
      },
      pendingUserSegment: null,
      turns: [
        {
          id: 'utt-forged',
          role: 'assistant' as const,
          lane: 'chat' as const,
          text: 'Who else was there?',
          createdAt: NOW + 1,
          flagged: false,
        },
      ],
    };

    expect(isVoiceLiveSpikeState(forged)).toBe(false);
    expect(hydrateVoiceLiveSpikeState(forged)).toEqual({ ok: false, reason: 'invalid_state' });
    expect(commandForVoiceLive(forged as VoiceLiveSpikeState)).toEqual({
      kind: 'ineligible',
      reason: 'segment_not_persisted',
    });
    expect(isAiOrTtsCommand(commandForVoiceLive(forged as VoiceLiveSpikeState))).toBe(false);
  });
});

true satisfies VoiceLiveSpikeState['status'] extends
  | 'idle'
  | 'listening'
  | 'await_persist'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'paused'
  | 'offline'
  ? true
  : false;
