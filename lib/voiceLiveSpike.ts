/**
 * Pure persistable kernel for the Dreamer Voice Live spike V3 (TI-428).
 *
 * Prototype A is native STT -> confirmed persist -> text AI -> expo-speech.
 * Option B (live audio) is only considered after an A no-go. Reuses TI-427
 * persist-before-AI, original-transcript isolation, and closed recall intents.
 * Local prototype behind `dreamer.voiceLiveSpike.v3`, off by default.
 * No UI, network I/O, TTS I/O, or storage I/O.
 */

import {
  DREAM_RECALL_QUESTION_INTENT,
  MAX_DREAM_RECALL_QUESTION_LENGTH,
  MAX_DREAM_RECALL_SEGMENT_LENGTH,
  MAX_DREAM_RECALL_TRANSCRIPT_LENGTH,
  isNeutralRecallQuestion,
  type DreamRecallQuestionIntent,
  type DreamRecallQuestionKind,
} from './dreamRecallAssistant';

export const VOICE_LIVE_SPIKE_SCHEMA_VERSION = 1 as const;
export const VOICE_LIVE_SPIKE_TICKET = 'TI-428' as const;
export const VOICE_LIVE_DEVICE_PROOF_TICKET = 'TI-429' as const;
export const VOICE_LIVE_SPIKE_FEATURE_FLAG = 'dreamer.voiceLiveSpike.v3' as const;
export const VOICE_LIVE_SPIKE_FEATURE_ENABLED_DEFAULT = false;

export const VOICE_LIVE_ANALYSIS_INTENT = 'analysis_turn' as const;
export const VOICE_LIVE_CHAT_INTENT = 'chat_turn' as const;

export const DEFAULT_VOICE_LIVE_MAX_AI_TURNS = 5;
export const MAX_VOICE_LIVE_MAX_AI_TURNS = 8;
export const DEFAULT_VOICE_LIVE_MAX_SESSION_MS = 10 * 60 * 1000;
export const MAX_VOICE_LIVE_UTTERANCE_LENGTH = MAX_DREAM_RECALL_QUESTION_LENGTH;

export const VOICE_LIVE_SPIKE_PROTOTYPE_A = {
  id: 'A',
  stt: 'native',
  persist: 'confirmed_segment',
  ai: 'text',
  tts: 'expo-speech',
} as const;

export const VOICE_LIVE_SPIKE_OPTION_B = {
  id: 'B',
  stt: 'realtime_audio',
  persist: 'confirmed_segment',
  ai: 'live_audio',
  tts: 'live_audio',
} as const;

export const VOICE_LIVE_SPIKE_STATUSES = [
  'idle',
  'listening',
  'await_persist',
  'thinking',
  'speaking',
  'interrupted',
  'paused',
  'offline',
] as const;

export const VOICE_LIVE_GO_NO_GO_THRESHOLDS = {
  p95EndOfSpeechToPersistMs: 1_200,
  p95PersistToFirstTokenMs: 2_500,
  p95TtsAudibleMs: 700,
  p95BargeInStopMs: 250,
  maxCostPerFiveTurnSessionUsd: 0.05,
} as const;

export type VoiceLiveSpikeStatus = (typeof VOICE_LIVE_SPIKE_STATUSES)[number];
export type VoiceLiveSessionMode = 'recall' | 'analysis' | 'chat';
export type VoiceLiveNetwork = 'online' | 'offline';
export type VoiceLiveLane = 'original' | 'recall' | 'analysis' | 'chat';
export type VoiceLiveUserLane = Exclude<VoiceLiveLane, 'original'>;
export type VoiceLiveAudioRetention = 'off' | 'opt_in';

export type VoiceLiveAiIntent =
  | DreamRecallQuestionIntent
  | typeof VOICE_LIVE_ANALYSIS_INTENT
  | typeof VOICE_LIVE_CHAT_INTENT;

export type VoiceLiveErrorCode =
  | 'idle'
  | 'not_active'
  | 'paused'
  | 'offline'
  | 'interrupted'
  | 'no_pending_segment'
  | 'segment_not_persisted'
  | 'ineligible'
  | 'budget'
  | 'invalid_utterance'
  | 'invalid_input';

export type VoiceLiveIneligibleReason =
  | 'no_microphone'
  | 'speech_unavailable'
  | 'quota_exhausted'
  | 'session_budget'
  | 'ai_turn_budget'
  | 'offline_ai'
  | 'segment_not_persisted'
  | 'speech_cancelled'
  | 'feature_disabled';

export class VoiceLiveSpikeError extends Error {
  readonly code: VoiceLiveErrorCode;
  constructor(code: VoiceLiveErrorCode, message: string) {
    super(message);
    this.name = 'VoiceLiveSpikeError';
    this.code = code;
  }
}

export type VoiceLiveUserSegment = {
  id: string;
  lane: VoiceLiveUserLane;
  text: string;
  persisted: boolean;
  createdAt: number;
  persistedAt: number | null;
  queuedOffline: boolean;
};

export type VoiceLiveTurn =
  | {
      id: string;
      role: 'user';
      lane: VoiceLiveUserLane;
      text: string;
      createdAt: number;
      segmentId: string;
    }
  | {
      id: string;
      role: 'assistant';
      lane: VoiceLiveUserLane;
      text: string;
      createdAt: number;
      flagged: boolean;
      questionKind?: DreamRecallQuestionKind;
    };

export type VoiceLiveUtterance = {
  id: string;
  text: string;
  createdAt: number;
};

export type VoiceLiveBudgets = {
  maxAiTurns: number;
  aiTurnsUsed: number;
  maxSessionMs: number;
  remainingQuota: number;
};

export type VoiceLiveSpikeState = {
  schemaVersion: typeof VOICE_LIVE_SPIKE_SCHEMA_VERSION;
  prototype: typeof VOICE_LIVE_SPIKE_PROTOTYPE_A.id;
  featureEnabled: boolean;
  dreamId: string;
  mode: VoiceLiveSessionMode;
  originalTranscript: string;
  originalTranscriptHash: string;
  originalPersistedSegmentId: string;
  originalTranscriptRef?: string;
  status: VoiceLiveSpikeStatus;
  network: VoiceLiveNetwork;
  resumeTarget: VoiceLiveSpikeStatus | null;
  turns: VoiceLiveTurn[];
  pendingUserSegment: VoiceLiveUserSegment | null;
  currentUtterance: VoiceLiveUtterance | null;
  speechCancelled: boolean;
  audioRetention: VoiceLiveAudioRetention;
  bargeInEnabled: true;
  flagged: boolean;
  budgets: VoiceLiveBudgets;
  startedAt: number | null;
  updatedAt: number;
};

export type VoiceLiveCommand =
  | { kind: 'idle' }
  | { kind: 'listen' }
  | { kind: 'await_persist'; segmentId: string; lane: VoiceLiveUserLane }
  | {
      kind: 'request_ai';
      intent: VoiceLiveAiIntent;
      dreamId: string;
      originalTranscriptHash: string;
      originalPersistedSegmentId: string;
      originalTranscriptRef?: string;
      turnIndex: number;
      persistedSegmentId: string;
      lane: VoiceLiveUserLane;
    }
  | { kind: 'speak'; utteranceId: string; text: string; tts: 'expo-speech' }
  | { kind: 'stop_speech' }
  | { kind: 'queue_offline'; segmentId: string }
  | { kind: 'paused' }
  | { kind: 'offline' }
  | { kind: 'interrupted' }
  | { kind: 'flag' }
  | { kind: 'ineligible'; reason: VoiceLiveIneligibleReason };

export type VoiceLiveResult = {
  state: VoiceLiveSpikeState;
  command: VoiceLiveCommand;
};

export type VoiceLiveHydrateResult =
  | { ok: true; state: VoiceLiveSpikeState }
  | { ok: false; reason: 'invalid_json' | 'unsupported_schema' | 'invalid_state' };

export type VoiceLiveEligibilityInput = {
  canCaptureAudio: boolean;
  speechAvailable: boolean;
  remainingQuota: number;
  network: VoiceLiveNetwork;
  audioRetentionOptIn?: boolean;
  featureEnabled?: boolean;
};

export type StartVoiceLiveSpikeInput = {
  dreamId: string;
  originalTranscript: string;
  originalPersistedSegmentId: string;
  originalTranscriptHash?: string;
  originalTranscriptRef?: string;
  now: number;
  mode: VoiceLiveSessionMode;
  eligibility: VoiceLiveEligibilityInput;
  maxAiTurns?: number;
  maxSessionMs?: number;
};

export type VoiceLiveGoNoGoInput = {
  p95EndOfSpeechToPersistMs: number;
  p95PersistToFirstTokenMs: number;
  p95TtsAudibleMs: number;
  p95BargeInStopMs: number;
  estimatedCostPerFiveTurnSessionUsd: number;
  persistBeforeAiViolations: number;
  bargeInHonored: boolean;
  offlineQueuedWithoutResponse: boolean;
  originalTranscriptLeakedToAiTurns: boolean;
  audioRetentionDefaultOff: boolean;
  quotaHonored: boolean;
  deviceProofTicket: typeof VOICE_LIVE_DEVICE_PROOF_TICKET;
  deviceProofComplete: boolean;
};

export type VoiceLiveGoNoGoDecision =
  | 'go_a'
  | 'no_go_a'
  | 'consider_b_after_no_go'
  | 'blocked_ti_429';

export type VoiceLiveGoNoGoResult = {
  decision: VoiceLiveGoNoGoDecision;
  prototype: 'A' | 'B' | null;
  optionBEligible: boolean;
  reasons: string[];
};

const USER_LANES = new Set<VoiceLiveUserLane>(['recall', 'analysis', 'chat']);

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const squeeze = (value: string): string => value.replace(/\s+/g, ' ').trim();
const lines = (value: string): string => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

function fail(code: VoiceLiveErrorCode, message: string): never {
  throw new VoiceLiveSpikeError(code, message);
}

const assertNow = (now: number): void => {
  if (!isTime(now)) fail('invalid_input', 'Voice live spike requires a finite timestamp.');
};

const boundMaxTurns = (value: number | undefined): number => {
  const maxAiTurns = value ?? DEFAULT_VOICE_LIVE_MAX_AI_TURNS;
  if (!Number.isInteger(maxAiTurns) || maxAiTurns < 1 || maxAiTurns > MAX_VOICE_LIVE_MAX_AI_TURNS) {
    fail('invalid_input', `maxAiTurns must be an integer between 1 and ${MAX_VOICE_LIVE_MAX_AI_TURNS}.`);
  }
  return maxAiTurns;
};

const boundSessionMs = (value: number | undefined): number => {
  const maxSessionMs = value ?? DEFAULT_VOICE_LIVE_MAX_SESSION_MS;
  if (!Number.isInteger(maxSessionMs) || maxSessionMs < 1_000) {
    fail('invalid_input', 'maxSessionMs must be an integer of at least 1000.');
  }
  return maxSessionMs;
};

const boundTranscript = (value: string): string => {
  if (typeof value !== 'string') fail('invalid_input', 'originalTranscript must be a string.');
  const normalized = lines(value);
  if (!normalized) fail('invalid_input', 'originalTranscript cannot be empty.');
  if (normalized.length > MAX_DREAM_RECALL_TRANSCRIPT_LENGTH) {
    fail('invalid_input', 'originalTranscript exceeds the persistable length.');
  }
  return normalized;
};

const boundSegment = (text: string): string => {
  if (typeof text !== 'string') fail('invalid_input', 'User segment text must be a string.');
  const normalized = lines(text);
  if (!normalized) fail('invalid_input', 'User segment text cannot be empty.');
  if (normalized.length > MAX_DREAM_RECALL_SEGMENT_LENGTH) {
    fail('invalid_input', 'User segment text exceeds the persistable length.');
  }
  return normalized;
};

const hashTranscript = (transcript: string): string => {
  let hash = 0x811c9dc5;
  const input = lines(transcript);
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const clone = (state: VoiceLiveSpikeState): VoiceLiveSpikeState => ({
  ...state,
  turns: state.turns.map((turn) => ({ ...turn })),
  pendingUserSegment: state.pendingUserSegment ? { ...state.pendingUserSegment } : null,
  currentUtterance: state.currentUtterance ? { ...state.currentUtterance } : null,
  budgets: { ...state.budgets },
});

const patch = (
  state: VoiceLiveSpikeState,
  next: Partial<VoiceLiveSpikeState>,
  now: number
): VoiceLiveSpikeState => ({ ...clone(state), ...next, updatedAt: now });

const laneFor = (mode: VoiceLiveSessionMode): VoiceLiveUserLane => mode;

const intentFor = (mode: VoiceLiveSessionMode): VoiceLiveAiIntent => {
  if (mode === 'recall') return DREAM_RECALL_QUESTION_INTENT;
  if (mode === 'analysis') return VOICE_LIVE_ANALYSIS_INTENT;
  return VOICE_LIVE_CHAT_INTENT;
};

const assistantCount = (state: Pick<VoiceLiveSpikeState, 'turns'>): number =>
  state.turns.filter((turn) => turn.role === 'assistant').length;

const lastTurn = (state: Pick<VoiceLiveSpikeState, 'turns'>): VoiceLiveTurn | undefined =>
  state.turns[state.turns.length - 1];

const sessionExceeded = (state: VoiceLiveSpikeState, now: number): boolean =>
  state.startedAt != null && now - state.startedAt > state.budgets.maxSessionMs;

const quotaRemaining = (state: VoiceLiveSpikeState): boolean => state.budgets.remainingQuota > 0;

const turnsRemaining = (state: VoiceLiveSpikeState): boolean =>
  state.budgets.aiTurnsUsed < state.budgets.maxAiTurns;

export function persistedVoiceLiveRequestId(state: VoiceLiveSpikeState): string | null {
  if (state.pendingUserSegment && state.pendingUserSegment.persisted !== true) return null;
  if (state.pendingUserSegment?.persisted === true) return state.pendingUserSegment.id;
  const lastUser = [...state.turns].reverse().find((turn) => turn.role === 'user');
  if (lastUser?.role === 'user') return lastUser.segmentId;
  if (!lastUser && (state.mode === 'recall' || state.mode === 'analysis')) {
    return state.originalPersistedSegmentId;
  }
  return null;
}

const hasPersistedSpeakAnchor = (state: VoiceLiveSpikeState): boolean =>
  persistedVoiceLiveRequestId(state) != null;

const ineligibleReason = (
  state: VoiceLiveSpikeState,
  now: number
): VoiceLiveIneligibleReason | null => {
  if (!state.featureEnabled) return 'feature_disabled';
  if (state.speechCancelled) return 'speech_cancelled';
  if (state.network === 'offline') return 'offline_ai';
  if (sessionExceeded(state, now)) return 'session_budget';
  if (!quotaRemaining(state)) return 'quota_exhausted';
  if (!turnsRemaining(state)) return 'ai_turn_budget';
  if (!persistedVoiceLiveRequestId(state)) return 'segment_not_persisted';
  return null;
};

const requestAiCommand = (
  state: VoiceLiveSpikeState,
  persistedSegmentId: string
): Extract<VoiceLiveCommand, { kind: 'request_ai' }> => ({
  kind: 'request_ai',
  intent: intentFor(state.mode),
  dreamId: state.dreamId,
  originalTranscriptHash: state.originalTranscriptHash,
  originalPersistedSegmentId: state.originalPersistedSegmentId,
  ...(state.originalTranscriptRef ? { originalTranscriptRef: state.originalTranscriptRef } : {}),
  turnIndex: assistantCount(state),
  persistedSegmentId,
  lane: laneFor(state.mode),
});

export function isAiOrTtsCommand(command: VoiceLiveCommand): boolean {
  return command.kind === 'request_ai' || command.kind === 'speak';
}

export function commandForVoiceLive(
  state: VoiceLiveSpikeState,
  now = state.updatedAt
): VoiceLiveCommand {
  if (state.status === 'idle') return { kind: 'idle' };
  if (!state.featureEnabled) return { kind: 'ineligible', reason: 'feature_disabled' };
  if (state.status === 'paused') return { kind: 'paused' };
  if (state.status === 'interrupted') return { kind: 'interrupted' };
  if (state.status === 'listening') return { kind: 'listen' };

  if (state.status === 'await_persist') {
    const pending = state.pendingUserSegment;
    if (!pending || pending.persisted) {
      fail('no_pending_segment', 'await_persist requires an unpersisted segment.');
    }
    return { kind: 'await_persist', segmentId: pending.id, lane: pending.lane };
  }

  if (state.status === 'offline') {
    const pending = state.pendingUserSegment;
    if (pending && pending.persisted !== true) {
      return { kind: 'await_persist', segmentId: pending.id, lane: pending.lane };
    }
    if (pending?.persisted === true && pending.queuedOffline !== true) {
      return { kind: 'queue_offline', segmentId: pending.id };
    }
    return { kind: 'offline' };
  }

  if (state.status === 'thinking') {
    const reason = ineligibleReason(state, now);
    if (reason) return { kind: 'ineligible', reason };
    const persistedSegmentId = persistedVoiceLiveRequestId(state);
    if (!persistedSegmentId) return { kind: 'ineligible', reason: 'segment_not_persisted' };
    return requestAiCommand(state, persistedSegmentId);
  }

  if (state.status === 'speaking') {
    const utterance = state.currentUtterance;
    if (!utterance || state.speechCancelled) return { kind: 'stop_speech' };
    if (!hasPersistedSpeakAnchor(state)) {
      return { kind: 'ineligible', reason: 'segment_not_persisted' };
    }
    return { kind: 'speak', utteranceId: utterance.id, text: utterance.text, tts: 'expo-speech' };
  }

  return { kind: 'idle' };
}

const assertMutable = (state: VoiceLiveSpikeState, action: string): void => {
  if (state.status === 'idle') fail('idle', `Cannot ${action} an idle voice live spike.`);
  if (state.status === 'paused') fail('paused', `Cannot ${action} a paused voice live spike.`);
};

export function resolveVoiceLiveCaptureEligibility(
  eligibility: VoiceLiveEligibilityInput
): VoiceLiveIneligibleReason | null {
  if (eligibility.featureEnabled !== true) return 'feature_disabled';
  if (!eligibility.canCaptureAudio) return 'no_microphone';
  if (!eligibility.speechAvailable) return 'speech_unavailable';
  return null;
}

export function createIdleVoiceLiveSpike(now: number): VoiceLiveResult {
  assertNow(now);
  const state: VoiceLiveSpikeState = {
    schemaVersion: VOICE_LIVE_SPIKE_SCHEMA_VERSION,
    prototype: VOICE_LIVE_SPIKE_PROTOTYPE_A.id,
    featureEnabled: false,
    dreamId: '',
    mode: 'recall',
    originalTranscript: '',
    originalTranscriptHash: '',
    originalPersistedSegmentId: '',
    status: 'idle',
    network: 'online',
    resumeTarget: null,
    turns: [],
    pendingUserSegment: null,
    currentUtterance: null,
    speechCancelled: false,
    audioRetention: 'off',
    bargeInEnabled: true,
    flagged: false,
    budgets: {
      maxAiTurns: DEFAULT_VOICE_LIVE_MAX_AI_TURNS,
      aiTurnsUsed: 0,
      maxSessionMs: DEFAULT_VOICE_LIVE_MAX_SESSION_MS,
      remainingQuota: 0,
    },
    startedAt: null,
    updatedAt: now,
  };
  return { state, command: { kind: 'idle' } };
}

export function startVoiceLiveSpike(input: StartVoiceLiveSpikeInput): VoiceLiveResult {
  assertNow(input.now);
  if (!isText(input.dreamId)) fail('invalid_input', 'dreamId is required to start the voice live spike.');
  if (!isText(input.originalPersistedSegmentId)) {
    fail('invalid_input', 'originalPersistedSegmentId is required for the already persisted original dream.');
  }
  if (input.mode !== 'recall' && input.mode !== 'analysis' && input.mode !== 'chat') {
    fail('invalid_input', 'mode must be recall, analysis, or chat.');
  }
  if (!Number.isInteger(input.eligibility.remainingQuota) || input.eligibility.remainingQuota < 0) {
    fail('invalid_input', 'remainingQuota must be a non-negative integer.');
  }

  const captureBlock = resolveVoiceLiveCaptureEligibility(input.eligibility);
  if (captureBlock) {
    return {
      state: createIdleVoiceLiveSpike(input.now).state,
      command: { kind: 'ineligible', reason: captureBlock },
    };
  }

  const originalTranscript = boundTranscript(input.originalTranscript);
  const originalTranscriptRef = isText(input.originalTranscriptRef)
    ? input.originalTranscriptRef.trim()
    : undefined;
  const budgets: VoiceLiveBudgets = {
    maxAiTurns: boundMaxTurns(input.maxAiTurns),
    aiTurnsUsed: 0,
    maxSessionMs: boundSessionMs(input.maxSessionMs),
    remainingQuota: input.eligibility.remainingQuota,
  };

  const base: VoiceLiveSpikeState = {
    schemaVersion: VOICE_LIVE_SPIKE_SCHEMA_VERSION,
    prototype: VOICE_LIVE_SPIKE_PROTOTYPE_A.id,
    featureEnabled: true,
    dreamId: input.dreamId.trim(),
    mode: input.mode,
    originalTranscript,
    originalTranscriptHash: isText(input.originalTranscriptHash)
      ? input.originalTranscriptHash.trim()
      : hashTranscript(originalTranscript),
    originalPersistedSegmentId: input.originalPersistedSegmentId.trim(),
    ...(originalTranscriptRef ? { originalTranscriptRef } : {}),
    status: 'listening',
    network: input.eligibility.network,
    resumeTarget: null,
    turns: [],
    pendingUserSegment: null,
    currentUtterance: null,
    speechCancelled: false,
    audioRetention: input.eligibility.audioRetentionOptIn ? 'opt_in' : 'off',
    bargeInEnabled: true,
    flagged: false,
    budgets,
    startedAt: input.now,
    updatedAt: input.now,
  };

  if (base.network === 'offline') {
    const offline = patch(base, { status: 'offline' }, input.now);
    return { state: offline, command: commandForVoiceLive(offline, input.now) };
  }

  if (input.mode === 'chat') {
    return { state: base, command: { kind: 'listen' } };
  }

  const thinking = patch(base, { status: 'thinking' }, input.now);
  return { state: thinking, command: commandForVoiceLive(thinking, input.now) };
}

export function captureVoiceLiveSegment(
  state: VoiceLiveSpikeState,
  text: string,
  now: number,
  segmentId?: string
): VoiceLiveResult {
  assertNow(now);
  assertMutable(state, 'capture a segment on');
  if (sessionExceeded(state, now)) fail('budget', 'The voice live session budget has elapsed.');

  if (state.status === 'speaking' || state.status === 'thinking') {
    return captureVoiceLiveSegment(bargeInVoiceLive(state, now).state, text, now, segmentId);
  }
  if (state.status !== 'listening' && state.status !== 'interrupted' && state.status !== 'offline') {
    fail('not_active', `Cannot capture a segment while ${state.status}.`);
  }

  const existing = state.pendingUserSegment;
  const next = patch(
    state,
    {
      status: state.network === 'offline' ? 'offline' : 'await_persist',
      pendingUserSegment: {
        id: segmentId ?? existing?.id ?? `seg-${now.toString(36)}-${state.turns.length}`,
        lane: laneFor(state.mode),
        text: boundSegment(text),
        persisted: false,
        createdAt: existing?.createdAt ?? now,
        persistedAt: null,
        queuedOffline: false,
      },
      currentUtterance: null,
      speechCancelled: false,
    },
    now
  );
  return { state: next, command: commandForVoiceLive(next, now) };
}

export function markVoiceLiveSegmentPersisted(
  state: VoiceLiveSpikeState,
  now: number
): VoiceLiveResult {
  assertNow(now);
  assertMutable(state, 'mark a segment persisted on');
  const pending = state.pendingUserSegment;
  if (pending == null) fail('no_pending_segment', 'A user segment must exist before it can be persisted.');
  if (pending.persisted) {
    return { state: clone(state), command: commandForVoiceLive(state, now) };
  }

  const persisted: VoiceLiveUserSegment = {
    ...pending,
    persisted: true,
    persistedAt: now,
  };
  const alreadyAnswered = state.turns.some(
    (turn) => turn.role === 'user' && turn.segmentId === persisted.id
  );
  const turns = alreadyAnswered
    ? state.turns.map((turn) => ({ ...turn }))
    : [
        ...state.turns,
        {
          id: `usr-${now.toString(36)}-${persisted.id}`,
          role: 'user' as const,
          lane: persisted.lane,
          text: persisted.text,
          createdAt: now,
          segmentId: persisted.id,
        },
      ];

  if (state.network === 'offline') {
    const next = patch(state, { status: 'offline', turns, pendingUserSegment: persisted }, now);
    return { state: next, command: commandForVoiceLive(next, now) };
  }

  const thinking = patch(
    state,
    {
      status: 'thinking',
      turns,
      pendingUserSegment: persisted,
      speechCancelled: false,
      currentUtterance: null,
    },
    now
  );
  return { state: thinking, command: commandForVoiceLive(thinking, now) };
}

export function acknowledgeVoiceLiveOfflineQueue(
  state: VoiceLiveSpikeState,
  now: number
): VoiceLiveResult {
  assertNow(now);
  if (state.status !== 'offline') fail('not_active', 'Offline queue acknowledgement requires the offline status.');
  const pending = state.pendingUserSegment;
  if (pending == null || pending.persisted !== true) {
    fail('segment_not_persisted', 'Only a persisted segment can enter the offline queue.');
  }
  const next = patch(state, { pendingUserSegment: { ...pending, queuedOffline: true } }, now);
  return { state: next, command: { kind: 'offline' } };
}

export function requestVoiceLiveAi(state: VoiceLiveSpikeState, now: number): VoiceLiveResult {
  assertNow(now);
  assertMutable(state, 'request AI from');
  if (state.status === 'offline') fail('offline', 'Offline voice live never requests AI or TTS.');
  if (state.status === 'interrupted') {
    fail('interrupted', 'Interrupted speech must be resumed before requesting AI.');
  }
  if (state.pendingUserSegment && state.pendingUserSegment.persisted !== true) {
    fail(
      'segment_not_persisted',
      'The current user segment must be persisted before requesting AI or TTS.'
    );
  }

  const persistedSegmentId = persistedVoiceLiveRequestId(state);
  if (!persistedSegmentId) {
    fail('segment_not_persisted', 'A persisted segment is required before requesting AI or TTS.');
  }

  const reason = ineligibleReason({ ...state, speechCancelled: false }, now);
  if (reason && reason !== 'speech_cancelled') {
    const listening = patch(state, { status: 'listening', currentUtterance: null }, now);
    return { state: listening, command: { kind: 'ineligible', reason } };
  }

  const next = patch(state, { status: 'thinking', speechCancelled: false, currentUtterance: null }, now);
  return { state: next, command: requestAiCommand(next, persistedSegmentId) };
}

export function appendVoiceLiveAiUtterance(
  state: VoiceLiveSpikeState,
  input: { text: string; questionKind?: DreamRecallQuestionKind; utteranceId?: string },
  now: number
): VoiceLiveResult {
  assertNow(now);
  assertMutable(state, 'append an AI utterance to');
  if (state.status === 'offline') fail('offline', 'Offline voice live never speaks an AI response.');
  if (state.pendingUserSegment && state.pendingUserSegment.persisted !== true) {
    fail('segment_not_persisted', 'The current user segment must be persisted before TTS.');
  }
  if (!persistedVoiceLiveRequestId(state)) {
    fail('segment_not_persisted', 'A persisted segment is required before TTS.');
  }
  if (state.status !== 'thinking') fail('not_active', 'AI utterances can only append after a persisted thinking turn.');
  if (sessionExceeded(state, now)) fail('budget', 'The voice live session budget has elapsed.');
  if (!quotaRemaining(state) || !turnsRemaining(state)) {
    fail('budget', 'AI or TTS is blocked by quota or turn budget.');
  }

  const text = squeeze(input.text);
  if (!text) fail('invalid_utterance', 'AI utterance text cannot be empty.');
  if (text.length > MAX_VOICE_LIVE_UTTERANCE_LENGTH) {
    fail('invalid_utterance', 'AI utterance exceeds the speakable length.');
  }
  if (text === squeeze(state.originalTranscript)) {
    fail('invalid_utterance', 'AI utterances must not copy the original transcript.');
  }
  if (state.mode === 'recall') {
    if (!input.questionKind || !isNeutralRecallQuestion({ kind: input.questionKind, text })) {
      fail('invalid_utterance', 'Recall utterances must use a closed neutral kind and non-directive text.');
    }
  }

  const utterance: VoiceLiveUtterance = {
    id: input.utteranceId ?? `utt-${now.toString(36)}-${assistantCount(state)}`,
    text,
    createdAt: now,
  };
  const assistantTurn: Extract<VoiceLiveTurn, { role: 'assistant' }> = {
    id: utterance.id,
    role: 'assistant',
    lane: laneFor(state.mode),
    text,
    createdAt: now,
    flagged: false,
    ...(state.mode === 'recall' && input.questionKind ? { questionKind: input.questionKind } : {}),
  };
  const budgets: VoiceLiveBudgets = {
    ...state.budgets,
    aiTurnsUsed: state.budgets.aiTurnsUsed + 1,
    remainingQuota: Math.max(0, state.budgets.remainingQuota - 1),
  };

  const speaking = patch(
    state,
    {
      status: 'speaking',
      turns: [...state.turns, assistantTurn],
      currentUtterance: utterance,
      pendingUserSegment: null,
      speechCancelled: false,
      budgets,
    },
    now
  );
  return { state: speaking, command: commandForVoiceLive(speaking, now) };
}

export function completeVoiceLiveUtterance(state: VoiceLiveSpikeState, now: number): VoiceLiveResult {
  assertNow(now);
  if (state.status !== 'speaking') fail('not_active', 'Only a speaking spike can complete an utterance.');
  const next = patch(state, { status: 'listening', currentUtterance: null, speechCancelled: false }, now);
  return { state: next, command: { kind: 'listen' } };
}

export function bargeInVoiceLive(state: VoiceLiveSpikeState, now: number): VoiceLiveResult {
  assertNow(now);
  assertMutable(state, 'barge in on');
  if (state.status !== 'speaking' && state.status !== 'thinking') {
    fail('not_active', 'Barge-in is only defined while thinking or speaking.');
  }
  const next = patch(
    state,
    {
      status: 'interrupted',
      currentUtterance: null,
      speechCancelled: true,
    },
    now
  );
  return { state: next, command: { kind: 'stop_speech' } };
}

export function repriseVoiceLive(state: VoiceLiveSpikeState, now: number): VoiceLiveResult {
  assertNow(now);
  if (state.status !== 'interrupted') {
    fail('not_active', 'Reprise is only defined from the interrupted status.');
  }
  const next = patch(
    state,
    {
      status: state.network === 'offline' ? 'offline' : 'listening',
      speechCancelled: false,
      currentUtterance: null,
    },
    now
  );
  return { state: next, command: commandForVoiceLive(next, now) };
}

export function pauseVoiceLiveSpike(state: VoiceLiveSpikeState, now: number): VoiceLiveResult {
  assertNow(now);
  if (state.status === 'idle') fail('idle', 'Cannot pause an idle voice live spike.');
  if (state.status === 'paused') return { state: clone(state), command: { kind: 'paused' } };
  const next = patch(
    state,
    {
      status: 'paused',
      resumeTarget: state.status,
      currentUtterance: null,
      speechCancelled: state.status === 'speaking' || state.status === 'thinking' || state.speechCancelled,
    },
    now
  );
  return { state: next, command: { kind: 'paused' } };
}

export function resumeVoiceLiveSpike(state: VoiceLiveSpikeState, now: number): VoiceLiveResult {
  assertNow(now);
  if (state.status !== 'paused') fail('not_active', `Cannot resume a ${state.status} voice live spike.`);
  if (sessionExceeded(state, now)) fail('budget', 'The voice live session budget has elapsed.');

  const target = state.resumeTarget;
  let status: VoiceLiveSpikeStatus = 'listening';
  if (state.network === 'offline') status = 'offline';
  else if (state.pendingUserSegment && state.pendingUserSegment.persisted !== true) status = 'await_persist';
  else if (target === 'interrupted') status = 'interrupted';
  else if (target === 'thinking' && persistedVoiceLiveRequestId(state) && !state.speechCancelled) {
    status = 'thinking';
  } else {
    status = 'listening';
  }

  const next = patch(
    state,
    {
      status,
      resumeTarget: null,
      currentUtterance: null,
      speechCancelled: status === 'interrupted',
    },
    now
  );
  return { state: next, command: commandForVoiceLive(next, now) };
}

export function goOfflineVoiceLive(state: VoiceLiveSpikeState, now: number): VoiceLiveResult {
  assertNow(now);
  assertMutable(state, 'move offline');
  const next = patch(
    state,
    {
      status: 'offline',
      network: 'offline',
      currentUtterance: null,
      speechCancelled: state.status === 'speaking' || state.status === 'thinking' || state.speechCancelled,
    },
    now
  );
  return { state: next, command: commandForVoiceLive(next, now) };
}

export function goOnlineVoiceLive(state: VoiceLiveSpikeState, now: number): VoiceLiveResult {
  assertNow(now);
  if (state.status === 'idle') fail('idle', 'Cannot move an idle spike online.');
  if (state.status === 'paused') fail('paused', 'Resume the paused spike before moving online.');

  const onlineProbe: VoiceLiveSpikeState = { ...state, network: 'online', speechCancelled: false };
  let status: VoiceLiveSpikeStatus = 'listening';
  if (state.pendingUserSegment && state.pendingUserSegment.persisted !== true) status = 'await_persist';
  else if (state.status === 'interrupted') status = 'interrupted';
  else if (
    persistedVoiceLiveRequestId(onlineProbe) &&
    lastTurn(state)?.role !== 'assistant' &&
    ineligibleReason(onlineProbe, now) == null
  ) {
    status = 'thinking';
  }

  const next = patch(
    state,
    {
      status,
      network: 'online',
      currentUtterance: null,
      speechCancelled: status === 'interrupted',
    },
    now
  );
  return { state: next, command: commandForVoiceLive(next, now) };
}

export function flagVoiceLiveSpike(state: VoiceLiveSpikeState, now: number): VoiceLiveResult {
  assertNow(now);
  if (state.status === 'idle') fail('idle', 'Cannot flag an idle voice live spike.');
  const lastAssistant = [...state.turns].reverse().find((turn) => turn.role === 'assistant');
  const turns = lastAssistant
    ? state.turns.map((turn) =>
        turn.id === lastAssistant.id && turn.role === 'assistant' ? { ...turn, flagged: true } : turn
      )
    : state.turns.map((turn) => ({ ...turn }));
  const next = patch(state, { turns, flagged: true }, now);
  return { state: next, command: { kind: 'flag' } };
}

export function evaluateVoiceLiveGoNoGo(input: VoiceLiveGoNoGoInput): VoiceLiveGoNoGoResult {
  const reasons: string[] = [];
  const thresholds = VOICE_LIVE_GO_NO_GO_THRESHOLDS;

  // Missing evidence is indeterminate, not a measured success/failure. In
  // particular NaN comparisons and zero-cost stubs must never unlock A or B.
  const measuredFields = [
    'p95EndOfSpeechToPersistMs',
    'p95PersistToFirstTokenMs',
    'p95TtsAudibleMs',
    'p95BargeInStopMs',
    'estimatedCostPerFiveTurnSessionUsd',
  ] as const;
  for (const field of measuredFields) {
    if (!Number.isFinite(input[field]) || input[field] <= 0) {
      reasons.push(`${field} requires a finite, positive measurement on TI-429.`);
    }
  }
  if (!Number.isSafeInteger(input.persistBeforeAiViolations) || input.persistBeforeAiViolations < 0) {
    reasons.push('persistBeforeAiViolations requires a measured non-negative integer on TI-429.');
  }
  const observedFlags = [
    'bargeInHonored', 'offlineQueuedWithoutResponse', 'originalTranscriptLeakedToAiTurns',
    'audioRetentionDefaultOff', 'quotaHonored', 'deviceProofComplete',
  ] as const;
  for (const field of observedFlags) {
    if (typeof input[field] !== 'boolean') {
      reasons.push(`${field} requires an explicit boolean observation on TI-429.`);
    }
  }
  if (reasons.length > 0) {
    return { decision: 'blocked_ti_429', prototype: null, optionBEligible: false, reasons };
  }

  if (input.deviceProofTicket !== VOICE_LIVE_DEVICE_PROOF_TICKET || !input.deviceProofComplete) {
    reasons.push('Device proofs remain on TI-429.');
  }
  if (input.persistBeforeAiViolations > 0) {
    reasons.push('AI or TTS was requested before the last segment was persisted.');
  }
  if (input.originalTranscriptLeakedToAiTurns) {
    reasons.push('The original transcript leaked into recall, analysis, or chat turns.');
  }
  if (!input.audioRetentionDefaultOff) {
    reasons.push('Audio retention was not off by default.');
  }
  if (!input.bargeInHonored) {
    reasons.push('Barge-in did not stop speech while preserving the last segment.');
  }
  if (!input.offlineQueuedWithoutResponse) {
    reasons.push('Offline capture queued a spoken or AI response.');
  }
  if (!input.quotaHonored) {
    reasons.push('Quota or turn budgets were not enforced.');
  }

  const latencyFail =
    input.p95EndOfSpeechToPersistMs > thresholds.p95EndOfSpeechToPersistMs ||
    input.p95PersistToFirstTokenMs > thresholds.p95PersistToFirstTokenMs ||
    input.p95TtsAudibleMs > thresholds.p95TtsAudibleMs ||
    input.p95BargeInStopMs > thresholds.p95BargeInStopMs;
  const costFail = input.estimatedCostPerFiveTurnSessionUsd > thresholds.maxCostPerFiveTurnSessionUsd;
  if (latencyFail) reasons.push('Prototype A missed a p95 latency gate.');
  if (costFail) reasons.push('Prototype A missed the session cost gate.');

  const invariantFail =
    input.persistBeforeAiViolations > 0 ||
    input.originalTranscriptLeakedToAiTurns ||
    !input.audioRetentionDefaultOff ||
    !input.bargeInHonored ||
    !input.offlineQueuedWithoutResponse ||
    !input.quotaHonored;

  if (input.deviceProofTicket !== VOICE_LIVE_DEVICE_PROOF_TICKET || !input.deviceProofComplete) {
    return {
      decision: 'blocked_ti_429',
      prototype: null,
      optionBEligible: false,
      reasons,
    };
  }
  if (!latencyFail && !costFail && !invariantFail) {
    return { decision: 'go_a', prototype: 'A', optionBEligible: false, reasons: [] };
  }
  const optionBEligible = latencyFail && !costFail && !invariantFail;
  return {
    decision: optionBEligible ? 'consider_b_after_no_go' : 'no_go_a',
    prototype: optionBEligible ? 'B' : null,
    optionBEligible,
    reasons,
  };
}

const isUserLane = (value: unknown): value is VoiceLiveUserLane =>
  typeof value === 'string' && USER_LANES.has(value as VoiceLiveUserLane);

const isSegment = (value: unknown): value is VoiceLiveUserSegment =>
  isRecord(value) &&
  isText(value.id) &&
  isUserLane(value.lane) &&
  typeof value.text === 'string' &&
  value.text.trim().length > 0 &&
  value.text.length <= MAX_DREAM_RECALL_SEGMENT_LENGTH &&
  typeof value.persisted === 'boolean' &&
  isTime(value.createdAt) &&
  (value.persistedAt === null || isTime(value.persistedAt)) &&
  typeof value.queuedOffline === 'boolean' &&
  (value.persisted ? value.persistedAt !== null : value.persistedAt === null);

const isTurn = (value: unknown, originalTranscript: string): value is VoiceLiveTurn => {
  if (!isRecord(value) || !isText(value.id) || !isTime(value.createdAt) || !isUserLane(value.lane)) {
    return false;
  }
  if (typeof value.text !== 'string' || value.text.trim().length === 0) return false;
  if (squeeze(value.text) === squeeze(originalTranscript)) return false;
  if (value.role === 'user') {
    return isText(value.segmentId) && value.text.length <= MAX_DREAM_RECALL_SEGMENT_LENGTH;
  }
  return (
    value.role === 'assistant' &&
    typeof value.flagged === 'boolean' &&
    value.text.length <= MAX_VOICE_LIVE_UTTERANCE_LENGTH
  );
};

export function isVoiceLiveSpikeState(value: unknown): value is VoiceLiveSpikeState {
  if (!isRecord(value) || value.schemaVersion !== VOICE_LIVE_SPIKE_SCHEMA_VERSION) return false;
  if (value.prototype !== VOICE_LIVE_SPIKE_PROTOTYPE_A.id) return false;
  if (value.featureEnabled !== true && value.featureEnabled !== false) return false;
  if (typeof value.dreamId !== 'string' || typeof value.originalTranscript !== 'string') return false;
  if (typeof value.originalTranscriptHash !== 'string' || typeof value.originalPersistedSegmentId !== 'string') {
    return false;
  }
  if (value.originalTranscriptRef !== undefined && typeof value.originalTranscriptRef !== 'string') return false;
  if (value.mode !== 'recall' && value.mode !== 'analysis' && value.mode !== 'chat') return false;
  if (!(VOICE_LIVE_SPIKE_STATUSES as readonly string[]).includes(value.status as string)) return false;
  if (value.network !== 'online' && value.network !== 'offline') return false;
  if (
    value.resumeTarget != null &&
    !(VOICE_LIVE_SPIKE_STATUSES as readonly string[]).includes(value.resumeTarget as string)
  ) {
    return false;
  }
  if (!Array.isArray(value.turns)) return false;
  if (value.audioRetention !== 'off' && value.audioRetention !== 'opt_in') return false;
  if (value.bargeInEnabled !== true || typeof value.speechCancelled !== 'boolean' || typeof value.flagged !== 'boolean') {
    return false;
  }
  if (!isRecord(value.budgets)) return false;
  const budgets = value.budgets;
  if (
    !Number.isInteger(budgets.maxAiTurns) ||
    !Number.isInteger(budgets.aiTurnsUsed) ||
    !Number.isInteger(budgets.maxSessionMs) ||
    !Number.isInteger(budgets.remainingQuota)
  ) {
    return false;
  }
  const originalTranscript = value.originalTranscript;
  if (!value.turns.every((turn) => isTurn(turn, originalTranscript))) return false;
  if (value.pendingUserSegment !== null && !isSegment(value.pendingUserSegment)) return false;
  if (value.currentUtterance !== null) {
    if (
      !isRecord(value.currentUtterance) ||
      !isText(value.currentUtterance.id) ||
      typeof value.currentUtterance.text !== 'string' ||
      !isTime(value.currentUtterance.createdAt)
    ) {
      return false;
    }
  }
  if (value.startedAt !== null && !isTime(value.startedAt)) return false;
  if (!isTime(value.updatedAt)) return false;
  if (value.status === 'await_persist' && (value.pendingUserSegment == null || value.pendingUserSegment.persisted)) {
    return false;
  }
  if (value.status === 'speaking' && value.currentUtterance == null) return false;
  if (value.status === 'thinking' || value.status === 'speaking') {
    if (value.network === 'offline') return false;
    if (persistedVoiceLiveRequestId(value as VoiceLiveSpikeState) == null) return false;
  }
  if (value.featureEnabled !== true && value.status !== 'idle') return false;
  if (value.status === 'idle') {
    return (
      value.dreamId === '' &&
      value.originalTranscript === '' &&
      value.turns.length === 0 &&
      value.pendingUserSegment === null &&
      value.startedAt === null &&
      value.audioRetention === 'off' &&
      value.featureEnabled === false
    );
  }
  return isText(value.dreamId) && isText(value.originalTranscriptHash) && isText(value.originalPersistedSegmentId);
}

export function validateVoiceLiveSpikeState(value: unknown): asserts value is VoiceLiveSpikeState {
  if (!isVoiceLiveSpikeState(value)) throw new Error('Invalid voice live spike state.');
}

export function serializeVoiceLiveSpikeState(state: VoiceLiveSpikeState): string {
  validateVoiceLiveSpikeState(state);
  return JSON.stringify(state);
}

export function hydrateVoiceLiveSpikeState(raw: unknown): VoiceLiveHydrateResult {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return { ok: false, reason: 'invalid_json' };
    }
  }
  if (!isRecord(parsed)) return { ok: false, reason: 'invalid_state' };
  if (parsed.schemaVersion !== VOICE_LIVE_SPIKE_SCHEMA_VERSION) {
    return { ok: false, reason: 'unsupported_schema' };
  }
  if (!isVoiceLiveSpikeState(parsed)) return { ok: false, reason: 'invalid_state' };
  return { ok: true, state: clone(parsed) };
}
