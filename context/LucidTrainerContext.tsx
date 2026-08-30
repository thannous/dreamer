import * as Crypto from 'expo-crypto';
import { getLocales } from 'expo-localization';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useDreamsData } from '@/context/DreamsContext';
import { trackProductEvent } from '@/lib/analytics';
import { isLucidTrainer } from '@/lib/appVariant';
import {
  activateExclusiveLucidProgram,
  applyLucidProgramProgress,
  applyLucidSyncEntity,
  canonicalLucidJson,
  createLucidProgramProgress,
  diffLucidProgramProgress,
  getLucidSyncEntities,
  type LucidTrainerState,
} from '@/lib/lucid/domain';
import { getLucidContent, normalizeLucidLocale, type LucidTrainerContent } from '@/lib/lucid/content';
import {
  getLucidDateKeyInTimeZone,
  resolvePreviousNightTechniqueLink,
} from '@/lib/lucid/morningCapture';
import {
  extractLucidDreamSignCandidates,
  getActiveLucidDreamSigns,
  reconcileLucidDreamSignDecisions,
  type LucidActiveDreamSign,
  type LucidDreamSignCandidate,
} from '@/lib/lucid/dreamSigns';
import {
  LUCID_DREAM_ATLAS_PRISTINE_UPDATED_AT,
  areLucidDreamAtlasPreferencesSemanticallyEqual,
  buildLucidDreamAtlas,
  createEmptyLucidDreamAtlasOverlay,
  lucidDreamAtlasOverlayPreferences,
  normalizeLucidDreamAtlasPreferences,
  type LucidDreamAtlasPreferences,
} from '@/lib/lucid/dreamAtlas';
import {
  abandonLucidGuidedRitualProgress,
  advanceLucidGuidedRitualProgress,
  completeLucidGuidedRitualProgress,
  createLucidGuidedRitualPlan,
  createLucidGuidedRitualProgress,
  resumeLucidGuidedRitualProgress,
} from '@/lib/lucid/guidedRitual';
import {
  isLucidExperiment,
  isLucidPersistedDreamSignDecision,
  isLucidRealityCheck,
  type LucidDreamCaptureMode,
  type LucidDreamSignDecision,
  type LucidExperiment,
  type LucidExperimentResult,
  type LucidGuidedRitualProgress,
  type LucidGuidedRitualTechnique,
  type LucidNightCueOutcome,
  type LucidOnboardingDraftStep,
  type LucidOnboardingState,
  type LucidPersonalFactor,
  type LucidPersistedDreamSignDecision,
  type LucidProgramProgress,
  type LucidRealityCheck,
  type LucidSleepSchedule,
  type LucidSyncEntity,
  type LucidTechnique,
  type LucidTrainerPreferences,
  type LucidVoiceCaptureState,
  type LucidWakeSensitivity,
  type LucidWeeklyReview,
} from '@/lib/lucid/model';
import { buildLucidReminderPlan } from '@/lib/lucid/reminders';
import {
  evaluateLucidSafetyPolicyFromState,
  evaluateLucidSessionAccess,
  getLucidWbtbDenialReason,
} from '@/lib/lucid/safety';
import { resetLucidOnboardingCompletionNavigationClaim } from '@/lib/lucid/routes';
import { setProductAnalyticsEnabled } from '@/lib/productAnalytics';
import { reconcileLucidTrainerReminders } from '@/services/lucidTrainerNotifications';
import {
  createLucidTrainerMutation,
  claimLucidTrainerGuestScope,
  hasLucidTrainerGuestData,
  pullLucidTrainerRemoteState,
  queueLucidTrainerMutation,
  replayLucidTrainerQueue,
  type LucidSyncReplayResult,
} from '@/services/lucidTrainerSync';
import {
  claimLucidMorningVoiceNoteScope,
  unlinkLucidMorningVoiceNotesFromExperiment,
} from '@/services/lucidMorningVoiceNoteStorage';
import {
  clearLucidTrainerLocalData,
  getLucidTrainerState,
  loadLucidTrainerState,
  loadLucidTrainerSyncQueue,
  updateLucidTrainerState,
  updateLucidTrainerSyncQueue,
} from '@/services/lucidTrainerStorage';

export type LucidSyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error';

type CompleteOnboardingInput = Pick<
  LucidOnboardingState,
  | 'weeklyTarget'
  | 'sleepSchedule'
  | 'notificationsPermission'
  | 'notificationsExplained'
  | 'audioSafetyAccepted'
  | 'analyticsConsent'
  | 'accessibility'
> &
  Pick<LucidTrainerPreferences, 'cloudSyncEnabled' | 'noctaliaLinkEnabled'> & {
    goal: NonNullable<LucidOnboardingState['goal']>;
    experience: NonNullable<LucidOnboardingState['experience']>;
    wakeSensitivity: LucidWakeSensitivity;
    sleepScheduleConfirmed: true;
  };

export type LucidOnboardingDraftPatch = {
  goal?: LucidOnboardingState['goal'];
  experience?: LucidOnboardingState['experience'];
  wakeSensitivity?: LucidWakeSensitivity | null;
  sleepSchedule?: LucidSleepSchedule;
  sleepScheduleDraft?: LucidOnboardingState['sleepScheduleDraft'];
  sleepScheduleConfirmed?: boolean;
  draftStep?: LucidOnboardingDraftStep;
};

function requireCompleteOnboardingAnswers(
  onboarding: LucidOnboardingState
): asserts onboarding is LucidOnboardingState & {
  goal: NonNullable<LucidOnboardingState['goal']>;
  experience: NonNullable<LucidOnboardingState['experience']>;
  wakeSensitivity: LucidWakeSensitivity;
  sleepScheduleConfirmed: true;
} {
  const missing: string[] = [];
  if (!onboarding.goal) missing.push('goal');
  if (!onboarding.experience) missing.push('experience');
  if (!onboarding.wakeSensitivity) missing.push('wakeSensitivity');
  if (onboarding.sleepScheduleConfirmed !== true) missing.push('sleepScheduleConfirmed');
  if (missing.length > 0) {
    throw new Error(`Lucid onboarding is incomplete: ${missing.join(', ')}`);
  }
}

export type LucidExperimentInput = {
  technique: LucidTechnique | null;
  preparationMinutes: number | null;
  result: LucidExperimentResult | null;
  lucidityLevel: number | null;
  recallLevel: number | null;
  sleepQuality: number | null;
  factors: LucidPersonalFactor[];
  notes?: string;
  captureMode: LucidDreamCaptureMode;
  recallText?: string;
  cueOutcome: LucidNightCueOutcome;
  voiceCapture?: LucidVoiceCaptureState;
};

export type LucidDreamSignDecisionInput = {
  id: string;
  decision: LucidDreamSignDecision;
  customLabel?: string | null;
  sourceDreamIds: string[];
};

type RealityCheckInput = Omit<LucidRealityCheck, 'id' | 'occurredAt' | 'updatedAt'>;

export type LucidGuidedRitualMutationInput = {
  technique: LucidGuidedRitualTechnique;
  exerciseId: string;
  sessionNumber: number;
  sessionCount: number;
  action: 'start' | 'advance' | 'abandon' | 'resume';
};

export type LucidTrainerContextValue = {
  state: LucidTrainerState | null;
  content: LucidTrainerContent;
  loading: boolean;
  error: string | null;
  userScope: string;
  syncStatus: LucidSyncStatus;
  lastSyncResult: LucidSyncReplayResult | null;
  guestImportAvailable: boolean;
  dreamSignCandidates: LucidDreamSignCandidate[];
  activeDreamSigns: LucidActiveDreamSign[];
  importGuestData: () => Promise<void>;
  saveOnboardingDraft: (patch: LucidOnboardingDraftPatch) => Promise<void>;
  completeOnboarding: (input: CompleteOnboardingInput) => Promise<void>;
  updateAnalyticsConsent: (enabled: boolean) => Promise<void>;
  updateAudioSafetyConsent: (enabled: boolean) => Promise<void>;
  updatePreferences: (patch: Partial<LucidTrainerPreferences>) => Promise<void>;
  updateDreamAtlasPreferences: (
    updater: (current: LucidDreamAtlasPreferences) => LucidDreamAtlasPreferences
  ) => Promise<LucidDreamAtlasPreferences>;
  clearDreamAtlasPreferences: () => Promise<void>;
  startProgram: (technique: LucidTechnique) => Promise<void>;
  completeProgramSession: (technique: LucidTechnique, exerciseId: string, sessionNumber: number, sessionCount: number) => Promise<void>;
  updateGuidedRitual: (
    input: LucidGuidedRitualMutationInput
  ) => Promise<LucidGuidedRitualProgress>;
  completeGuidedRitualSession: (
    technique: LucidGuidedRitualTechnique,
    exerciseId: string,
    sessionNumber: number,
    sessionCount: number
  ) => Promise<void>;
  pauseProgram: (technique: LucidTechnique) => Promise<void>;
  addExperiment: (input: LucidExperimentInput) => Promise<LucidExperiment>;
  addRealityCheck: (input: RealityCheckInput) => Promise<LucidRealityCheck>;
  saveDreamSignDecision: (input: LucidDreamSignDecisionInput) => Promise<void>;
  saveWeeklyReview: (input: Omit<LucidWeeklyReview, 'id' | 'completedAt' | 'updatedAt'>) => Promise<void>;
  clearExperimentVoiceCapture: (id: string) => Promise<void>;
  deleteExperiment: (id: string) => Promise<void>;
  syncNow: () => Promise<LucidSyncReplayResult | null>;
  resetLocalData: () => Promise<void>;
  reload: () => Promise<void>;
};

const LucidTrainerContext = createContext<LucidTrainerContextValue | null>(null);

function activationGoal(goal: NonNullable<LucidOnboardingState['goal']>) {
  if (goal === 'improve_recall') return 'recall' as const;
  if (goal === 'more_frequent_lucidity') return 'consistency' as const;
  if (goal === 'stabilize_lucidity') return 'exploration' as const;
  return 'lucidity' as const;
}

function reminderBucket(value: number) {
  return value <= 0 ? 'none' as const : value <= 2 ? 'low' as const : value <= 4 ? 'medium' as const : 'high' as const;
}

function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function entityForProgress(value: LucidProgramProgress): LucidSyncEntity {
  return { entityType: 'progress', entityKey: value.technique, value };
}

function currentDreamAtlasPreferences(state: LucidTrainerState): LucidDreamAtlasPreferences {
  return normalizeLucidDreamAtlasPreferences(
    lucidDreamAtlasOverlayPreferences(
      state.dreamAtlas ?? createEmptyLucidDreamAtlasOverlay(LUCID_DREAM_ATLAS_PRISTINE_UPDATED_AT)
    )
  );
}

function cloneDreamAtlasPreferences(
  preferences: LucidDreamAtlasPreferences
): LucidDreamAtlasPreferences {
  return {
    version: preferences.version,
    renamed: { ...preferences.renamed },
    hidden: [...preferences.hidden],
    merges: { ...preferences.merges },
    deleted: [...preferences.deleted],
  };
}

function guidedRitualSessionId(
  technique: LucidGuidedRitualTechnique,
  exerciseId: string
): string {
  return `${technique}:${exerciseId}`;
}

function completeProgramSessionMutation(params: {
  current: LucidTrainerState;
  technique: LucidTechnique;
  exerciseId: string;
  sessionNumber: number;
  sessionCount: number;
  now: number;
  guidedRitual?: LucidGuidedRitualProgress;
}): { next: LucidTrainerState; changed: LucidSyncEntity[] } {
  const {
    current,
    technique,
    exerciseId,
    sessionNumber,
    sessionCount,
    now,
    guidedRitual,
  } = params;
  const existing =
    current.progress.find((item) => item.technique === technique) ??
    createLucidProgramProgress(technique, now);
  const access = evaluateLucidSessionAccess({
    sessionNumber,
    sessionCount,
    exerciseId,
    progress: existing,
  });
  if (!access.allowed) throw new Error('Lucid session is locked');
  if (technique === 'wbtb') {
    const reason = getLucidWbtbDenialReason(evaluateLucidSafetyPolicyFromState(current));
    if (reason) {
      if (access.reason === 'completed') return { next: current, changed: [] };
      throw new Error(reason);
    }
  }
  const mutationUpdatedAt =
    Math.max(
      now,
      current.updatedAt,
      guidedRitual?.updatedAt ?? 0,
      ...current.progress.map((item) => item.updatedAt)
    ) + 1;
  const completedExerciseIds = [...new Set([...existing.completedExerciseIds, exerciseId])];
  const completed = completedExerciseIds.length >= sessionCount;
  const practiceDate = getLucidDateKeyInTimeZone(now, current.preferences.timeZone);
  if (practiceDate === null) throw new Error('Invalid Lucid timezone');
  const progress: LucidProgramProgress = {
    ...existing,
    ...(guidedRitual ? { guidedRitual } : {}),
    status: completed ? 'completed' : 'active',
    currentDay: Math.min(sessionCount, completedExerciseIds.length + 1),
    completedExerciseIds,
    practiceDates: [...new Set([...existing.practiceDates, practiceDate])],
    startedAt: existing.startedAt ?? now,
    completedAt: completed ? now : null,
    updatedAt: mutationUpdatedAt,
  };
  const next = applyLucidProgramProgress(
    current,
    progress,
    progress.status === 'active' ? technique : undefined
  );
  return {
    next,
    changed: diffLucidProgramProgress(current.progress, next.progress).map(entityForProgress),
  };
}

export function LucidTrainerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { dreams, loaded: dreamsLoaded } = useDreamsData();
  const userId = user?.id;
  const userScope = userId ? `user:${userId}` : 'guest';
  const deviceLocale = normalizeLucidLocale(getLocales()[0]?.languageTag);
  const [state, setState] = useState<LucidTrainerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<LucidSyncStatus>('local');
  const [lastSyncResult, setLastSyncResult] = useState<LucidSyncReplayResult | null>(null);
  const [guestImportAvailable, setGuestImportAvailable] = useState(false);
  const [activeScope, setActiveScope] = useState(userScope);
  const activeScopeRef = useRef(userScope);
  const dreamSignCandidates = useMemo(
    () => extractLucidDreamSignCandidates(dreams),
    [dreams]
  );
  const activeDreamSigns = useMemo(
    () => getActiveLucidDreamSigns(dreamSignCandidates, state?.dreamSignDecisions ?? []),
    [dreamSignCandidates, state?.dreamSignDecisions]
  );

  if (activeScope !== userScope) {
    resetLucidOnboardingCompletionNavigationClaim();
    setActiveScope(userScope);
    setState(null);
    setGuestImportAvailable(false);
    setError(null);
    setLastSyncResult(null);
    setSyncStatus('local');
    setLoading(true);
  }

  const reconcileLoadedState = useCallback(
    async (current: LucidTrainerState, requestedScope: string) => {
      if (current.onboarding.status !== 'completed') return current;
      try {
        const localeContent = getLucidContent(current.preferences.locale);
        const result = await reconcileLucidTrainerReminders(
          buildLucidReminderPlan(current, localeContent),
          { requestPermissionIfNeeded: false }
        );
        const permission: LucidOnboardingState['notificationsPermission'] =
          result.permission === 'granted'
            ? 'granted'
            : result.permission === 'denied'
              ? 'denied'
              : 'unknown';
        let permissionChanged = false;
        const next = await updateLucidTrainerState(requestedScope, (latest) => {
          if (permission === latest.onboarding.notificationsPermission) return latest;
          permissionChanged = true;
          const now = Date.now();
          const onboarding = {
            ...latest.onboarding,
            notificationsPermission: permission,
            updatedAt: now,
          };
          return { ...latest, onboarding, updatedAt: now };
        });
        if (permissionChanged && activeScopeRef.current === requestedScope) setState(next);
        return next;
      } catch (cause) {
        if (__DEV__) console.warn('[LucidTrainer] Reminder reconciliation failed', cause);
        return current;
      }
    },
    []
  );

  const runSync = useCallback(
    async (current: LucidTrainerState, requestedScope: string) => {
      if (!userId || !current.preferences.cloudSyncEnabled) {
        if (activeScopeRef.current === requestedScope) setSyncStatus('local');
        return null;
      }
      if (activeScopeRef.current === requestedScope) setSyncStatus('syncing');
      try {
        const pullResult = await pullLucidTrainerRemoteState(requestedScope);
        const result = await replayLucidTrainerQueue(requestedScope);
        if (activeScopeRef.current === requestedScope) {
          setLastSyncResult(result);
          setSyncStatus(
            result.outcome === 'offline'
              ? 'offline'
              : result.outcome === 'disabled'
                ? 'local'
                : 'synced'
          );
        }
        if (
          pullResult.received > 0 ||
          pullResult.reset ||
          result.acknowledged > 0 ||
          result.conflicts > 0
        ) {
          const refreshed = await loadLucidTrainerState(requestedScope);
          if (activeScopeRef.current === requestedScope) {
            setState(refreshed.state);
            void reconcileLoadedState(refreshed.state, requestedScope);
          }
        }
        return result;
      } catch (cause) {
        if (activeScopeRef.current === requestedScope) {
          setSyncStatus('error');
          setError(cause instanceof Error ? cause.message : 'Unable to synchronize');
        }
        return null;
      }
    },
    [reconcileLoadedState, userId]
  );

  const load = useCallback(async () => {
    const requestedScope = userScope;
    try {
      const result = await loadLucidTrainerState(requestedScope, {
        locale: deviceLocale,
        timeZone: getTimeZone(),
      });
      const guestDataAvailable = Boolean(userId) && await hasLucidTrainerGuestData({
        loadState: getLucidTrainerState,
      });
      if (activeScopeRef.current !== requestedScope) return;
      setState(result.state);
      setSyncStatus('local');
      setGuestImportAvailable(guestDataAvailable);
      setLoading(false);
      if (isLucidTrainer) {
        void setProductAnalyticsEnabled(result.state.onboarding.analyticsConsent === true);
      }
      // Local state is enough to leave the Lucid loader. Reminder
      // reconciliation and cloud sync are best-effort and must not hold
      // `/lucid/*` on the blocking spinner.
      void (async () => {
        const reconciled = await reconcileLoadedState(result.state, requestedScope);
        if (activeScopeRef.current !== requestedScope) return;
        if (reconciled.preferences.cloudSyncEnabled && userId) {
          await runSync(reconciled, requestedScope);
        }
      })();
    } catch (cause) {
      if (activeScopeRef.current === requestedScope) {
        setError(cause instanceof Error ? cause.message : 'Unable to load Lucid Trainer');
      }
    } finally {
      if (activeScopeRef.current === requestedScope) setLoading(false);
    }
  }, [deviceLocale, reconcileLoadedState, runSync, userId, userScope]);

  const importGuestData = useCallback(async () => {
    if (!userId) throw new Error('Authentication required');
    // Voice media is out of band from trainer state. Migrate guest notes to
    // the signed-in scope first. Only then claim trainer guest data, so a
    // voice failure leaves the guest trainer scope intact and a later trainer
    // failure still leaves the audio on the account.
    const voiceClaim = await claimLucidMorningVoiceNoteScope('guest', userScope);
    if (voiceClaim.retainedGuest !== 0) {
      throw new Error('Guest voice notes remain after account copy');
    }
    const result = await claimLucidTrainerGuestScope(userScope, {
      storage: {
        loadQueue: loadLucidTrainerSyncQueue,
        updateQueue: updateLucidTrainerSyncQueue,
        loadState: getLucidTrainerState,
        updateState: (scope, updater) => updateLucidTrainerState(scope, updater),
        // Importing a storage scope must not cancel the authenticated account's
        // active reminders. Reminder reconciliation remains account-scoped.
        clearScope: (scope) => clearLucidTrainerLocalData(scope, undefined, async () => {}),
      },
    });
    if (result.claimed) {
      const imported = await getLucidTrainerState(userScope);
      if (activeScopeRef.current === userScope) setState(imported);
      if (imported) {
        await reconcileLoadedState(imported, userScope);
        if (imported.preferences.cloudSyncEnabled) await runSync(imported, userScope);
      }
    }
    setGuestImportAvailable(false);
  }, [reconcileLoadedState, runSync, userId, userScope]);

  useEffect(() => {
    activeScopeRef.current = userScope;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load, userScope]);

  const queueEntities = useCallback(
    async (entities: readonly LucidSyncEntity[], nextState: LucidTrainerState) => {
      if (!user?.id || !nextState.preferences.cloudSyncEnabled) return;
      for (const entity of entities) {
        await queueLucidTrainerMutation(
          createLucidTrainerMutation({ userScope, operation: 'upsert', entity })
        );
      }
      setSyncStatus('local');
    },
    [user?.id, userScope]
  );

  const commit = useCallback(
    async (
      updater: (current: LucidTrainerState, now: number) => {
        next: LucidTrainerState;
        changed: LucidSyncEntity[];
      }
    ) => {
      setError(null);
      try {
        let changed: LucidSyncEntity[] = [];
        const next = await updateLucidTrainerState(
          userScope,
          (current) => {
            const result = updater(current, Date.now());
            changed = result.changed;
            return result.next;
          },
          { locale: deviceLocale, timeZone: getTimeZone() }
        );
        if (activeScopeRef.current === userScope) setState(next);
        await queueEntities(changed, next);
        return next;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unable to save Lucid Trainer';
        setError(message);
        throw cause;
      }
    },
    [deviceLocale, queueEntities, userScope]
  );

  const saveOnboardingDraft = useCallback(
    async (patch: LucidOnboardingDraftPatch) => {
      await commit((current, now) => {
        if (current.onboarding.status === 'completed') {
          return { next: current, changed: [] };
        }
        const onboarding: LucidOnboardingState = {
          ...current.onboarding,
          ...patch,
          status: 'in_progress',
          updatedAt: now,
        };
        return {
          next: { ...current, onboarding, updatedAt: now },
          changed: [{ entityType: 'onboarding', entityKey: 'onboarding', value: onboarding }],
        };
      });
    },
    [commit]
  );

  const completeOnboarding = useCallback(
    async (input: CompleteOnboardingInput) => {
      const {
        cloudSyncEnabled,
        noctaliaLinkEnabled,
        ...onboardingInput
      } = input;
      const next = await commit((current, now) => {
        const completionCandidate: LucidOnboardingState = {
          ...current.onboarding,
          ...onboardingInput,
          wakeSensitivity: input.wakeSensitivity,
        };
        requireCompleteOnboardingAnswers(completionCandidate);
        const onboarding: LucidOnboardingState = {
          ...completionCandidate,
          sleepScheduleConfirmed: true,
          sleepScheduleDraft: {
            bedtime: input.sleepSchedule.bedtime,
            wakeTime: input.sleepSchedule.wakeTime,
          },
          draftStep: 3,
          status: 'completed',
          completedAt: now,
          updatedAt: now,
        };
        const preferences: LucidTrainerPreferences = {
          ...current.preferences,
          locale: normalizeLucidLocale(current.preferences.locale),
          notificationsEnabled: input.notificationsPermission === 'granted',
          cloudSyncEnabled,
          noctaliaLinkEnabled,
          timeZone: input.sleepSchedule.timeZone,
          updatedAt: now,
        };
        const next = { ...current, onboarding, preferences, updatedAt: now };
        return {
          next,
          changed: cloudSyncEnabled
            ? getLucidSyncEntities(next)
            : [
                { entityType: 'onboarding', entityKey: 'onboarding', value: onboarding },
                { entityType: 'preferences', entityKey: 'preferences', value: preferences },
              ],
        };
      });
      // The durable local write above is the completion boundary. Native
      // notification APIs, analytics and first cloud sync are best-effort and
      // must never hold the final onboarding CTA in a busy state.
      void (async () => {
        if (input.analyticsConsent && input.goal && input.experience) {
          await setProductAnalyticsEnabled(true);
          await trackProductEvent('lucid_activation_completed', {
            goal: activationGoal(input.goal),
            experience: input.experience === 'beginner' ? 'new' : input.experience === 'occasional' ? 'some' : 'experienced',
            reminder_frequency: reminderBucket(next.preferences.realityCheckRemindersPerDay),
          });
        } else if (isLucidTrainer) {
          await setProductAnalyticsEnabled(false);
        }
      })().catch((cause) => {
        if (__DEV__) console.warn('[LucidTrainer] Activation analytics failed', cause);
      });
      void reconcileLoadedState(next, userScope);
      if (cloudSyncEnabled && userId) {
        void runSync(next, userScope);
      }
    },
    [commit, reconcileLoadedState, runSync, userId, userScope]
  );

  const updatePreferences = useCallback(
    async (patch: Partial<LucidTrainerPreferences>) => {
      const next = await commit((current, now) => {
        const preferences: LucidTrainerPreferences = {
          ...current.preferences,
          ...patch,
          updatedAt: now,
        };
        const next = { ...current, preferences, updatedAt: now };
        return {
          next,
          changed: patch.cloudSyncEnabled === true
            ? getLucidSyncEntities(next)
            : [{ entityType: 'preferences', entityKey: 'preferences', value: preferences }],
        };
      });
      await reconcileLoadedState(next, userScope);
      if (patch.cloudSyncEnabled === true && userId) {
        await runSync(next, userScope);
      }
    },
    [commit, reconcileLoadedState, runSync, userId, userScope]
  );

  const updateDreamAtlasPreferences = useCallback(
    async (updater: (current: LucidDreamAtlasPreferences) => LucidDreamAtlasPreferences) => {
      let saved: LucidDreamAtlasPreferences | null = null;
      await commit((current, now) => {
        const currentPreferences = currentDreamAtlasPreferences(current);
        const nextPreferences = normalizeLucidDreamAtlasPreferences(
          updater(cloneDreamAtlasPreferences(currentPreferences))
        );
        if (areLucidDreamAtlasPreferencesSemanticallyEqual(currentPreferences, nextPreferences)) {
          saved = currentPreferences;
          return { next: current, changed: [] };
        }
        const entity: LucidSyncEntity = {
          entityType: 'dream_atlas',
          entityKey: 'dream_atlas',
          value: { ...nextPreferences, updatedAt: now },
        };
        saved = nextPreferences;
        return { next: applyLucidSyncEntity(current, entity), changed: [entity] };
      });
      if (!saved) throw new Error('Dream atlas preferences were not saved');
      return saved;
    },
    [commit]
  );

  const clearDreamAtlasPreferences = useCallback(async () => {
    await commit((current, now) => {
      const entity: LucidSyncEntity = {
        entityType: 'dream_atlas',
        entityKey: 'dream_atlas',
        value: createEmptyLucidDreamAtlasOverlay(now),
      };
      return { next: applyLucidSyncEntity(current, entity), changed: [entity] };
    });
  }, [commit]);

  const updateAnalyticsConsent = useCallback(
    async (enabled: boolean) => {
      await commit((current, now) => {
        const onboarding: LucidOnboardingState = {
          ...current.onboarding,
          analyticsConsent: enabled,
          updatedAt: now,
        };
        return {
          next: { ...current, onboarding, updatedAt: now },
          changed: [{ entityType: 'onboarding', entityKey: 'onboarding', value: onboarding }],
        };
      });
      if (isLucidTrainer) await setProductAnalyticsEnabled(enabled);
    },
    [commit]
  );

  const updateAudioSafetyConsent = useCallback(
    async (enabled: boolean) => {
      await commit((current, now) => {
        const onboarding: LucidOnboardingState = {
          ...current.onboarding,
          audioSafetyAccepted: enabled,
          updatedAt: now,
        };
        return {
          next: { ...current, onboarding, updatedAt: now },
          changed: [{ entityType: 'onboarding', entityKey: 'onboarding', value: onboarding }],
        };
      });
    },
    [commit]
  );

  const startProgram = useCallback(
    async (technique: LucidTechnique) => {
      await commit((current, now) => {
        const existing = current.progress.find((item) => item.technique === technique);
        // Reviewing a finished program must not exclusive-activate it: that
        // would pause the user's current training, and the opened last session
        // is already complete so its CTA only closes and never restores status.
        if (existing?.status === 'completed') {
          return { next: current, changed: [] };
        }
        if (technique === 'wbtb') {
          const reason = getLucidWbtbDenialReason(evaluateLucidSafetyPolicyFromState(current));
          if (reason) throw new Error(reason);
        }
        const { next, changed } = activateExclusiveLucidProgram(current, technique, now);
        return { next, changed: changed.map(entityForProgress) };
      });
    },
    [commit]
  );

  const completeProgramSession = useCallback(
    async (technique: LucidTechnique, exerciseId: string, sessionNumber: number, sessionCount: number) => {
      const next = await commit((current, now) =>
        completeProgramSessionMutation({
          current,
          technique,
          exerciseId,
          sessionNumber,
          sessionCount,
          now,
        })
      );
      if (next.onboarding.analyticsConsent === true) {
        await trackProductEvent('lucid_training_completed', {
          technique,
          phase: technique === 'wbtb' ? 'night' : 'bedtime',
          outcome: 'completed',
          duration: technique === 'wbtb' ? '15m_plus' : '5_15m',
        });
      }
    },
    [commit]
  );

  const updateGuidedRitual = useCallback(
    async (input: LucidGuidedRitualMutationInput) => {
      let saved: LucidGuidedRitualProgress | null = null;
      await commit((current, now) => {
        const existing =
          current.progress.find((item) => item.technique === input.technique) ??
          createLucidProgramProgress(input.technique, now);
        const access = evaluateLucidSessionAccess({
          sessionNumber: input.sessionNumber,
          sessionCount: input.sessionCount,
          exerciseId: input.exerciseId,
          progress: existing,
        });
        if (!access.allowed || access.reason === 'completed') {
          throw new Error('Lucid session is locked');
        }
        const plan = createLucidGuidedRitualPlan(
          input.technique,
          evaluateLucidSafetyPolicyFromState(current)
        );
        if (plan.status !== 'ready') throw new Error(plan.reason);
        const sessionId = guidedRitualSessionId(input.technique, input.exerciseId);
        const currentRitual = existing.guidedRitual;
        const sameRitual = currentRitual?.sessionId === sessionId;
        let guidedRitual: LucidGuidedRitualProgress;

        if (input.action === 'start') {
          guidedRitual = sameRitual && currentRitual
            ? currentRitual
            : createLucidGuidedRitualProgress({ plan, sessionId, now });
        } else {
          if (!sameRitual || !currentRitual) {
            throw new Error('Guided ritual has not started');
          }
          if (
            (input.action === 'resume' || input.action === 'advance') &&
            (currentRitual.mode !== plan.mode || currentRitual.stepCount !== plan.phases.length)
          ) {
            guidedRitual = createLucidGuidedRitualProgress({ plan, sessionId, now });
          } else if (input.action === 'advance') {
            guidedRitual = advanceLucidGuidedRitualProgress(currentRitual, now);
          } else if (input.action === 'abandon') {
            guidedRitual = abandonLucidGuidedRitualProgress(currentRitual, now);
          } else {
            guidedRitual = resumeLucidGuidedRitualProgress(currentRitual, now);
          }
        }

        saved = guidedRitual;
        const mutationUpdatedAt =
          Math.max(
            now,
            current.updatedAt,
            guidedRitual.updatedAt,
            ...current.progress.map((item) => item.updatedAt)
          ) + 1;
        const progress: LucidProgramProgress = {
          ...existing,
          status: 'active',
          startedAt: existing.startedAt ?? now,
          guidedRitual,
          updatedAt: mutationUpdatedAt,
        };
        const next = applyLucidProgramProgress(current, progress, input.technique);
        return {
          next,
          changed: diffLucidProgramProgress(current.progress, next.progress).map(entityForProgress),
        };
      });
      if (!saved) throw new Error('Guided ritual was not saved');
      return saved;
    },
    [commit]
  );

  const completeGuidedRitualSession = useCallback(
    async (
      technique: LucidGuidedRitualTechnique,
      exerciseId: string,
      sessionNumber: number,
      sessionCount: number
    ) => {
      const next = await commit((current, now) => {
        const existing = current.progress.find((item) => item.technique === technique);
        const sessionId = guidedRitualSessionId(technique, exerciseId);
        if (!existing?.guidedRitual || existing.guidedRitual.sessionId !== sessionId) {
          throw new Error('Guided ritual has not started');
        }
        const guidedRitual = completeLucidGuidedRitualProgress(
          existing.guidedRitual,
          now
        );
        return completeProgramSessionMutation({
          current,
          technique,
          exerciseId,
          sessionNumber,
          sessionCount,
          now,
          guidedRitual,
        });
      });
      if (next.onboarding.analyticsConsent === true) {
        await trackProductEvent('lucid_training_completed', {
          technique,
          phase: 'bedtime',
          outcome: 'completed',
          duration: '5_15m',
        });
      }
    },
    [commit]
  );

  const pauseProgram = useCallback(
    async (technique: LucidTechnique) => {
      await commit((current, now) => {
        const existing = current.progress.find((item) => item.technique === technique) ?? createLucidProgramProgress(technique, now);
        const mutationUpdatedAt = Math.max(now, current.updatedAt, ...current.progress.map((item) => item.updatedAt)) + 1;
        const progress: LucidProgramProgress = { ...existing, status: 'paused', updatedAt: mutationUpdatedAt };
        const next = applyLucidProgramProgress(current, progress);
        return { next, changed: [entityForProgress(progress)] };
      });
    },
    [commit]
  );

  const addExperiment = useCallback(
    async (input: LucidExperimentInput) => {
      let created: LucidExperiment | null = null;
      const next = await commit((current, now) => {
        const recallText = input.recallText?.trim();
        const techniqueAutoLink = resolvePreviousNightTechniqueLink(
          current.progress,
          now,
          current.preferences.timeZone
        );
        const experiment: LucidExperiment = {
          id: Crypto.randomUUID(),
          occurredAt: now,
          updatedAt: now,
          technique: input.technique,
          preparationMinutes: input.preparationMinutes,
          result: input.result,
          lucidityLevel: input.lucidityLevel,
          recallLevel: input.recallLevel,
          sleepQuality: input.sleepQuality,
          factors: input.factors,
          captureMode: input.captureMode,
          cueOutcome: input.cueOutcome,
        };
        if (input.notes) experiment.notes = input.notes;
        if (input.captureMode === 'write' || input.captureMode === 'speak') {
          if (recallText) experiment.recallText = recallText;
        }
        if (input.captureMode === 'speak' && input.voiceCapture) {
          experiment.voiceCapture = input.voiceCapture;
        }
        if (techniqueAutoLink) experiment.techniqueAutoLink = techniqueAutoLink;
        if (!isLucidExperiment(experiment)) {
          throw new Error('Invalid Lucid experiment');
        }
        created = experiment;
        const entity: LucidSyncEntity = {
          entityType: 'experiment',
          entityKey: experiment.id,
          value: experiment,
        };
        return { next: applyLucidSyncEntity(current, entity), changed: [entity] };
      });
      if (next.onboarding.analyticsConsent === true && input.technique) {
        await trackProductEvent('lucid_training_completed', {
          technique: input.technique,
          phase: 'morning',
          outcome: 'completed',
          duration: 'under_5m',
        });
      }
      if (!created) throw new Error('Experiment was not created');
      return created;
    },
    [commit]
  );

  const addRealityCheck = useCallback(
    async (input: RealityCheckInput) => {
      let created: LucidRealityCheck | null = null;
      await commit((current, now) => {
        created = {
          id: Crypto.randomUUID(),
          occurredAt: now,
          updatedAt: now,
          ...input,
          ...(input.observedDetail !== undefined
            ? { observedDetail: input.observedDetail.trim() }
            : {}),
          ...(input.arrivalPath !== undefined
            ? { arrivalPath: input.arrivalPath.trim() }
            : {}),
          ...(input.nextDreamIntention !== undefined
            ? { nextDreamIntention: input.nextDreamIntention.trim() }
            : {}),
        };
        if (!isLucidRealityCheck(created)) {
          throw new Error('Invalid Lucid reality check');
        }
        const entity: LucidSyncEntity = { entityType: 'reality_check', entityKey: created.id, value: created };
        return { next: applyLucidSyncEntity(current, entity), changed: [entity] };
      });
      if (!created) throw new Error('Reality check was not created');
      return created;
    },
    [commit]
  );

  const saveDreamSignDecision = useCallback(
    async (input: LucidDreamSignDecisionInput) => {
      const candidate = dreamSignCandidates.find((item) => item.id === input.id);
      if (
        input.decision !== 'pending' &&
        (!candidate ||
          canonicalLucidJson(candidate.sourceDreamIds) !==
            canonicalLucidJson([...new Set(input.sourceDreamIds)].sort()))
      ) {
        throw new Error('Dream sign must match current local journal evidence');
      }
      let deleted = false;
      const next = await commit((current, now) => {
        const existing = (current.dreamSignDecisions ?? []).find(
          (item) => item.id === input.id
        );
        if (input.decision === 'pending') {
          if (!existing) return { next: current, changed: [] };
          deleted = true;
          return {
            next: {
              ...current,
              updatedAt: now,
              dreamSignDecisions: (current.dreamSignDecisions ?? []).filter(
                (item) => item.id !== input.id
              ),
            },
            changed: [],
          };
        }

        const customLabel = input.customLabel?.replace(/\s+/g, ' ').trim() || undefined;
        const record: LucidPersistedDreamSignDecision = {
          id: input.id,
          decision: input.decision,
          sourceDreamIds: [...candidate!.sourceDreamIds],
          updatedAt: now,
          ...(customLabel ? { customLabel } : {}),
        };
        if (!isLucidPersistedDreamSignDecision(record)) {
          throw new Error('Invalid Lucid dream-sign decision');
        }
        const entity: LucidSyncEntity = {
          entityType: 'dream_sign',
          entityKey: record.id,
          value: record,
        };
        return { next: applyLucidSyncEntity(current, entity), changed: [entity] };
      });

      if (deleted && user?.id && next.preferences.cloudSyncEnabled) {
        await queueLucidTrainerMutation(
          createLucidTrainerMutation({
            userScope,
            operation: 'delete',
            entityType: 'dream_sign',
            entityKey: input.id,
          })
        );
      }
    },
    [commit, dreamSignCandidates, user?.id, userScope]
  );

  const saveWeeklyReview = useCallback(
    async (input: Omit<LucidWeeklyReview, 'id' | 'completedAt' | 'updatedAt'>) => {
      const next = await commit((current, now) => {
        const review: LucidWeeklyReview = {
          id: Crypto.randomUUID(),
          completedAt: now,
          updatedAt: now,
          ...input,
        };
        const entity: LucidSyncEntity = { entityType: 'weekly_review', entityKey: review.id, value: review };
        return { next: applyLucidSyncEntity(current, entity), changed: [entity] };
      });
      if (next.onboarding.analyticsConsent === true) {
        const ageWeeks = Math.floor((Date.now() - next.createdAt) / (7 * 86400000));
        await trackProductEvent('lucid_retention_observed', {
          week: ageWeeks < 1 ? 'week_1' : ageWeeks < 5 ? 'week_2_4' : 'week_5_plus',
          active_days: input.practiceDays === 0 ? '0' : input.practiceDays <= 2 ? '1_2' : input.practiceDays <= 4 ? '3_4' : '5_7',
          status: input.practiceDays >= 1 ? 'active' : next.experiments.length ? 'returning' : 'lapsed',
        });
      }
    },
    [commit]
  );

  const deleteExperiment = useCallback(
    async (id: string) => {
      await unlinkLucidMorningVoiceNotesFromExperiment(userScope, id);
      await commit((current, now) => ({
        next: { ...current, updatedAt: now, experiments: current.experiments.filter((item) => item.id !== id) },
        changed: [],
      }));
      if (user?.id && state?.preferences.cloudSyncEnabled) {
        await queueLucidTrainerMutation(
          createLucidTrainerMutation({ userScope, operation: 'delete', entityType: 'experiment', entityKey: id })
        );
      }
    },
    [commit, state?.preferences.cloudSyncEnabled, user?.id, userScope]
  );

  const clearExperimentVoiceCapture = useCallback(
    async (id: string) => {
      await commit((current, now) => {
        const existing = current.experiments.find((item) => item.id === id);
        if (!existing || existing.voiceCapture !== 'local_note') {
          return { next: current, changed: [] };
        }

        const { voiceCapture: _voiceCapture, recallText, ...base } = existing;
        const normalizedRecall = recallText?.trim();
        const experiment: LucidExperiment = normalizedRecall
          ? {
              ...base,
              captureMode: 'write',
              recallText: normalizedRecall,
              updatedAt: Math.max(now, existing.updatedAt),
            }
          : {
              ...base,
              captureMode: 'nothing_for_now',
              updatedAt: Math.max(now, existing.updatedAt),
            };
        if (!isLucidExperiment(experiment)) {
          throw new Error('Invalid Lucid experiment');
        }
        const entity: LucidSyncEntity = {
          entityType: 'experiment',
          entityKey: experiment.id,
          value: experiment,
        };
        return { next: applyLucidSyncEntity(current, entity), changed: [entity] };
      });
    },
    [commit]
  );

  const syncNow = useCallback(async () => {
    if (!state) {
      setSyncStatus('local');
      return null;
    }
    return runSync(state, userScope);
  }, [runSync, state, userScope]);

  const content = useMemo(
    () => getLucidContent(state?.preferences.locale ?? deviceLocale),
    [deviceLocale, state?.preferences.locale]
  );

  useEffect(() => {
    const decisions = state?.dreamSignDecisions ?? [];
    if (!dreamsLoaded || decisions.length === 0) return;
    const candidatesById = new Map(
      dreamSignCandidates.map((candidate) => [candidate.id, candidate] as const)
    );
    const needsReconciliation = decisions.some((decision) => {
      const candidate = candidatesById.get(decision.id);
      return (
        !candidate ||
        canonicalLucidJson(decision.sourceDreamIds) !==
          canonicalLucidJson(candidate.sourceDreamIds)
      );
    });
    if (!needsReconciliation) return;

    void (async () => {
      const deletedIds: string[] = [];
      const next = await commit((current, now) => {
        deletedIds.length = 0;
        const changed: LucidSyncEntity[] = [];
        const reconciled: LucidPersistedDreamSignDecision[] = [];
        for (const decision of current.dreamSignDecisions ?? []) {
          const candidate = candidatesById.get(decision.id);
          if (!candidate) {
            deletedIds.push(decision.id);
            continue;
          }
          if (
            canonicalLucidJson(decision.sourceDreamIds) ===
            canonicalLucidJson(candidate.sourceDreamIds)
          ) {
            reconciled.push(decision);
            continue;
          }
          const updated: LucidPersistedDreamSignDecision = {
            ...decision,
            sourceDreamIds: [...candidate.sourceDreamIds],
            updatedAt: now,
          };
          reconciled.push(updated);
          changed.push({
            entityType: 'dream_sign',
            entityKey: updated.id,
            value: updated,
          });
        }
        if (changed.length === 0 && deletedIds.length === 0) {
          return { next: current, changed: [] };
        }
        return {
          next: {
            ...current,
            updatedAt: now,
            dreamSignDecisions: reconciled.sort((a, b) => a.id.localeCompare(b.id)),
          },
          changed,
        };
      });
      if (user?.id && next.preferences.cloudSyncEnabled) {
        for (const id of [...new Set(deletedIds)]) {
          await queueLucidTrainerMutation(
            createLucidTrainerMutation({
              userScope,
              operation: 'delete',
              entityType: 'dream_sign',
              entityKey: id,
            })
          );
        }
        if (deletedIds.length > 0) setSyncStatus('local');
      }
    })().catch((cause) => {
      if (__DEV__) console.warn('[LucidTrainer] Dream-sign reconciliation failed', cause);
    });
  }, [commit, dreamSignCandidates, dreamsLoaded, state?.dreamSignDecisions, user?.id, userScope]);

  useEffect(() => {
    if (!dreamsLoaded || state == null) return;
    const reconciledSigns = reconcileLucidDreamSignDecisions(
      dreamSignCandidates,
      state.dreamSignDecisions ?? []
    );
    const reconciledPreferences = buildLucidDreamAtlas({
      signs: reconciledSigns,
      dreams,
      preferences: state.dreamAtlas,
    }).preferences;
    if (
      areLucidDreamAtlasPreferencesSemanticallyEqual(
        currentDreamAtlasPreferences(state),
        reconciledPreferences
      )
    ) {
      return;
    }
    void (async () => {
      await updateDreamAtlasPreferences(() => reconciledPreferences);
    })().catch((cause) => {
      if (__DEV__) console.warn('[LucidTrainer] Dream atlas reconciliation failed', cause);
    });
  }, [
    dreamSignCandidates,
    dreams,
    dreamsLoaded,
    state,
    updateDreamAtlasPreferences,
  ]);

  const reconcileReminders = useCallback(async () => {
    if (!state) return;
    await reconcileLoadedState(state, userScope);
  }, [reconcileLoadedState, state, userScope]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void reconcileReminders();
      if (state?.preferences.cloudSyncEnabled && user?.id) void syncNow();
    });
    return () => subscription.remove();
  }, [reconcileReminders, state?.preferences.cloudSyncEnabled, syncNow, user?.id]);

  const resetLocalData = useCallback(async () => {
    resetLucidOnboardingCompletionNavigationClaim();
    await clearLucidTrainerLocalData(userScope);
    setLoading(true);
    await load();
  }, [load, userScope]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    await load();
  }, [load]);

  const value = useMemo<LucidTrainerContextValue>(
    () => ({
      state,
      content,
      loading,
      error,
      userScope,
      syncStatus,
      lastSyncResult,
      guestImportAvailable,
      dreamSignCandidates,
      activeDreamSigns,
      importGuestData,
      saveOnboardingDraft,
      completeOnboarding,
      updateAnalyticsConsent,
      updateAudioSafetyConsent,
      updatePreferences,
      updateDreamAtlasPreferences,
      clearDreamAtlasPreferences,
      startProgram,
      completeProgramSession,
      updateGuidedRitual,
      completeGuidedRitualSession,
      pauseProgram,
      addExperiment,
      addRealityCheck,
      saveDreamSignDecision,
      saveWeeklyReview,
      clearExperimentVoiceCapture,
      deleteExperiment,
      syncNow,
      resetLocalData,
      reload,
    }),
    [
      state,
      content,
      loading,
      error,
      userScope,
      syncStatus,
      lastSyncResult,
      guestImportAvailable,
      dreamSignCandidates,
      activeDreamSigns,
      importGuestData,
      saveOnboardingDraft,
      completeOnboarding,
      updateAnalyticsConsent,
      updateAudioSafetyConsent,
      updatePreferences,
      updateDreamAtlasPreferences,
      clearDreamAtlasPreferences,
      startProgram,
      completeProgramSession,
      updateGuidedRitual,
      completeGuidedRitualSession,
      pauseProgram,
      addExperiment,
      addRealityCheck,
      saveDreamSignDecision,
      saveWeeklyReview,
      clearExperimentVoiceCapture,
      deleteExperiment,
      syncNow,
      resetLocalData,
      reload,
    ]
  );

  return <LucidTrainerContext.Provider value={value}>{children}</LucidTrainerContext.Provider>;
}

export function useLucidTrainer(): LucidTrainerContextValue {
  const context = useContext(LucidTrainerContext);
  if (!context) throw new Error('useLucidTrainer must be used within LucidTrainerProvider');
  return context;
}

/** Optional access for shared presentation components that also render in isolated tests. */
export function useOptionalLucidTrainer(): LucidTrainerContextValue | null {
  return useContext(LucidTrainerContext);
}
