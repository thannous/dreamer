import * as Crypto from 'expo-crypto';

export const LUCID_MORNING_VOICE_NOTE_VERSION = 1 as const;

export const MAX_LUCID_MORNING_VOICE_DURATION_MS = 10 * 60 * 1000;
export const MAX_LUCID_MORNING_VOICE_TITLE_LENGTH = 80;
export const MAX_LUCID_MORNING_VOICE_TRANSCRIPT_LENGTH = 4_000;
export const MAX_LUCID_MORNING_VOICE_SCOPE_LENGTH = 256;

export const LUCID_MORNING_VOICE_NOTE_STATUSES = ['draft', 'ready'] as const;
export type LucidMorningVoiceNoteStatus = (typeof LUCID_MORNING_VOICE_NOTE_STATUSES)[number];

export const LUCID_MORNING_VOICE_CAPTURE_PHASES = [
  'idle',
  'created',
  'requesting_permission',
  'recording',
  'paused',
  'stopping',
  'stopped',
  'interrupted',
  'recoverable',
  'error',
] as const;
export type LucidMorningVoiceCapturePhase =
  (typeof LUCID_MORNING_VOICE_CAPTURE_PHASES)[number];

export const LUCID_MORNING_VOICE_CAPTURE_EVENTS = [
  'create',
  'request_permission',
  'permission_granted',
  'permission_denied',
  'pause',
  'resume',
  'stop',
  'interrupt',
  'persist_draft',
  'persist_ready',
  'fail',
  'reset',
] as const;
export type LucidMorningVoiceCaptureEvent =
  (typeof LUCID_MORNING_VOICE_CAPTURE_EVENTS)[number];

export const LUCID_MORNING_VOICE_ERROR_REASONS = [
  'invalid_transition',
  'permission_denied',
  'recorder_unavailable',
  'interrupted',
  'storage_full',
  'persistence_failed',
  'invalid_metadata',
  'invalid_duration',
  'invalid_title',
  'invalid_scope',
  'invalid_id',
  'invalid_uri',
] as const;
export type LucidMorningVoiceErrorReason =
  (typeof LUCID_MORNING_VOICE_ERROR_REASONS)[number];

export const LUCID_MORNING_VOICE_ALLOWED_EXTENSIONS = [
  '.m4a',
  '.caf',
  '.wav',
  '.webm',
  '.amr',
  '.aac',
  '.mp4',
] as const;
export type LucidMorningVoiceExtension =
  (typeof LUCID_MORNING_VOICE_ALLOWED_EXTENSIONS)[number];

export const LUCID_MORNING_VOICE_ALLOWED_MIME_TYPES = [
  'audio/mp4',
  'audio/x-caf',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/amr',
  'audio/aac',
  'audio/mpeg',
  'audio/3gpp',
] as const;
export type LucidMorningVoiceMimeType =
  (typeof LUCID_MORNING_VOICE_ALLOWED_MIME_TYPES)[number];

const MIME_TYPES_BY_EXTENSION: Record<
  LucidMorningVoiceExtension,
  readonly LucidMorningVoiceMimeType[]
> = {
  '.m4a': ['audio/mp4'],
  '.mp4': ['audio/mp4'],
  '.caf': ['audio/x-caf'],
  '.wav': ['audio/wav', 'audio/x-wav'],
  '.webm': ['audio/webm'],
  '.amr': ['audio/amr', 'audio/3gpp'],
  '.aac': ['audio/aac', 'audio/mpeg'],
};

export type LucidMorningVoiceNote = {
  version: typeof LUCID_MORNING_VOICE_NOTE_VERSION;
  id: string;
  userScope: string;
  experimentId: string | null;
  status: LucidMorningVoiceNoteStatus;
  title: string;
  transcript: string | null;
  durationMs: number;
  mimeType: LucidMorningVoiceMimeType;
  extension: LucidMorningVoiceExtension;
  uri: string;
  createdAt: number;
  updatedAt: number;
  recoverable: boolean;
};

export type LucidMorningVoiceCaptureState = {
  phase: LucidMorningVoiceCapturePhase;
  noteId: string | null;
  errorReason: LucidMorningVoiceErrorReason | null;
};

export class LucidMorningVoiceNoteError extends Error {
  readonly reason: LucidMorningVoiceErrorReason;

  constructor(reason: LucidMorningVoiceErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'LucidMorningVoiceNoteError';
    this.reason = reason;
  }
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const UNSAFE_TEXT_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const ALLOWED_NOTE_KEYS = [
  'version',
  'id',
  'userScope',
  'experimentId',
  'status',
  'title',
  'transcript',
  'durationMs',
  'mimeType',
  'extension',
  'uri',
  'createdAt',
  'updatedAt',
  'recoverable',
] as const;

const FORBIDDEN_METADATA_KEY_PATTERN = /upload|cloud|sync|remote|cdn|bucket/i;

const TRANSITIONS: Record<
  LucidMorningVoiceCapturePhase,
  Partial<Record<LucidMorningVoiceCaptureEvent, LucidMorningVoiceCapturePhase>>
> = {
  idle: { create: 'created', reset: 'idle' },
  created: { request_permission: 'requesting_permission', fail: 'error', reset: 'idle' },
  requesting_permission: {
    permission_granted: 'recording',
    permission_denied: 'error',
    fail: 'error',
  },
  recording: {
    pause: 'paused',
    stop: 'stopping',
    interrupt: 'interrupted',
    fail: 'error',
  },
  paused: {
    resume: 'recording',
    stop: 'stopping',
    interrupt: 'interrupted',
    fail: 'error',
  },
  stopping: {
    persist_ready: 'stopped',
    persist_draft: 'recoverable',
    interrupt: 'interrupted',
    fail: 'error',
  },
  stopped: { reset: 'idle', create: 'created' },
  interrupted: { persist_draft: 'recoverable', fail: 'error' },
  recoverable: { reset: 'idle', create: 'created' },
  error: { reset: 'idle', create: 'created' },
};

function isAllowed<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function collapseReadableWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function localUriPath(uri: string): string {
  return uri.split('#')[0]?.split('?')[0] ?? uri;
}

function nextUpdatedAt(note: LucidMorningVoiceNote, now: number): number {
  return Math.max(now, note.updatedAt, note.createdAt);
}

export function isLucidMorningVoiceNoteId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

export function isLucidMorningVoiceErrorReason(
  value: unknown
): value is LucidMorningVoiceErrorReason {
  return isAllowed(value, LUCID_MORNING_VOICE_ERROR_REASONS);
}

export function isLucidMorningVoiceUserScope(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= MAX_LUCID_MORNING_VOICE_SCOPE_LENGTH &&
    !CONTROL_CHARS.test(value)
  );
}

export function isLocalLucidMorningVoiceUri(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) return false;
  if (CONTROL_CHARS.test(value)) return false;
  const lower = value.toLowerCase();
  if (lower.startsWith('http:') || lower.startsWith('https:') || lower.startsWith('content:')) {
    return false;
  }
  if (lower.startsWith('file:')) {
    return lower.startsWith('file://');
  }
  return value.startsWith('/') || value.startsWith('./');
}

export function normalizeLucidMorningVoiceTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (UNSAFE_TEXT_CONTROLS.test(value)) return null;
  const title = collapseReadableWhitespace(value);
  if (!title || title.length > MAX_LUCID_MORNING_VOICE_TITLE_LENGTH) return null;
  return title;
}

export function normalizeLucidMorningVoiceTranscript(
  value: unknown
): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  if (UNSAFE_TEXT_CONTROLS.test(value)) return undefined;
  const transcript = collapseReadableWhitespace(value);
  if (!transcript) return null;
  if (transcript.length > MAX_LUCID_MORNING_VOICE_TRANSCRIPT_LENGTH) return undefined;
  return transcript;
}

export function isLucidMorningVoiceDuration(
  value: unknown,
  options?: { allowZero?: boolean }
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value > MAX_LUCID_MORNING_VOICE_DURATION_MS) return false;
  return options?.allowZero ? value >= 0 : value > 0;
}

export function createLucidMorningVoiceNoteId(now = Date.now(), entropy?: string): string {
  const source = entropy ?? Crypto.randomUUID();
  const cleaned = String(source).replace(/[^A-Za-z0-9_-]/g, '');
  const id = `mvn_${now.toString(36)}_${cleaned || 'x'}`;
  return id.slice(0, 64);
}

export function createIdleLucidMorningVoiceCaptureState(): LucidMorningVoiceCaptureState {
  return { phase: 'idle', noteId: null, errorReason: null };
}

export function canLucidMorningVoiceCapture(
  event: LucidMorningVoiceCaptureEvent,
  phase: LucidMorningVoiceCapturePhase
): boolean {
  return Boolean(TRANSITIONS[phase]?.[event]);
}

function assertCaptureNoteId(value: string | null | undefined): void {
  if (value == null) return;
  if (!isLucidMorningVoiceNoteId(value)) {
    throw new LucidMorningVoiceNoteError('invalid_id', 'Capture note id is invalid');
  }
}

function assertCaptureErrorReason(value: unknown): asserts value is LucidMorningVoiceErrorReason | null | undefined {
  if (value == null) return;
  if (!isLucidMorningVoiceErrorReason(value)) {
    throw new LucidMorningVoiceNoteError('invalid_metadata', 'Capture error reason is invalid');
  }
}

export function transitionLucidMorningVoiceCapture(
  current: LucidMorningVoiceCaptureState,
  event: LucidMorningVoiceCaptureEvent,
  details?: { noteId?: string | null; errorReason?: LucidMorningVoiceErrorReason | null }
): LucidMorningVoiceCaptureState {
  if (!isAllowed(event, LUCID_MORNING_VOICE_CAPTURE_EVENTS)) {
    throw new LucidMorningVoiceNoteError('invalid_transition', 'Capture event is invalid');
  }
  assertCaptureNoteId(current.noteId);
  assertCaptureNoteId(details?.noteId);
  assertCaptureErrorReason(current.errorReason);
  assertCaptureErrorReason(details?.errorReason);

  const nextPhase = TRANSITIONS[current.phase]?.[event];
  if (!nextPhase) {
    throw new LucidMorningVoiceNoteError(
      'invalid_transition',
      `Cannot apply ${event} while ${current.phase}`
    );
  }
  const errorReason =
    nextPhase === 'error'
      ? event === 'permission_denied'
        ? 'permission_denied'
        : details?.errorReason ?? current.errorReason ?? 'recorder_unavailable'
      : nextPhase === 'interrupted'
        ? 'interrupted'
        : null;
  return {
    phase: nextPhase,
    noteId: details?.noteId !== undefined ? details.noteId : current.noteId,
    errorReason,
  };
}

function hasForbiddenMetadataKeys(value: object): boolean {
  return Object.keys(value).some(
    (key) =>
      !(ALLOWED_NOTE_KEYS as readonly string[]).includes(key) ||
      FORBIDDEN_METADATA_KEY_PATTERN.test(key)
  );
}

export function mimeTypeForLucidMorningVoiceExtension(
  extension: LucidMorningVoiceExtension
): LucidMorningVoiceMimeType {
  return MIME_TYPES_BY_EXTENSION[extension][0];
}

export function extensionFromLucidMorningVoiceUri(uri: string): LucidMorningVoiceExtension | null {
  const match = localUriPath(uri).toLowerCase().match(/(\.[a-z0-9]+)$/);
  const extension = match?.[1];
  return isAllowed(extension, LUCID_MORNING_VOICE_ALLOWED_EXTENSIONS) ? extension : null;
}

function isConsistentVoiceNoteMedia(input: {
  uri: string;
  extension: unknown;
  mimeType: unknown;
}): boolean {
  if (!isAllowed(input.extension, LUCID_MORNING_VOICE_ALLOWED_EXTENSIONS)) return false;
  if (!isAllowed(input.mimeType, LUCID_MORNING_VOICE_ALLOWED_MIME_TYPES)) return false;
  const uriExtension = extensionFromLucidMorningVoiceUri(input.uri);
  return (
    uriExtension === input.extension &&
    MIME_TYPES_BY_EXTENSION[input.extension].includes(input.mimeType)
  );
}

export function isLucidMorningVoiceNote(value: unknown): value is LucidMorningVoiceNote {
  if (!value || typeof value !== 'object') return false;
  if (hasForbiddenMetadataKeys(value)) return false;
  const note = value as LucidMorningVoiceNote;
  const transcriptOk =
    note.transcript === null ||
    (typeof note.transcript === 'string' &&
      normalizeLucidMorningVoiceTranscript(note.transcript) === note.transcript);
  const durationOk =
    note.status === 'draft'
      ? isLucidMorningVoiceDuration(note.durationMs, { allowZero: true })
      : isLucidMorningVoiceDuration(note.durationMs);
  return (
    note.version === LUCID_MORNING_VOICE_NOTE_VERSION &&
    isLucidMorningVoiceNoteId(note.id) &&
    isLucidMorningVoiceUserScope(note.userScope) &&
    (note.experimentId === null || isLucidMorningVoiceNoteId(note.experimentId)) &&
    isAllowed(note.status, LUCID_MORNING_VOICE_NOTE_STATUSES) &&
    normalizeLucidMorningVoiceTitle(note.title) === note.title &&
    transcriptOk &&
    durationOk &&
    isLocalLucidMorningVoiceUri(note.uri) &&
    isConsistentVoiceNoteMedia(note) &&
    typeof note.createdAt === 'number' &&
    Number.isFinite(note.createdAt) &&
    typeof note.updatedAt === 'number' &&
    Number.isFinite(note.updatedAt) &&
    note.updatedAt >= note.createdAt &&
    typeof note.recoverable === 'boolean' &&
    (note.status !== 'ready' || note.recoverable === false) &&
    (note.status !== 'draft' || note.recoverable === true)
  );
}

export function parseLucidMorningVoiceNote(value: unknown): LucidMorningVoiceNote | null {
  return isLucidMorningVoiceNote(value) ? value : null;
}

export function assertLucidMorningVoiceNote(
  value: unknown
): asserts value is LucidMorningVoiceNote {
  if (!isLucidMorningVoiceNote(value)) {
    throw new LucidMorningVoiceNoteError('invalid_metadata', 'Invalid Lucid morning voice note');
  }
}

export function createLucidMorningVoiceNote(input: {
  id?: string;
  userScope: string;
  experimentId?: string | null;
  status?: LucidMorningVoiceNoteStatus;
  title?: string;
  transcript?: string | null;
  durationMs: number;
  mimeType: LucidMorningVoiceMimeType;
  extension: LucidMorningVoiceExtension;
  uri: string;
  createdAt?: number;
  updatedAt?: number;
  recoverable?: boolean;
  now?: number;
}): LucidMorningVoiceNote {
  const now = input.now ?? Date.now();
  const title = normalizeLucidMorningVoiceTitle(input.title ?? 'Morning voice note');
  if (!title) {
    throw new LucidMorningVoiceNoteError('invalid_title', 'Voice note title is invalid');
  }
  if (!isLucidMorningVoiceUserScope(input.userScope)) {
    throw new LucidMorningVoiceNoteError('invalid_scope', 'Voice note user scope is invalid');
  }
  if (!isLocalLucidMorningVoiceUri(input.uri)) {
    throw new LucidMorningVoiceNoteError('invalid_uri', 'Voice note URI must stay local');
  }
  if (!isConsistentVoiceNoteMedia(input)) {
    throw new LucidMorningVoiceNoteError(
      'invalid_uri',
      'Voice note URI, extension and MIME type must match'
    );
  }
  const status = input.status ?? (input.recoverable ? 'draft' : 'ready');
  const durationOk =
    status === 'draft'
      ? isLucidMorningVoiceDuration(input.durationMs, { allowZero: true })
      : isLucidMorningVoiceDuration(input.durationMs);
  if (!durationOk) {
    throw new LucidMorningVoiceNoteError('invalid_duration', 'Voice note duration is invalid');
  }
  const transcript =
    input.transcript === undefined ? null : normalizeLucidMorningVoiceTranscript(input.transcript);
  if (input.transcript !== undefined && input.transcript !== null && transcript === undefined) {
    throw new LucidMorningVoiceNoteError('invalid_metadata', 'Transcript is invalid');
  }
  const note: LucidMorningVoiceNote = {
    version: LUCID_MORNING_VOICE_NOTE_VERSION,
    id: input.id ?? createLucidMorningVoiceNoteId(now),
    userScope: input.userScope,
    experimentId: input.experimentId ?? null,
    status,
    title,
    transcript: transcript ?? null,
    durationMs: input.durationMs,
    mimeType: input.mimeType,
    extension: input.extension,
    uri: input.uri,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    recoverable: status === 'draft',
  };
  assertLucidMorningVoiceNote(note);
  return note;
}

export function renameLucidMorningVoiceNote(
  note: LucidMorningVoiceNote,
  title: string,
  now = Date.now()
): LucidMorningVoiceNote {
  const nextTitle = normalizeLucidMorningVoiceTitle(title);
  if (!nextTitle) {
    throw new LucidMorningVoiceNoteError('invalid_title', 'Voice note title is invalid');
  }
  const next = { ...note, title: nextTitle, updatedAt: nextUpdatedAt(note, now) };
  assertLucidMorningVoiceNote(next);
  return next;
}

export function linkLucidMorningVoiceNoteToExperiment(
  note: LucidMorningVoiceNote,
  experimentId: string,
  now = Date.now()
): LucidMorningVoiceNote {
  if (!isLucidMorningVoiceNoteId(experimentId)) {
    throw new LucidMorningVoiceNoteError('invalid_id', 'Experiment id is invalid');
  }
  const next = {
    ...note,
    experimentId,
    updatedAt: nextUpdatedAt(note, now),
  };
  assertLucidMorningVoiceNote(next);
  return next;
}

export function withLucidMorningVoiceNoteTranscript(
  note: LucidMorningVoiceNote,
  transcript: string | null,
  now = Date.now()
): LucidMorningVoiceNote {
  const nextTranscript = normalizeLucidMorningVoiceTranscript(transcript);
  if (transcript !== null && nextTranscript === undefined) {
    throw new LucidMorningVoiceNoteError('invalid_metadata', 'Transcript is invalid');
  }
  const next = {
    ...note,
    transcript: nextTranscript ?? null,
    updatedAt: nextUpdatedAt(note, now),
  };
  assertLucidMorningVoiceNote(next);
  return next;
}

export function classifyLucidMorningVoiceFailure(error: unknown): LucidMorningVoiceErrorReason {
  if (error instanceof LucidMorningVoiceNoteError) return error.reason;
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  const text = `${code} ${message}`.toLowerCase();
  if (text.includes('permission')) return 'permission_denied';
  if (
    text.includes('enospc') ||
    text.includes('no space') ||
    text.includes('storage_capacity') ||
    text.includes('disk full') ||
    text.includes('quota')
  ) {
    return 'storage_full';
  }
  if (text.includes('interrupt') || text.includes('media services')) return 'interrupted';
  if (text.includes('record') || text.includes('audio') || text.includes('unavailable')) {
    return 'recorder_unavailable';
  }
  return 'persistence_failed';
}
