import type { DreamAnalysis } from '@/lib/types';
import { LUCID_TECHNIQUES, type LucidTechnique } from '@/lib/lucid/model';
import {
  LUCID_DREAM_SIGN_CATEGORIES,
  LUCID_DREAM_SIGN_MAX_LABEL_CHARS,
  toLucidDreamSignSourceId,
  type LucidActiveDreamSign,
  type LucidDreamSignCategory,
} from '@/lib/lucid/dreamSigns';

export const LUCID_DREAM_REHEARSAL_VERSION = 1 as const;
export const LUCID_DREAM_REHEARSAL_MAX_SESSION_ID_CHARS = 64 as const;
export const LUCID_DREAM_REHEARSAL_MAX_DREAM_ID_CHARS = 64 as const;
export const LUCID_DREAM_REHEARSAL_MAX_SIGN_ID_CHARS = 128 as const;
export const LUCID_DREAM_REHEARSAL_MAX_TITLE_CHARS = 80 as const;
export const LUCID_DREAM_REHEARSAL_MAX_EXCERPT_CHARS = 180 as const;
export const LUCID_DREAM_REHEARSAL_MAX_LABEL_CHARS = LUCID_DREAM_SIGN_MAX_LABEL_CHARS;

export const LUCID_DREAM_REHEARSAL_STATUSES = [
  'active',
  'interrupted',
  'completed',
] as const;
export type LucidDreamRehearsalStatus =
  (typeof LUCID_DREAM_REHEARSAL_STATUSES)[number];

export const LUCID_DREAM_REHEARSAL_ACTION_IDS = [
  'recognize_sign',
  'set_lucid_intention',
] as const;
export type LucidDreamRehearsalActionId =
  (typeof LUCID_DREAM_REHEARSAL_ACTION_IDS)[number];

export const LUCID_DREAM_REHEARSAL_PRESENTATIONS = ['motion', 'static'] as const;
export type LucidDreamRehearsalPresentation =
  (typeof LUCID_DREAM_REHEARSAL_PRESENTATIONS)[number];

export const LUCID_DREAM_REHEARSAL_SOUND_CUE_ID =
  'lucid_dream_rehearsal_recognize_sign' as const;
export const LUCID_DREAM_REHEARSAL_HAPTIC_CUE_ID =
  'lucid_dream_rehearsal_recognize_sign' as const;

export const LUCID_DREAM_REHEARSAL_TEXT_ALTERNATIVE_IDS = [
  'lucid_dream_rehearsal_scene',
  'lucid_dream_rehearsal_recognize_sign',
  'lucid_dream_rehearsal_set_lucid_intention',
] as const;

export type LucidDreamRehearsalDream = Pick<
  DreamAnalysis,
  'id' | 'title' | 'transcript'
>;

export type LucidDreamRehearsalSourceProgram =
  | Readonly<{ kind: 'technique'; technique: LucidTechnique }>
  | Readonly<{ kind: 'atlas' }>;

export type LucidDreamRehearsalScene = Readonly<{
  dreamId: string;
  title: string;
  excerpt: string;
  excerptTruncated: boolean;
  signId: string;
  signLabel: string;
  category: LucidDreamSignCategory | null;
}>;

export type LucidDreamRehearsalRejectionReason =
  | 'dream_not_found'
  | 'sign_not_found'
  | 'sign_not_linked';

export type LucidDreamRehearsalSelectionResult =
  | Readonly<{ status: 'ready'; scene: LucidDreamRehearsalScene }>
  | Readonly<{ status: 'rejected'; reason: LucidDreamRehearsalRejectionReason }>;

export type LucidDreamRehearsalSession = Readonly<{
  version: typeof LUCID_DREAM_REHEARSAL_VERSION;
  sessionId: string;
  status: LucidDreamRehearsalStatus;
  step: LucidDreamRehearsalActionId;
  dreamId: string;
  signId: string;
  signLabel: string;
  category: LucidDreamSignCategory | null;
  sourceProgram: LucidDreamRehearsalSourceProgram;
  presentation: LucidDreamRehearsalPresentation;
  startedAt: number;
  completedAt: number | null;
  updatedAt: number;
  recognizedAt: number | null;
  intentionConfirmedAt: number | null;
}>;

export type LucidDreamRehearsalCompletion = Readonly<{
  version: typeof LUCID_DREAM_REHEARSAL_VERSION;
  sessionId: string;
  dreamId: string;
  signId: string;
  sourceProgram: LucidDreamRehearsalSourceProgram;
  completedAt: number;
}>;

export type LucidDreamRehearsalProgress = Readonly<{
  currentAction: LucidDreamRehearsalActionId;
  completedActionCount: 0 | 1 | 2;
  totalActionCount: 2;
  recognized: boolean;
  intentionConfirmed: boolean;
  canComplete: boolean;
}>;

export type LucidDreamRehearsalCues = Readonly<{
  soundCueId: typeof LUCID_DREAM_REHEARSAL_SOUND_CUE_ID | null;
  hapticCueId: typeof LUCID_DREAM_REHEARSAL_HAPTIC_CUE_ID | null;
}>;

const SESSION_KEYS = [
  'version',
  'sessionId',
  'status',
  'step',
  'dreamId',
  'signId',
  'signLabel',
  'category',
  'sourceProgram',
  'presentation',
  'startedAt',
  'completedAt',
  'updatedAt',
  'recognizedAt',
  'intentionConfirmedAt',
] as const;

const COMPLETION_KEYS = [
  'version',
  'sessionId',
  'dreamId',
  'signId',
  'sourceProgram',
  'completedAt',
] as const;

const SCENE_KEYS = [
  'dreamId',
  'title',
  'excerpt',
  'excerptTruncated',
  'signId',
  'signLabel',
  'category',
] as const;

const TECHNIQUE_PROGRAM_KEYS = ['kind', 'technique'] as const;
const ATLAS_PROGRAM_KEYS = ['kind'] as const;
const MAX_SAFE_TIMESTAMP = 8_640_000_000_000_000;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const SESSION_ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;
const DREAM_ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;
const SIGN_ID_PATTERN = /^sign:[A-Za-z0-9][A-Za-z0-9_-]{0,121}$/;
const FORBIDDEN_IDS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === expected.length &&
    actual.every((key) => expected.includes(key)) &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function isFiniteTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_SAFE_TIMESTAMP
  );
}

function isNullableTimestamp(value: unknown): value is number | null {
  return value === null || isFiniteTimestamp(value);
}

function isSafeId(value: unknown, pattern: RegExp, maxChars: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= maxChars &&
    !CONTROL_CHARS.test(value) &&
    !FORBIDDEN_IDS.has(value) &&
    pattern.test(value)
  );
}

function isSessionId(value: unknown): value is string {
  return isSafeId(
    value,
    SESSION_ID_PATTERN,
    LUCID_DREAM_REHEARSAL_MAX_SESSION_ID_CHARS
  );
}

function isDreamId(value: unknown): value is string {
  return isSafeId(value, DREAM_ID_PATTERN, LUCID_DREAM_REHEARSAL_MAX_DREAM_ID_CHARS);
}

function isSignId(value: unknown): value is string {
  return isSafeId(value, SIGN_ID_PATTERN, LUCID_DREAM_REHEARSAL_MAX_SIGN_ID_CHARS);
}

function isCategory(value: unknown): value is LucidDreamSignCategory | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      (LUCID_DREAM_SIGN_CATEGORIES as readonly string[]).includes(value))
  );
}

function isPresentation(value: unknown): value is LucidDreamRehearsalPresentation {
  return (
    typeof value === 'string' &&
    (LUCID_DREAM_REHEARSAL_PRESENTATIONS as readonly string[]).includes(value)
  );
}

function isActionId(value: unknown): value is LucidDreamRehearsalActionId {
  return (
    typeof value === 'string' &&
    (LUCID_DREAM_REHEARSAL_ACTION_IDS as readonly string[]).includes(value)
  );
}

function isStatus(value: unknown): value is LucidDreamRehearsalStatus {
  return (
    typeof value === 'string' &&
    (LUCID_DREAM_REHEARSAL_STATUSES as readonly string[]).includes(value)
  );
}

function isTechnique(value: unknown): value is LucidTechnique {
  return (
    typeof value === 'string' &&
    (LUCID_TECHNIQUES as readonly string[]).includes(value)
  );
}

function cloneSourceProgram(
  value: LucidDreamRehearsalSourceProgram
): LucidDreamRehearsalSourceProgram {
  return value.kind === 'atlas'
    ? { kind: 'atlas' }
    : { kind: 'technique', technique: value.technique };
}

export function isLucidDreamRehearsalSourceProgram(
  value: unknown
): value is LucidDreamRehearsalSourceProgram {
  if (!isPlainObject(value)) return false;
  if (value.kind === 'atlas') {
    return hasExactKeys(value, ATLAS_PROGRAM_KEYS);
  }
  if (value.kind === 'technique') {
    return hasExactKeys(value, TECHNIQUE_PROGRAM_KEYS) && isTechnique(value.technique);
  }
  return false;
}

function compactUserText(value: unknown): string | null {
  if (value == null) return '';
  if (typeof value !== 'string') return null;
  if (CONTROL_CHARS.test(value)) return null;
  return value.replace(/\s+/g, ' ').trim();
}

function clipUserText(
  value: unknown,
  maximum: number
): { text: string; truncated: boolean } | null {
  const compact = compactUserText(value);
  if (compact == null) return null;
  if (compact.length <= maximum) return { text: compact, truncated: false };
  return { text: compact.slice(0, maximum).trimEnd(), truncated: true };
}

function findChosenDream(
  dreams: readonly LucidDreamRehearsalDream[],
  dreamId: string
): LucidDreamRehearsalDream | null {
  for (const dream of dreams) {
    if (toLucidDreamSignSourceId(dream) === dreamId) return dream;
  }
  return null;
}

function findChosenSign(
  signs: readonly LucidActiveDreamSign[],
  signId: string
): LucidActiveDreamSign | null {
  for (const sign of signs) {
    if (sign?.id === signId) return sign;
  }
  return null;
}

function signLinksExactDream(sign: LucidActiveDreamSign, dreamId: string): boolean {
  return Array.isArray(sign.sourceDreamIds) && sign.sourceDreamIds.includes(dreamId);
}

export function selectLucidDreamRehearsalScene(
  dreams: readonly LucidDreamRehearsalDream[],
  confirmedSigns: readonly LucidActiveDreamSign[],
  dreamId: string,
  signId: string
): LucidDreamRehearsalSelectionResult {
  if (!isDreamId(dreamId) || !findChosenDream(dreams, dreamId)) {
    return { status: 'rejected', reason: 'dream_not_found' };
  }
  if (!isSignId(signId) || !findChosenSign(confirmedSigns, signId)) {
    return { status: 'rejected', reason: 'sign_not_found' };
  }

  const dream = findChosenDream(dreams, dreamId);
  const sign = findChosenSign(confirmedSigns, signId);
  if (!dream || !sign) {
    return { status: 'rejected', reason: 'dream_not_found' };
  }
  if (!signLinksExactDream(sign, dreamId)) {
    return { status: 'rejected', reason: 'sign_not_linked' };
  }

  const title = clipUserText(dream.title, LUCID_DREAM_REHEARSAL_MAX_TITLE_CHARS);
  const excerpt = clipUserText(dream.transcript, LUCID_DREAM_REHEARSAL_MAX_EXCERPT_CHARS);
  const label = clipUserText(sign.label, LUCID_DREAM_REHEARSAL_MAX_LABEL_CHARS);
  if (!title || !excerpt || !label || !isCategory(sign.category)) {
    return { status: 'rejected', reason: 'sign_not_found' };
  }

  return {
    status: 'ready',
    scene: {
      dreamId,
      title: title.text,
      excerpt: excerpt.text,
      excerptTruncated: excerpt.truncated,
      signId,
      signLabel: label.text,
      category: sign.category,
    },
  };
}

function isScene(value: unknown): value is LucidDreamRehearsalScene {
  if (!isPlainObject(value) || !hasExactKeys(value, SCENE_KEYS)) return false;
  if (!isDreamId(value.dreamId) || !isSignId(value.signId)) return false;
  if (typeof value.title !== 'string' || CONTROL_CHARS.test(value.title)) return false;
  if (typeof value.excerpt !== 'string' || CONTROL_CHARS.test(value.excerpt)) return false;
  if (typeof value.signLabel !== 'string' || CONTROL_CHARS.test(value.signLabel)) return false;
  if (value.title.length > LUCID_DREAM_REHEARSAL_MAX_TITLE_CHARS) return false;
  if (value.excerpt.length > LUCID_DREAM_REHEARSAL_MAX_EXCERPT_CHARS) return false;
  if (value.signLabel.length > LUCID_DREAM_REHEARSAL_MAX_LABEL_CHARS) return false;
  if (typeof value.excerptTruncated !== 'boolean') return false;
  return isCategory(value.category);
}

function timestampsAreMonotone(session: {
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  recognizedAt: number | null;
  intentionConfirmedAt: number | null;
  status: LucidDreamRehearsalStatus;
  step: LucidDreamRehearsalActionId;
}): boolean {
  if (session.updatedAt < session.startedAt) return false;
  if (session.recognizedAt != null && session.recognizedAt < session.startedAt) return false;
  if (session.recognizedAt != null && session.recognizedAt > session.updatedAt) return false;
  if (session.intentionConfirmedAt != null && session.recognizedAt == null) return false;
  if (
    session.intentionConfirmedAt != null &&
    session.recognizedAt != null &&
    session.intentionConfirmedAt < session.recognizedAt
  ) {
    return false;
  }
  if (session.intentionConfirmedAt != null && session.intentionConfirmedAt > session.updatedAt) {
    return false;
  }
  if (session.status === 'completed') {
    if (session.completedAt == null) return false;
    if (session.recognizedAt == null || session.intentionConfirmedAt == null) return false;
    if (session.completedAt < session.intentionConfirmedAt) return false;
    if (session.completedAt > session.updatedAt) return false;
  } else if (session.completedAt != null) {
    return false;
  }
  if (session.recognizedAt == null && session.step !== 'recognize_sign') return false;
  if (session.recognizedAt != null && session.step !== 'set_lucid_intention') return false;
  return true;
}

export function isLucidDreamRehearsalSession(
  value: unknown
): value is LucidDreamRehearsalSession {
  if (!isPlainObject(value) || !hasExactKeys(value, SESSION_KEYS)) return false;
  if (value.version !== LUCID_DREAM_REHEARSAL_VERSION) return false;
  if (!isSessionId(value.sessionId)) return false;
  if (!isStatus(value.status) || !isActionId(value.step)) return false;
  if (!isDreamId(value.dreamId) || !isSignId(value.signId)) return false;
  if (typeof value.signLabel !== 'string' || CONTROL_CHARS.test(value.signLabel)) return false;
  if (value.signLabel.length > LUCID_DREAM_REHEARSAL_MAX_LABEL_CHARS) return false;
  if (!isCategory(value.category)) return false;
  if (!isLucidDreamRehearsalSourceProgram(value.sourceProgram)) return false;
  if (!isPresentation(value.presentation)) return false;
  if (!isFiniteTimestamp(value.startedAt) || !isFiniteTimestamp(value.updatedAt)) return false;
  if (!isNullableTimestamp(value.completedAt)) return false;
  if (!isNullableTimestamp(value.recognizedAt)) return false;
  if (!isNullableTimestamp(value.intentionConfirmedAt)) return false;
  return timestampsAreMonotone({
    startedAt: value.startedAt,
    updatedAt: value.updatedAt,
    completedAt: value.completedAt,
    recognizedAt: value.recognizedAt,
    intentionConfirmedAt: value.intentionConfirmedAt,
    status: value.status,
    step: value.step,
  });
}

export function isLucidDreamRehearsalCompletion(
  value: unknown
): value is LucidDreamRehearsalCompletion {
  if (!isPlainObject(value) || !hasExactKeys(value, COMPLETION_KEYS)) return false;
  return (
    value.version === LUCID_DREAM_REHEARSAL_VERSION &&
    isSessionId(value.sessionId) &&
    isDreamId(value.dreamId) &&
    isSignId(value.signId) &&
    isLucidDreamRehearsalSourceProgram(value.sourceProgram) &&
    isFiniteTimestamp(value.completedAt)
  );
}

export function parseLucidDreamRehearsalSession(
  raw: unknown
): LucidDreamRehearsalSession | null {
  if (!isLucidDreamRehearsalSession(raw)) return null;
  return {
    version: raw.version,
    sessionId: raw.sessionId,
    status: raw.status,
    step: raw.step,
    dreamId: raw.dreamId,
    signId: raw.signId,
    signLabel: raw.signLabel,
    category: raw.category,
    sourceProgram: cloneSourceProgram(raw.sourceProgram),
    presentation: raw.presentation,
    startedAt: raw.startedAt,
    completedAt: raw.completedAt,
    updatedAt: raw.updatedAt,
    recognizedAt: raw.recognizedAt,
    intentionConfirmedAt: raw.intentionConfirmedAt,
  };
}

export function parseLucidDreamRehearsalCompletion(
  raw: unknown
): LucidDreamRehearsalCompletion | null {
  if (!isLucidDreamRehearsalCompletion(raw)) return null;
  return {
    version: raw.version,
    sessionId: raw.sessionId,
    dreamId: raw.dreamId,
    signId: raw.signId,
    sourceProgram: cloneSourceProgram(raw.sourceProgram),
    completedAt: raw.completedAt,
  };
}

function assertTimestamp(value: number): void {
  if (!isFiniteTimestamp(value)) {
    throw new Error('Invalid dream rehearsal timestamp');
  }
}

function assertSessionId(value: string): void {
  if (!isSessionId(value)) {
    throw new Error('Invalid dream rehearsal session id');
  }
}

function assertKnownSession(session: LucidDreamRehearsalSession): void {
  if (!isLucidDreamRehearsalSession(session)) {
    throw new Error('Invalid dream rehearsal session');
  }
}

function nextTimestamp(session: LucidDreamRehearsalSession, now: number): number {
  assertTimestamp(now);
  if (now < session.updatedAt) {
    throw new Error('Dream rehearsal timestamp cannot regress');
  }
  const next = now === session.updatedAt ? now + 1 : now;
  assertTimestamp(next);
  return next;
}

function withUpdate(
  session: LucidDreamRehearsalSession,
  now: number,
  patch: Partial<LucidDreamRehearsalSession>
): LucidDreamRehearsalSession {
  const updatedAt = nextTimestamp(session, now);
  const next: LucidDreamRehearsalSession = {
    ...session,
    ...patch,
    sourceProgram: cloneSourceProgram(patch.sourceProgram ?? session.sourceProgram),
    recognizedAt: patch.recognizedAt ?? session.recognizedAt,
    intentionConfirmedAt: patch.intentionConfirmedAt ?? session.intentionConfirmedAt,
    completedAt: patch.completedAt === undefined ? session.completedAt : patch.completedAt,
    updatedAt,
  };
  if (!isLucidDreamRehearsalSession(next)) {
    throw new Error('Invalid dream rehearsal session');
  }
  return next;
}

export function createLucidDreamRehearsalSessionId(now: number, entropy: string): string {
  assertTimestamp(now);
  const cleaned = String(entropy).replace(/[^A-Za-z0-9_-]/g, '');
  const sessionId = `rehearse_${now.toString(36)}_${cleaned || 'x'}`.slice(
    0,
    LUCID_DREAM_REHEARSAL_MAX_SESSION_ID_CHARS
  );
  assertSessionId(sessionId);
  return sessionId;
}

export function createLucidDreamRehearsalSession(params: {
  scene: LucidDreamRehearsalScene;
  sessionId: string;
  sourceProgram: LucidDreamRehearsalSourceProgram;
  presentation: LucidDreamRehearsalPresentation;
  now: number;
}): LucidDreamRehearsalSession {
  assertTimestamp(params.now);
  assertSessionId(params.sessionId);
  if (!isScene(params.scene)) {
    throw new Error('Invalid dream rehearsal scene');
  }
  if (!isLucidDreamRehearsalSourceProgram(params.sourceProgram)) {
    throw new Error('Invalid dream rehearsal source program');
  }
  if (!isPresentation(params.presentation)) {
    throw new Error('Invalid dream rehearsal presentation');
  }
  return {
    version: LUCID_DREAM_REHEARSAL_VERSION,
    sessionId: params.sessionId,
    status: 'active',
    step: 'recognize_sign',
    dreamId: params.scene.dreamId,
    signId: params.scene.signId,
    signLabel: params.scene.signLabel,
    category: params.scene.category,
    sourceProgram: cloneSourceProgram(params.sourceProgram),
    presentation: params.presentation,
    startedAt: params.now,
    completedAt: null,
    updatedAt: params.now,
    recognizedAt: null,
    intentionConfirmedAt: null,
  };
}

export function recognizeLucidDreamRehearsalSign(
  session: LucidDreamRehearsalSession,
  signId: string,
  now: number
): LucidDreamRehearsalSession {
  assertKnownSession(session);
  if (signId !== session.signId) {
    throw new Error('Recognition must target the chosen sign');
  }
  if (session.status === 'completed') {
    throw new Error('A completed dream rehearsal cannot recognize a sign');
  }
  if (session.status !== 'active') {
    throw new Error('Only an active dream rehearsal can recognize a sign');
  }
  if (session.recognizedAt != null) return session;
  const recognizedAt = nextTimestamp(session, now);
  return {
    ...session,
    step: 'set_lucid_intention',
    recognizedAt,
    sourceProgram: cloneSourceProgram(session.sourceProgram),
    updatedAt: recognizedAt,
  };
}

export function confirmLucidDreamRehearsalIntention(
  session: LucidDreamRehearsalSession,
  now: number
): LucidDreamRehearsalSession {
  assertKnownSession(session);
  if (session.status === 'completed') {
    throw new Error('A completed dream rehearsal cannot confirm intention');
  }
  if (session.status !== 'active') {
    throw new Error('Only an active dream rehearsal can confirm intention');
  }
  if (session.recognizedAt == null) {
    throw new Error('Dream rehearsal sign must be recognized before intention');
  }
  if (session.intentionConfirmedAt != null) return session;
  const intentionConfirmedAt = nextTimestamp(session, now);
  return {
    ...session,
    step: 'set_lucid_intention',
    intentionConfirmedAt,
    sourceProgram: cloneSourceProgram(session.sourceProgram),
    updatedAt: intentionConfirmedAt,
  };
}

export function interruptLucidDreamRehearsalSession(
  session: LucidDreamRehearsalSession,
  now: number
): LucidDreamRehearsalSession {
  assertKnownSession(session);
  if (session.status === 'completed') {
    throw new Error('A completed dream rehearsal cannot be interrupted');
  }
  if (session.status === 'interrupted') return session;
  return withUpdate(session, now, { status: 'interrupted' });
}

export function resumeLucidDreamRehearsalSession(
  session: LucidDreamRehearsalSession,
  now: number
): LucidDreamRehearsalSession {
  assertKnownSession(session);
  if (session.status === 'completed') {
    throw new Error('A completed dream rehearsal cannot resume');
  }
  if (session.status === 'active') return session;
  return withUpdate(session, now, { status: 'active' });
}

export function completeLucidDreamRehearsalSession(
  session: LucidDreamRehearsalSession,
  now: number
): LucidDreamRehearsalSession {
  assertKnownSession(session);
  if (session.status === 'completed') return session;
  if (session.status !== 'active') {
    throw new Error('Only an active dream rehearsal can complete');
  }
  if (session.recognizedAt == null || session.intentionConfirmedAt == null) {
    throw new Error('Dream rehearsal cannot complete before both actions');
  }
  const completedAt = nextTimestamp(session, now);
  return {
    ...session,
    status: 'completed',
    completedAt,
    sourceProgram: cloneSourceProgram(session.sourceProgram),
    updatedAt: completedAt,
  };
}

export function getLucidDreamRehearsalCurrentAction(
  session: LucidDreamRehearsalSession
): LucidDreamRehearsalActionId {
  assertKnownSession(session);
  return session.step;
}

export function getLucidDreamRehearsalProgress(
  session: LucidDreamRehearsalSession
): LucidDreamRehearsalProgress {
  assertKnownSession(session);
  const recognized = session.recognizedAt != null;
  const intentionConfirmed = session.intentionConfirmedAt != null;
  const completedActionCount = ((recognized ? 1 : 0) + (intentionConfirmed ? 1 : 0)) as 0 | 1 | 2;
  return {
    currentAction: session.step,
    completedActionCount,
    totalActionCount: 2,
    recognized,
    intentionConfirmed,
    canComplete: session.status === 'active' && recognized && intentionConfirmed,
  };
}

export function getLucidDreamRehearsalCausalFeedback(
  session: LucidDreamRehearsalSession
): readonly string[] {
  assertKnownSession(session);
  const ids: string[] = [];
  if (session.recognizedAt != null) ids.push('lucid_dream_rehearsal_sign_recognized');
  if (session.intentionConfirmedAt != null) {
    ids.push('lucid_dream_rehearsal_intention_confirmed');
  }
  if (session.status === 'interrupted') ids.push('lucid_dream_rehearsal_interrupted');
  if (session.status === 'completed') ids.push('lucid_dream_rehearsal_completed');
  if (session.status === 'active' && session.recognizedAt == null) {
    ids.push('lucid_dream_rehearsal_awaiting_recognize_sign');
  } else if (session.status === 'active' && session.intentionConfirmedAt == null) {
    ids.push('lucid_dream_rehearsal_awaiting_set_lucid_intention');
  } else if (session.status === 'active') {
    ids.push('lucid_dream_rehearsal_ready_to_complete');
  }
  return ids;
}

export function getLucidDreamRehearsalTextAlternativeIds(): readonly string[] {
  return LUCID_DREAM_REHEARSAL_TEXT_ALTERNATIVE_IDS;
}

export function getLucidDreamRehearsalRedundantCues(
  session: LucidDreamRehearsalSession
): LucidDreamRehearsalCues {
  assertKnownSession(session);
  if (session.recognizedAt == null) {
    return { soundCueId: null, hapticCueId: null };
  }
  return {
    soundCueId: LUCID_DREAM_REHEARSAL_SOUND_CUE_ID,
    hapticCueId: LUCID_DREAM_REHEARSAL_HAPTIC_CUE_ID,
  };
}

export function projectLucidDreamRehearsalCompletion(
  session: LucidDreamRehearsalSession
): LucidDreamRehearsalCompletion | null {
  assertKnownSession(session);
  if (session.status !== 'completed' || session.completedAt == null) return null;
  return {
    version: LUCID_DREAM_REHEARSAL_VERSION,
    sessionId: session.sessionId,
    dreamId: session.dreamId,
    signId: session.signId,
    sourceProgram: cloneSourceProgram(session.sourceProgram),
    completedAt: session.completedAt,
  };
}
