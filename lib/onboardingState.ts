import type { Href } from 'expo-router';

import { logger } from '@/lib/logger';
import {
  getFirstLaunchCompleted,
  getOnboardingGuestClaimedBy,
  getOnboardingStateSnapshot,
  saveOnboardingGuestClaimedBy,
  saveOnboardingStateSnapshot,
} from '@/services/storageService';

export const ONBOARDING_SCHEMA_VERSION = 1 as const;
export const ONBOARDING_EXPERIENCE_VERSION = 2 as const;
export const ONBOARDING_INTENT_TTL_MS = 24 * 60 * 60 * 1000;

export type OnboardingScope = 'guest' | `user:${string}`;
export type OnboardingStep = 'intro' | 'path';
export type OnboardingPath = 'analyze' | 'memory' | 'dictionary';
export type PendingRecordingPhase =
  | 'capture'
  | 'analysis_confirmation'
  | 'analysis_requested';

export type PendingRecordingIntent = {
  entryId: string;
  intent: 'fresh' | 'remembered';
  source: 'onboarding';
  postSave: 'confirm_analysis' | 'journal_first';
  phase: PendingRecordingPhase;
  savedDreamId?: number;
  createdAt: number;
  expiresAt: number;
};

export type OnboardingState = {
  schemaVersion: typeof ONBOARDING_SCHEMA_VERSION;
  experienceVersion: typeof ONBOARDING_EXPERIENCE_VERSION;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  step: OnboardingStep | null;
  selectedPath: OnboardingPath | null;
  completionReason: OnboardingPath | 'skip' | null;
  pendingRecordingIntent: PendingRecordingIntent | null;
  startedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
};

export type PendingAnalysisRestartAction = 'none' | 'view_result' | 'offer_retry';

export type OnboardingEvent =
  | { type: 'START' }
  | { type: 'GO_TO_STEP'; step: OnboardingStep }
  | { type: 'SELECT_PATH'; path: OnboardingPath }
  | { type: 'COMPLETE'; path?: OnboardingPath }
  | { type: 'SKIP' }
  | {
      type: 'SET_PENDING_PHASE';
      phase: PendingRecordingPhase;
      savedDreamId?: number;
    }
  | { type: 'CLEAR_PENDING_INTENT' };

export type RecordingRouteParams = {
  entryId?: string | string[];
  intent?: 'fresh' | 'remembered' | string | string[];
  source?: 'onboarding' | 'journal' | 'profile' | string | string[];
  postSave?: 'analyze' | 'journal' | string | string[];
  replayGuide?: '1' | string | string[];
  next?: 'analyze' | string | string[];
  mode?: 'text' | 'voice' | string | string[];
};

export type ParsedRecordingIntent = {
  entryId: string | null;
  intent: 'fresh' | 'remembered' | null;
  source: 'onboarding' | 'journal' | 'profile' | null;
  postSave: 'confirm_analysis' | 'journal_first' | null;
  replayGuide: boolean;
  mode: 'text' | 'voice' | null;
  hasExplicitIntent: boolean;
};

export type ResolvedRecordingEntryIntent = {
  entryId: string;
  intent: 'fresh' | 'remembered' | null;
  source: 'onboarding' | 'journal' | 'profile' | null;
  postSave: 'confirm_analysis' | 'journal_first' | null;
  mode: 'text' | 'voice' | null;
  origin: 'route' | 'pending';
};

export type StartupDestinationInput = {
  returningGuestBlocked: boolean;
  hasUser: boolean;
  onboardingState: OnboardingState;
  pendingNotificationUrl?: '/recording' | null;
  defaultDestination?: Href;
};

export type StartupDestinationReason =
  | 'returning_guest_blocked'
  | 'onboarding'
  | 'pending_intent'
  | 'notification'
  | 'default';

export type StartupDestinationDecision = {
  destination: Href;
  reason: StartupDestinationReason;
};

const scopeLocks = new Map<string, Promise<void>>();
let claimLock: Promise<void> = Promise.resolve();

type OnboardingNormalizationCode =
  | 'invalid_snapshot'
  | 'invalid_json'
  | 'unsupported_schema'
  | 'unsupported_experience'
  | 'invalid_status'
  | 'invalid_invariant';

const reportNormalization = (code: OnboardingNormalizationCode): void => {
  logger.warn('[OnboardingState]', {
    event: 'onboarding_state_normalized',
    code,
  });
};

function createDefaultState(now = Date.now()): OnboardingState {
  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    experienceVersion: ONBOARDING_EXPERIENCE_VERSION,
    status: 'not_started',
    step: null,
    selectedPath: null,
    completionReason: null,
    pendingRecordingIntent: null,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  };
}

export function getDefaultOnboardingState(now = Date.now()): OnboardingState {
  return createDefaultState(now);
}

const isFiniteTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const normalizePath = (value: unknown): OnboardingPath | null => {
  if (value === 'library') return 'dictionary';
  return value === 'analyze' || value === 'memory' || value === 'dictionary' ? value : null;
};

type PendingIntentNormalization =
  | { intent: PendingRecordingIntent; invalid: false }
  | { intent: null; invalid: false }
  | { intent: null; invalid: true };

const normalizePendingIntent = (
  value: unknown,
  now: number
): PendingIntentNormalization => {
  if (value == null) return { intent: null, invalid: false };
  if (typeof value !== 'object') return { intent: null, invalid: true };
  const candidate = value as Partial<PendingRecordingIntent>;
  if (
    typeof candidate.entryId !== 'string' ||
    candidate.entryId.length === 0 ||
    (candidate.intent !== 'fresh' && candidate.intent !== 'remembered') ||
    candidate.source !== 'onboarding' ||
    (candidate.postSave !== 'confirm_analysis' && candidate.postSave !== 'journal_first') ||
    (candidate.phase !== 'capture' &&
      candidate.phase !== 'analysis_confirmation' &&
      candidate.phase !== 'analysis_requested') ||
    !isFiniteTimestamp(candidate.createdAt) ||
    !isFiniteTimestamp(candidate.expiresAt)
  ) {
    return { intent: null, invalid: true };
  }

  if (candidate.expiresAt <= now) {
    return { intent: null, invalid: false };
  }

  const savedDreamId =
    typeof candidate.savedDreamId === 'number' && Number.isFinite(candidate.savedDreamId)
      ? candidate.savedDreamId
      : undefined;

  const matchesPath =
    (candidate.intent === 'fresh' && candidate.postSave === 'confirm_analysis') ||
    (candidate.intent === 'remembered' && candidate.postSave === 'journal_first');
  const postSavePhaseIsValid =
    candidate.phase === 'capture' ||
    (candidate.postSave === 'confirm_analysis' && savedDreamId !== undefined);
  if (!matchesPath || !postSavePhaseIsValid) {
    return { intent: null, invalid: true };
  }

  return {
    invalid: false,
    intent: {
      entryId: candidate.entryId,
      intent: candidate.intent,
      source: 'onboarding',
      postSave: candidate.postSave,
      phase: candidate.phase,
      ...(savedDreamId !== undefined ? { savedDreamId } : {}),
      createdAt: candidate.createdAt,
      expiresAt: candidate.expiresAt,
    },
  };
};

function normalizeOnboardingState(value: unknown, now = Date.now()): OnboardingState {
  if (!value || typeof value !== 'object') {
    reportNormalization('invalid_snapshot');
    return createDefaultState(now);
  }

  const candidate = value as Partial<OnboardingState> & {
    selectedPath?: unknown;
    completionReason?: unknown;
  };
  if (candidate.schemaVersion !== ONBOARDING_SCHEMA_VERSION) {
    reportNormalization('unsupported_schema');
    return createDefaultState(now);
  }
  if (candidate.experienceVersion !== ONBOARDING_EXPERIENCE_VERSION) {
    reportNormalization('unsupported_experience');
    return createDefaultState(now);
  }
  if (
    candidate.status !== 'not_started' &&
    candidate.status !== 'in_progress' &&
    candidate.status !== 'completed' &&
    candidate.status !== 'skipped'
  ) {
    reportNormalization('invalid_status');
    return createDefaultState(now);
  }
  const status = candidate.status;
  const selectedPath = normalizePath(candidate.selectedPath);
  const normalizedReason = normalizePath(candidate.completionReason);
  const completionReason =
    candidate.completionReason === 'skip' ? 'skip' : normalizedReason;
  const step = candidate.step === 'intro' || candidate.step === 'path' ? candidate.step : null;
  const terminal = status === 'completed' || status === 'skipped';
  const completedAt = isFiniteTimestamp(candidate.completedAt) ? candidate.completedAt : null;
  const pending = normalizePendingIntent(candidate.pendingRecordingIntent, now);

  const completedInvariantValid =
    status !== 'completed' ||
    (selectedPath !== null &&
      completionReason === selectedPath &&
      completedAt !== null &&
      !(selectedPath === 'dictionary' && candidate.pendingRecordingIntent != null) &&
      (!pending.intent ||
        (selectedPath === 'analyze'
          ? pending.intent.postSave === 'confirm_analysis'
          : selectedPath === 'memory' && pending.intent.postSave === 'journal_first')));
  const skippedInvariantValid =
    status !== 'skipped' ||
    (completionReason === 'skip' && completedAt !== null && candidate.pendingRecordingIntent == null);
  const activeInvariantValid =
    terminal ||
    (candidate.completionReason == null &&
      candidate.completedAt == null &&
      candidate.pendingRecordingIntent == null);

  if (pending.invalid || !completedInvariantValid || !skippedInvariantValid || !activeInvariantValid) {
    reportNormalization('invalid_invariant');
    return createDefaultState(now);
  }

  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    experienceVersion: ONBOARDING_EXPERIENCE_VERSION,
    status,
    step: terminal ? null : step,
    selectedPath,
    completionReason: terminal ? completionReason : null,
    pendingRecordingIntent: pending.intent,
    startedAt: isFiniteTimestamp(candidate.startedAt) ? candidate.startedAt : null,
    completedAt: terminal ? completedAt : null,
    updatedAt: isFiniteTimestamp(candidate.updatedAt) ? candidate.updatedAt : now,
  };
}

const serializeState = (state: OnboardingState): string => JSON.stringify(state);

async function readSnapshot(scope: OnboardingScope): Promise<{
  state: OnboardingState;
  shouldPersist: boolean;
}> {
  const serialized = await getOnboardingStateSnapshot(scope);
  const now = Date.now();

  if (serialized) {
    try {
      const parsed = JSON.parse(serialized) as unknown;
      const state = normalizeOnboardingState(parsed, now);
      return { state, shouldPersist: serializeState(state) !== serialized };
    } catch {
      reportNormalization('invalid_json');
      return { state: createDefaultState(now), shouldPersist: true };
    }
  }

  if (scope === 'guest' && (await getFirstLaunchCompleted())) {
    return {
      state: {
        ...createDefaultState(now),
        status: 'skipped',
        completionReason: 'skip',
        completedAt: now,
      },
      shouldPersist: true,
    };
  }

  return { state: createDefaultState(now), shouldPersist: true };
}

export async function getOnboardingState(scope: OnboardingScope): Promise<OnboardingState> {
  const { state, shouldPersist } = await readSnapshot(scope);
  if (shouldPersist) {
    await saveOnboardingStateSnapshot(scope, serializeState(state));
  }
  return state;
}

function createEntryId(now: number): string {
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `onboarding-${now.toString(36)}-${randomPart}`;
}

function createPendingIntent(path: 'analyze' | 'memory', now: number): PendingRecordingIntent {
  return {
    entryId: createEntryId(now),
    intent: path === 'memory' ? 'remembered' : 'fresh',
    source: 'onboarding',
    postSave: path === 'memory' ? 'journal_first' : 'confirm_analysis',
    phase: 'capture',
    createdAt: now,
    expiresAt: now + ONBOARDING_INTENT_TTL_MS,
  };
}

export function reduceOnboardingState(
  current: OnboardingState,
  event: OnboardingEvent,
  now = Date.now()
): OnboardingState {
  switch (event.type) {
    case 'START':
      return {
        ...current,
        status: 'in_progress',
        step: current.step ?? 'intro',
        startedAt: current.startedAt ?? now,
        completedAt: null,
        completionReason: null,
        pendingRecordingIntent: null,
        updatedAt: now,
      };
    case 'GO_TO_STEP':
      return {
        ...current,
        status: 'in_progress',
        step: event.step,
        selectedPath:
          event.step === 'path' ? current.selectedPath ?? 'analyze' : current.selectedPath,
        startedAt: current.startedAt ?? now,
        completedAt: null,
        completionReason: null,
        pendingRecordingIntent: null,
        updatedAt: now,
      };
    case 'SELECT_PATH':
      return {
        ...current,
        status: 'in_progress',
        step: 'path',
        selectedPath: event.path,
        startedAt: current.startedAt ?? now,
        completedAt: null,
        completionReason: null,
        pendingRecordingIntent: null,
        updatedAt: now,
      };
    case 'COMPLETE': {
      const path = event.path ?? current.selectedPath ?? 'analyze';
      return {
        ...current,
        status: 'completed',
        step: null,
        selectedPath: path,
        completionReason: path,
        pendingRecordingIntent:
          path === 'dictionary' ? null : createPendingIntent(path, now),
        startedAt: current.startedAt ?? now,
        completedAt: now,
        updatedAt: now,
      };
    }
    case 'SKIP':
      return {
        ...current,
        status: 'skipped',
        step: null,
        completionReason: 'skip',
        pendingRecordingIntent: null,
        startedAt: current.startedAt ?? now,
        completedAt: now,
        updatedAt: now,
      };
    case 'SET_PENDING_PHASE':
      if (!current.pendingRecordingIntent) return current;
      if (
        event.phase !== 'capture' &&
        (current.pendingRecordingIntent.postSave !== 'confirm_analysis' ||
          (event.savedDreamId === undefined &&
            current.pendingRecordingIntent.savedDreamId === undefined))
      ) {
        return current;
      }
      return {
        ...current,
        pendingRecordingIntent: {
          ...current.pendingRecordingIntent,
          phase: event.phase,
          ...(event.savedDreamId !== undefined
            ? { savedDreamId: event.savedDreamId }
            : {}),
        },
        updatedAt: now,
      };
    case 'CLEAR_PENDING_INTENT':
      if (!current.pendingRecordingIntent) return current;
      return { ...current, pendingRecordingIntent: null, updatedAt: now };
  }
}

function withScopeLock<T>(scope: OnboardingScope, operation: () => Promise<T>): Promise<T> {
  const previous = scopeLocks.get(scope) ?? Promise.resolve();
  const run = previous.then(operation, operation);
  scopeLocks.set(
    scope,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}

export function transitionOnboarding(
  scope: OnboardingScope,
  event: OnboardingEvent
): Promise<OnboardingState> {
  return withScopeLock(scope, async () => {
    const current = await getOnboardingState(scope);
    const next = reduceOnboardingState(current, event);
    if (next !== current) {
      await saveOnboardingStateSnapshot(scope, serializeState(next));
    }
    return next;
  });
}

export function claimGuestOnboardingState(userId: string): Promise<void> {
  if (!userId) return Promise.resolve();

  const run = claimLock.then(async () => {
    const claimedBy = await getOnboardingGuestClaimedBy();
    if (claimedBy && claimedBy !== userId) return;

    if (!claimedBy) {
      // Reserve ownership before copying. If copying fails, the same user can
      // resume later while every other account remains isolated.
      await saveOnboardingGuestClaimedBy(userId);
    }

    const userScope = `user:${userId}` as const;
    const existingUserSnapshot = await getOnboardingStateSnapshot(userScope);
    if (!existingUserSnapshot) {
      const guestState = await getOnboardingState('guest');
      await saveOnboardingStateSnapshot(userScope, serializeState(guestState));
    }
  });

  claimLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export function parseRecordingRouteParams(params: RecordingRouteParams): ParsedRecordingIntent {
  const rawIntent = firstParam(params.intent);
  const rawSource = firstParam(params.source);
  const rawPostSave = firstParam(params.postSave);
  const rawNext = firstParam(params.next);
  const rawMode = firstParam(params.mode);
  const rawEntryId = firstParam(params.entryId);

  const intent = rawIntent === 'fresh' || rawIntent === 'remembered' ? rawIntent : null;
  const source =
    rawSource === 'onboarding' || rawSource === 'journal' || rawSource === 'profile'
      ? rawSource
      : null;
  const postSave =
    rawPostSave === 'analyze'
      ? 'confirm_analysis'
      : rawPostSave === 'journal'
        ? 'journal_first'
        : rawNext === 'analyze'
          ? 'confirm_analysis'
          : null;
  const entryId = rawEntryId && rawEntryId.trim().length > 0 ? rawEntryId.trim() : null;

  return {
    entryId,
    intent,
    source,
    postSave,
    replayGuide: firstParam(params.replayGuide) === '1',
    mode: rawMode === 'text' || rawMode === 'voice' ? rawMode : null,
    hasExplicitIntent: Boolean(intent || source || postSave || entryId),
  };
}

/**
 * Selects the capture entry that should be applied by the recording screen.
 * A recognized route intent represents an intentional navigation and therefore
 * wins over a stale pending onboarding capture. A naked `/recording` route can
 * still resume a pending capture, including its post-save destination.
 */
export function resolveRecordingEntryIntent(
  route: ParsedRecordingIntent,
  pending: PendingRecordingIntent | null
): ResolvedRecordingEntryIntent | null {
  const hasValidExplicitRouteIntent = Boolean(
    route.intent || route.source || route.postSave
  );

  if (hasValidExplicitRouteIntent) {
    const entryId = route.entryId
      ?? `route:${route.intent ?? 'none'}:${route.source ?? 'none'}:${route.postSave ?? 'none'}`;
    return {
      entryId,
      intent: route.intent,
      source: route.source,
      postSave: route.postSave,
      mode: route.mode,
      origin: 'route',
    };
  }

  if (pending?.phase !== 'capture') return null;

  return {
    entryId: pending.entryId,
    intent: pending.intent,
    source: pending.source,
    postSave: pending.postSave,
    // A valid explicit mode remains higher priority than the scoped preference,
    // even when the rest of the capture intent comes from persisted state.
    mode: route.mode,
    origin: 'pending',
  };
}

export function isOnboardingTerminal(state: OnboardingState): boolean {
  return state.status === 'completed' || state.status === 'skipped';
}

export function resolvePendingAnalysisRestart(
  pending: PendingRecordingIntent | null,
  dream: {
    id: number;
    analysisStatus?: 'none' | 'pending' | 'done' | 'failed';
    isAnalyzed?: boolean;
  } | null
): PendingAnalysisRestartAction {
  if (
    !pending
    || pending.phase !== 'analysis_requested'
    || pending.savedDreamId === undefined
    || !dream
    || dream.id !== pending.savedDreamId
  ) {
    return 'none';
  }

  if (dream.analysisStatus === 'done' || dream.isAnalyzed) {
    return 'view_result';
  }

  return 'offer_retry';
}

function pendingIntentDestination(intent: PendingRecordingIntent): Href {
  return {
    pathname: '/recording',
    params: {
      entryId: intent.entryId,
      intent: intent.intent,
      source: intent.source,
      postSave: intent.postSave === 'confirm_analysis' ? 'analyze' : 'journal',
    },
  } as Href;
}

export function resolveStartupDecision(
  input: StartupDestinationInput
): StartupDestinationDecision {
  if (input.returningGuestBlocked && !input.hasUser) {
    return { destination: '/(tabs)/settings', reason: 'returning_guest_blocked' };
  }
  if (!isOnboardingTerminal(input.onboardingState)) {
    return { destination: '/onboarding', reason: 'onboarding' };
  }
  if (input.onboardingState.pendingRecordingIntent) {
    return {
      destination: pendingIntentDestination(input.onboardingState.pendingRecordingIntent),
      reason: 'pending_intent',
    };
  }
  if (input.pendingNotificationUrl === '/recording') {
    return { destination: '/recording', reason: 'notification' };
  }
  return { destination: input.defaultDestination ?? '/recording', reason: 'default' };
}

export function resolveStartupDestination(input: StartupDestinationInput): Href {
  return resolveStartupDecision(input).destination;
}

const hrefPathname = (href: Href): string =>
  typeof href === 'string' ? href.split('?')[0] : String(href.pathname);

const normalizeObservedPath = (pathname: string): string =>
  pathname.replace(/^\/\(tabs\)(?=\/|$)/, '') || '/';

export function isStartupDestinationObserved(
  destination: Href | null,
  pathname: string | null | undefined
): boolean {
  if (!destination || !pathname) return false;
  return normalizeObservedPath(hrefPathname(destination)) === normalizeObservedPath(pathname);
}
