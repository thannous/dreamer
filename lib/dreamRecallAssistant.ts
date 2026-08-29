/**
 * Pure persistable kernel for the optional dream-recall assistant (TI-427).
 *
 * After free narration the original dream is already persisted. Opt-in can
 * request the first question from that persisted original id. Later answers
 * still require add -> persist -> request. `originalTranscript` never enters
 * turns or commands. Neutrality is a closed `questionKind`; localized text is
 * only bounded and screened. No UI, network, i18n, chat, quota, or storage I/O.
 */

export const DREAM_RECALL_ASSISTANT_SCHEMA_VERSION = 1 as const;
export const DREAM_RECALL_QUESTION_INTENT = 'recall_question' as const;
export const DEFAULT_DREAM_RECALL_MAX_QUESTIONS = 5;
export const MAX_DREAM_RECALL_MAX_QUESTIONS = 8;
export const MAX_DREAM_RECALL_TRANSCRIPT_LENGTH = 20_000;
export const MAX_DREAM_RECALL_SEGMENT_LENGTH = 8_000;
export const MAX_DREAM_RECALL_QUESTION_LENGTH = 280;

export const DREAM_RECALL_QUESTION_KINDS = [
  'what_else',
  'what_next',
  'who_else',
  'where',
  'what_seen',
  'what_heard',
  'appearance',
  'colors',
  'objects',
  'before',
  'after',
  'scene_change',
  'setting',
  'speaking',
  'last_noticed',
] as const;

export type DreamRecallQuestionKind = (typeof DREAM_RECALL_QUESTION_KINDS)[number];
export type DreamRecallAssistantStatus = 'idle' | 'active' | 'paused' | 'completed' | 'skipped';
export type DreamRecallQuestionIntent = typeof DREAM_RECALL_QUESTION_INTENT;

export type DreamRecallErrorCode =
  | 'idle'
  | 'not_active'
  | 'paused'
  | 'terminal'
  | 'no_pending_segment'
  | 'segment_not_persisted'
  | 'open_question'
  | 'max_questions'
  | 'invalid_question'
  | 'invalid_input';

export class DreamRecallAssistantError extends Error {
  readonly code: DreamRecallErrorCode;
  constructor(code: DreamRecallErrorCode, message: string) {
    super(message);
    this.name = 'DreamRecallAssistantError';
    this.code = code;
  }
}

export type DreamRecallUserSegment = {
  id: string;
  text: string;
  persisted: boolean;
  createdAt: number;
  persistedAt: number | null;
};

export type DreamRecallTurn =
  | {
      id: string;
      role: 'question';
      kind: DreamRecallQuestionKind;
      text: string;
      createdAt: number;
    }
  | {
      id: string;
      role: 'answer';
      text: string;
      createdAt: number;
      segmentId: string;
    };

export type DreamRecallAssistantState = {
  schemaVersion: typeof DREAM_RECALL_ASSISTANT_SCHEMA_VERSION;
  dreamId: string;
  originalTranscript: string;
  originalTranscriptHash: string;
  originalPersistedSegmentId: string;
  originalTranscriptRef?: string;
  status: DreamRecallAssistantStatus;
  turns: DreamRecallTurn[];
  pendingUserSegment: DreamRecallUserSegment | null;
  maxQuestions: number;
  startedAt: number | null;
  updatedAt: number;
  completedAt: number | null;
};

export type DreamRecallCommand =
  | { kind: 'idle' }
  | {
      kind: 'request_next_question';
      intent: DreamRecallQuestionIntent;
      dreamId: string;
      originalTranscriptHash: string;
      originalPersistedSegmentId: string;
      originalTranscriptRef?: string;
      questionIndex: number;
      persistedSegmentId: string;
    }
  | { kind: 'await_user_segment' }
  | { kind: 'await_persist' }
  | { kind: 'paused' }
  | { kind: 'completed' }
  | { kind: 'skipped' };

export type DreamRecallResult = {
  state: DreamRecallAssistantState;
  command: DreamRecallCommand;
};

export type DreamRecallHydrateResult =
  | { ok: true; state: DreamRecallAssistantState }
  | { ok: false; reason: 'invalid_json' | 'unsupported_schema' | 'invalid_state' };

export type StartDreamRecallAssistantInput = {
  dreamId: string;
  originalTranscript: string;
  originalPersistedSegmentId: string;
  originalTranscriptHash?: string;
  originalTranscriptRef?: string;
  now: number;
  maxQuestions?: number;
};

const QUESTION_KIND_SET = new Set<string>(DREAM_RECALL_QUESTION_KINDS);

const INTERPRETIVE_TEXT =
  /mean(?:s|ing)?|symbol(?:e|es|s|ic|ism|o|os)?|s[ií]mbol|bedeutet|signif(?:ie|ie[sz]|ica)|interpr[eé]t|diagnos|sugg[eè]r|should you|devrais[- ]tu|deber[ií]as|dovresti|solltest|deveria|peut-[eê]tre que|maybe you|perhaps you|try to (?:add|imagine)/i;

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const squeeze = (value: string): string => value.replace(/\s+/g, ' ').trim();
const lines = (value: string): string => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

const clone = (state: DreamRecallAssistantState): DreamRecallAssistantState => ({
  ...state,
  turns: state.turns.map((turn) => ({ ...turn })),
  pendingUserSegment: state.pendingUserSegment ? { ...state.pendingUserSegment } : null,
});

const questionCount = (state: Pick<DreamRecallAssistantState, 'turns'>): number =>
  state.turns.filter((turn) => turn.role === 'question').length;

const lastTurn = (state: Pick<DreamRecallAssistantState, 'turns'>): DreamRecallTurn | undefined =>
  state.turns[state.turns.length - 1];

const hasOpenQuestion = (state: Pick<DreamRecallAssistantState, 'turns'>): boolean =>
  lastTurn(state)?.role === 'question';

const remainingSlots = (state: Pick<DreamRecallAssistantState, 'turns' | 'maxQuestions'>): number =>
  Math.max(0, state.maxQuestions - questionCount(state));

const isTerminal = (status: DreamRecallAssistantStatus): boolean =>
  status === 'completed' || status === 'skipped';

function fail(code: DreamRecallErrorCode, message: string): never {
  throw new DreamRecallAssistantError(code, message);
}

const assertNow = (now: number): void => {
  if (!isTime(now)) fail('invalid_input', 'Dream recall assistant requires a finite timestamp.');
};

const assertActive = (state: DreamRecallAssistantState, action: string): void => {
  if (state.status === 'paused') fail('paused', `Cannot ${action} a paused recall assistant.`);
  if (isTerminal(state.status)) fail('terminal', `Cannot ${action} a ${state.status} recall assistant.`);
  if (state.status !== 'active') fail('not_active', `Cannot ${action} a ${state.status} recall assistant.`);
};

const boundMax = (value: number | undefined): number => {
  const maxQuestions = value ?? DEFAULT_DREAM_RECALL_MAX_QUESTIONS;
  if (!Number.isInteger(maxQuestions) || maxQuestions < 1 || maxQuestions > MAX_DREAM_RECALL_MAX_QUESTIONS) {
    fail('invalid_input', `maxQuestions must be an integer between 1 and ${MAX_DREAM_RECALL_MAX_QUESTIONS}.`);
  }
  return maxQuestions;
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

const patch = (
  state: DreamRecallAssistantState,
  next: Partial<DreamRecallAssistantState>,
  now: number
): DreamRecallAssistantState => ({ ...clone(state), ...next, updatedAt: now });

const persistedRequestId = (state: DreamRecallAssistantState): string | null => {
  if (hasOpenQuestion(state) || remainingSlots(state) === 0) return null;
  if (state.turns.length === 0 && !state.pendingUserSegment) {
    return state.originalPersistedSegmentId;
  }
  if (state.pendingUserSegment?.persisted === true && lastTurn(state)?.role !== 'question') {
    return state.pendingUserSegment.id;
  }
  return null;
};

const requestCommand = (
  state: DreamRecallAssistantState,
  persistedSegmentId: string
): Extract<DreamRecallCommand, { kind: 'request_next_question' }> => ({
  kind: 'request_next_question',
  intent: DREAM_RECALL_QUESTION_INTENT,
  dreamId: state.dreamId,
  originalTranscriptHash: state.originalTranscriptHash,
  originalPersistedSegmentId: state.originalPersistedSegmentId,
  ...(state.originalTranscriptRef ? { originalTranscriptRef: state.originalTranscriptRef } : {}),
  questionIndex: questionCount(state),
  persistedSegmentId,
});

const commandFor = (state: DreamRecallAssistantState): DreamRecallCommand => {
  if (state.status === 'idle') return { kind: 'idle' };
  if (state.status === 'paused') return { kind: 'paused' };
  if (state.status === 'completed') return { kind: 'completed' };
  if (state.status === 'skipped') return { kind: 'skipped' };
  if (state.pendingUserSegment && state.pendingUserSegment.persisted !== true) {
    return { kind: 'await_persist' };
  }
  const persistedSegmentId = persistedRequestId(state);
  if (persistedSegmentId) return requestCommand(state, persistedSegmentId);
  return { kind: 'await_user_segment' };
};

export function isDreamRecallQuestionKind(value: unknown): value is DreamRecallQuestionKind {
  return typeof value === 'string' && QUESTION_KIND_SET.has(value);
}

export function isNeutralRecallQuestion(
  value: unknown
): value is { kind: DreamRecallQuestionKind; text: string } {
  if (!isRecord(value) || !isDreamRecallQuestionKind(value.kind) || typeof value.text !== 'string') {
    return false;
  }
  const text = squeeze(value.text);
  if (!text || text.length > MAX_DREAM_RECALL_QUESTION_LENGTH || !text.endsWith('?')) return false;
  return !INTERPRETIVE_TEXT.test(text);
}

export function startDreamRecallAssistant(input: StartDreamRecallAssistantInput): DreamRecallResult {
  assertNow(input.now);
  if (!isText(input.dreamId)) fail('invalid_input', 'dreamId is required to start the recall assistant.');
  if (!isText(input.originalPersistedSegmentId)) {
    fail('invalid_input', 'originalPersistedSegmentId is required for the already persisted original dream.');
  }

  const originalTranscript = boundTranscript(input.originalTranscript);
  const originalTranscriptRef = isText(input.originalTranscriptRef)
    ? input.originalTranscriptRef.trim()
    : undefined;
  const state: DreamRecallAssistantState = {
    schemaVersion: DREAM_RECALL_ASSISTANT_SCHEMA_VERSION,
    dreamId: input.dreamId.trim(),
    originalTranscript,
    originalTranscriptHash: isText(input.originalTranscriptHash)
      ? input.originalTranscriptHash.trim()
      : hashTranscript(originalTranscript),
    originalPersistedSegmentId: input.originalPersistedSegmentId.trim(),
    ...(originalTranscriptRef ? { originalTranscriptRef } : {}),
    status: 'active',
    turns: [],
    pendingUserSegment: null,
    maxQuestions: boundMax(input.maxQuestions),
    startedAt: input.now,
    updatedAt: input.now,
    completedAt: null,
  };
  return { state, command: commandFor(state) };
}

export function addDreamRecallUserSegment(
  state: DreamRecallAssistantState,
  text: string,
  now: number,
  segmentId?: string
): DreamRecallResult {
  assertNow(now);
  assertActive(state, 'add a user segment to');
  const existing = state.pendingUserSegment;
  const next = patch(
    state,
    {
      pendingUserSegment: {
        id: segmentId ?? existing?.id ?? `seg-${now.toString(36)}-${state.turns.length}`,
        text: boundSegment(text),
        persisted: false,
        createdAt: existing?.createdAt ?? now,
        persistedAt: null,
      },
    },
    now
  );
  return { state: next, command: { kind: 'await_persist' } };
}

export function markDreamRecallSegmentPersisted(
  state: DreamRecallAssistantState,
  now: number
): DreamRecallResult {
  assertNow(now);
  assertActive(state, 'mark a segment persisted on');
  const pending = state.pendingUserSegment;
  if (pending == null) fail('no_pending_segment', 'A user segment must exist before it can be persisted.');

  const persisted: DreamRecallUserSegment = {
    id: pending.id,
    text: pending.text,
    createdAt: pending.createdAt,
    persisted: true,
    persistedAt: now,
  };
  let turns = state.turns.map((turn) => ({ ...turn }));
  if (hasOpenQuestion(state) && !turns.some((turn) => turn.role === 'answer' && turn.segmentId === persisted.id)) {
    turns = [
      ...turns,
      {
        id: `ans-${now.toString(36)}-${persisted.id}`,
        role: 'answer',
        text: persisted.text,
        createdAt: now,
        segmentId: persisted.id,
      },
    ];
  }
  const next = patch(state, { turns, pendingUserSegment: persisted }, now);
  return { state: next, command: commandFor(next) };
}

export function requestDreamRecallNextQuestion(
  state: DreamRecallAssistantState,
  now: number
): DreamRecallResult {
  assertNow(now);
  assertActive(state, 'request the next question from');

  const pending = state.pendingUserSegment;
  if (pending != null && pending.persisted !== true) {
    fail(
      'segment_not_persisted',
      'The current user segment must be persisted before requesting a recall question.'
    );
  }
  if (hasOpenQuestion(state)) fail('open_question', 'The previous recall question is still unanswered.');
  if (remainingSlots(state) === 0) fail('max_questions', 'The recall assistant has reached its question limit.');

  if (state.turns.length === 0 && pending == null) {
    return {
      state: patch(state, {}, now),
      command: requestCommand(state, state.originalPersistedSegmentId),
    };
  }
  if (pending == null) {
    fail('no_pending_segment', 'A user segment must exist before requesting a later recall question.');
  }
  return { state: patch(state, {}, now), command: requestCommand(state, pending.id) };
}

export function appendNeutralRecallQuestion(
  state: DreamRecallAssistantState,
  input: { kind: DreamRecallQuestionKind; text: string; questionId?: string },
  now: number
): DreamRecallResult {
  assertNow(now);
  assertActive(state, 'append a question to');
  if (hasOpenQuestion(state)) fail('open_question', 'The previous recall question is still unanswered.');
  if (remainingSlots(state) === 0) fail('max_questions', 'The recall assistant has reached its question limit.');

  const canUseOriginal = state.turns.length === 0 && !state.pendingUserSegment;
  const pending = state.pendingUserSegment;
  if (!canUseOriginal && pending == null) {
    fail('no_pending_segment', 'A persisted user segment is required before appending a later recall question.');
  }
  if (!canUseOriginal && pending?.persisted !== true) {
    fail('segment_not_persisted', 'The current user segment must be persisted before appending a recall question.');
  }
  if (!isNeutralRecallQuestion({ kind: input.kind, text: input.text })) {
    fail('invalid_question', 'Recall questions must use a closed neutral kind and non-directive text.');
  }
  const text = squeeze(input.text);
  if (text === squeeze(state.originalTranscript)) {
    fail('invalid_question', 'Recall questions must not copy the original transcript.');
  }

  const next = patch(
    state,
    {
      turns: [
        ...state.turns,
        {
          id: input.questionId ?? `q-${now.toString(36)}-${questionCount(state)}`,
          role: 'question',
          kind: input.kind,
          text,
          createdAt: now,
        },
      ],
      pendingUserSegment: null,
    },
    now
  );
  return { state: next, command: { kind: 'await_user_segment' } };
}

export function pauseDreamRecallAssistant(state: DreamRecallAssistantState, now: number): DreamRecallResult {
  assertNow(now);
  assertActive(state, 'pause');
  return { state: patch(state, { status: 'paused' }, now), command: { kind: 'paused' } };
}

export function resumeDreamRecallAssistant(state: DreamRecallAssistantState, now: number): DreamRecallResult {
  assertNow(now);
  if (state.status !== 'paused') {
    fail(isTerminal(state.status) ? 'terminal' : 'not_active', `Cannot resume a ${state.status} recall assistant.`);
  }
  const next = patch(state, { status: 'active' }, now);
  return { state: next, command: commandFor(next) };
}

export function skipDreamRecallAssistant(state: DreamRecallAssistantState, now: number): DreamRecallResult {
  assertNow(now);
  if (state.status === 'idle') fail('idle', 'Cannot skip an idle recall assistant.');
  if (state.status === 'completed') fail('terminal', 'Cannot skip a completed recall assistant.');
  if (state.status === 'skipped') return { state: clone(state), command: { kind: 'skipped' } };
  return {
    state: patch(state, { status: 'skipped', pendingUserSegment: null, completedAt: now }, now),
    command: { kind: 'skipped' },
  };
}

export function completeDreamRecallAssistant(state: DreamRecallAssistantState, now: number): DreamRecallResult {
  assertNow(now);
  if (state.status !== 'active' && state.status !== 'paused') {
    fail(isTerminal(state.status) ? 'terminal' : 'not_active', `Cannot complete a ${state.status} recall assistant.`);
  }
  return {
    state: patch(state, { status: 'completed', pendingUserSegment: null, completedAt: now }, now),
    command: { kind: 'completed' },
  };
}

const isSegment = (value: unknown): value is DreamRecallUserSegment =>
  isRecord(value) &&
  isText(value.id) &&
  typeof value.text === 'string' &&
  value.text.trim().length > 0 &&
  value.text.length <= MAX_DREAM_RECALL_SEGMENT_LENGTH &&
  typeof value.persisted === 'boolean' &&
  isTime(value.createdAt) &&
  (value.persistedAt === null || isTime(value.persistedAt)) &&
  (value.persisted ? value.persistedAt !== null : value.persistedAt === null);

const isTurn = (value: unknown): value is DreamRecallTurn => {
  if (!isRecord(value) || !isText(value.id) || !isTime(value.createdAt)) return false;
  if (value.role === 'question') return isNeutralRecallQuestion({ kind: value.kind, text: value.text });
  return (
    value.role === 'answer' &&
    typeof value.text === 'string' &&
    value.text.trim().length > 0 &&
    value.text.length <= MAX_DREAM_RECALL_SEGMENT_LENGTH &&
    isText(value.segmentId)
  );
};

export function isDreamRecallAssistantState(value: unknown): value is DreamRecallAssistantState {
  if (!isRecord(value) || value.schemaVersion !== DREAM_RECALL_ASSISTANT_SCHEMA_VERSION) return false;
  if (typeof value.dreamId !== 'string' || typeof value.originalTranscript !== 'string') return false;
  const originalTranscript = value.originalTranscript;
  if (typeof value.originalTranscriptHash !== 'string') return false;
  if (typeof value.originalPersistedSegmentId !== 'string') return false;
  if (value.originalTranscriptRef !== undefined && typeof value.originalTranscriptRef !== 'string') return false;
  if (
    value.status !== 'idle' &&
    value.status !== 'active' &&
    value.status !== 'paused' &&
    value.status !== 'completed' &&
    value.status !== 'skipped'
  ) {
    return false;
  }
  const maxQuestions = value.maxQuestions;
  if (
    typeof maxQuestions !== 'number' ||
    !Number.isInteger(maxQuestions) ||
    maxQuestions < 1 ||
    maxQuestions > MAX_DREAM_RECALL_MAX_QUESTIONS
  ) {
    return false;
  }
  if (!Array.isArray(value.turns) || !value.turns.every(isTurn) || value.turns.length > maxQuestions * 2) {
    return false;
  }
  const turns = value.turns as DreamRecallTurn[];
  for (let index = 0; index < turns.length; index += 1) {
    if (turns[index]?.role !== (index % 2 === 0 ? 'question' : 'answer')) return false;
  }
  if (turns.filter((turn) => turn.role === 'question').length > maxQuestions) return false;
  if (turns.some((turn) => squeeze(turn.text) === squeeze(originalTranscript))) return false;
  if (value.pendingUserSegment !== null && !isSegment(value.pendingUserSegment)) return false;
  if (value.startedAt !== null && !isTime(value.startedAt)) return false;
  if (!isTime(value.updatedAt)) return false;
  if (value.completedAt !== null && !isTime(value.completedAt)) return false;
  if (value.status === 'idle') {
    return (
      value.dreamId === '' &&
      value.originalTranscript === '' &&
      value.originalTranscriptHash === '' &&
      value.originalPersistedSegmentId === '' &&
      value.turns.length === 0 &&
      value.pendingUserSegment === null &&
      value.startedAt === null &&
      value.completedAt === null
    );
  }
  if (!isText(value.dreamId) || !isText(value.originalTranscriptHash) || !isText(value.originalPersistedSegmentId)) {
    return false;
  }
  if (originalTranscript.trim().length === 0 || value.startedAt === null) return false;
  if (isTerminal(value.status)) return value.completedAt !== null && value.pendingUserSegment === null;
  return value.completedAt === null;
}

export function validateDreamRecallAssistantState(
  value: unknown
): asserts value is DreamRecallAssistantState {
  if (!isDreamRecallAssistantState(value)) throw new Error('Invalid dream recall assistant state.');
}

export function serializeDreamRecallAssistantState(state: DreamRecallAssistantState): string {
  validateDreamRecallAssistantState(state);
  return JSON.stringify(state);
}

export function hydrateDreamRecallAssistantState(raw: unknown): DreamRecallHydrateResult {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return { ok: false, reason: 'invalid_json' };
    }
  }
  if (!isRecord(parsed)) return { ok: false, reason: 'invalid_state' };
  if (parsed.schemaVersion !== DREAM_RECALL_ASSISTANT_SCHEMA_VERSION) {
    return { ok: false, reason: 'unsupported_schema' };
  }
  if (!isDreamRecallAssistantState(parsed)) return { ok: false, reason: 'invalid_state' };
  return { ok: true, state: clone(parsed) };
}
