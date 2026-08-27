import {
  isLucidDateKey,
  isLucidExperiment,
  isLucidPersistedDreamSignDecision,
  isLucidRealityCheck,
  isLucidLocalTime,
  isLucidSyncMutation,
  isLucidTimeZone,
  isLucidOnboardingState,
  isLucidTrainerState,
  parseLucidSyncQueue,
  parseLucidTrainerState,
  type LucidExperiment,
} from '@/lib/lucid/model';
import { createInitialLucidTrainerState } from '@/lib/lucid/domain';

describe('Lucid Trainer model', () => {
  const NOW = 1_700_000_000_000;

  it('creates a valid state with cloud and Noctalia transfer disabled by default', () => {
    const state = createInitialLucidTrainerState({
      now: NOW,
      timeZone: 'Europe/Paris',
      locale: 'fr',
    });

    expect(isLucidTrainerState(state)).toBe(true);
    expect(state.preferences).toMatchObject({
      theme: 'dynamic',
      cloudSyncEnabled: false,
      noctaliaLinkEnabled: false,
      audioCuesEnabled: false,
      notificationsEnabled: false,
    });
    expect(parseLucidTrainerState(JSON.stringify(state))).toEqual(state);
  });

  it.each([
    ['future schema', (state: any) => (state.schemaVersion = 2)],
    ['missing explicit cloud opt-in', (state: any) => delete state.preferences.cloudSyncEnabled],
    ['unsafe audio volume', (state: any) => (state.preferences.audioVolume = 0.8)],
    [
      'invalid sleep quality',
      (state: any) => {
        state.experiments = [
          {
            id: 'exp-1',
            occurredAt: NOW,
            technique: 'mild',
            preparationMinutes: 10,
            result: 'lucid',
            lucidityLevel: 4,
            recallLevel: 5,
            sleepQuality: 6,
            factors: [],
            updatedAt: NOW,
          },
        ];
      },
    ],
  ])('rejects %s', (_label, mutate) => {
    const state: any = createInitialLucidTrainerState({
      now: NOW,
      timeZone: 'UTC',
    });
    mutate(state);

    expect(isLucidTrainerState(state)).toBe(false);
    expect(parseLucidTrainerState(JSON.stringify(state))).toBeNull();
  });


  it('initializes optional four-step draft fields without bumping schemaVersion', () => {
    const state = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    expect(state.schemaVersion).toBe(1);
    expect(state.onboarding).toMatchObject({
      wakeSensitivity: null,
      draftStep: 0,
      sleepScheduleConfirmed: false,
      sleepScheduleDraft: { bedtime: null, wakeTime: null },
    });
    expect(isLucidOnboardingState(state.onboarding)).toBe(true);
  });

  it('accepts historical v1 onboarding without the new draft fields', () => {
    const state = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    const legacy = { ...state.onboarding };
    delete (legacy as { wakeSensitivity?: unknown }).wakeSensitivity;
    delete (legacy as { draftStep?: unknown }).draftStep;
    delete (legacy as { sleepScheduleConfirmed?: unknown }).sleepScheduleConfirmed;
    delete (legacy as { sleepScheduleDraft?: unknown }).sleepScheduleDraft;
    expect(isLucidOnboardingState(legacy)).toBe(true);
  });

  it('accepts historical v1 state without dream signs and validates bounded decisions', () => {
    const state = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    delete (state as { dreamSignDecisions?: unknown }).dreamSignDecisions;
    expect(isLucidTrainerState(state)).toBe(true);

    const decision = {
      id: 'sign:mirror',
      decision: 'confirmed',
      customLabel: 'My mirror',
      sourceDreamIds: ['101', '102'],
      updatedAt: NOW,
    };
    expect(isLucidPersistedDreamSignDecision(decision)).toBe(true);
    expect(isLucidTrainerState({ ...state, dreamSignDecisions: [decision] })).toBe(true);
    expect(isLucidPersistedDreamSignDecision({ ...decision, decision: 'pending' })).toBe(false);
    expect(isLucidPersistedDreamSignDecision({ ...decision, sourceDreamIds: ['101', '101'] })).toBe(false);
    expect(isLucidPersistedDreamSignDecision({ ...decision, customLabel: 'x'.repeat(81) })).toBe(false);
  });

  it('links reality checks only to a complete confirmed-sign identity', () => {
    const check = {
      id: 'check-1',
      occurredAt: NOW,
      context: 'dream_sign',
      method: 'nose_breathing',
      outcome: 'awake',
      mindful: true,
      dreamSignId: 'sign:mirror',
      dreamSignLabel: 'My mirror',
      updatedAt: NOW,
    };
    expect(isLucidRealityCheck(check)).toBe(true);
    expect(isLucidRealityCheck({ ...check, dreamSignLabel: undefined })).toBe(false);
    expect(isLucidRealityCheck({ ...check, context: 'scheduled' })).toBe(false);
    const { dreamSignId: _id, dreamSignLabel: _label, ...historical } = check;
    expect(isLucidRealityCheck(historical)).toBe(true);
  });

  it('rejects invalid four-step draft fields when present', () => {
    const state = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    expect(isLucidOnboardingState({ ...state.onboarding, wakeSensitivity: 'fragile' })).toBe(false);
    expect(isLucidOnboardingState({ ...state.onboarding, draftStep: 4 })).toBe(false);
    expect(isLucidOnboardingState({ ...state.onboarding, sleepScheduleConfirmed: 'yes' })).toBe(false);
    expect(isLucidOnboardingState({ ...state.onboarding, sleepScheduleDraft: { bedtime: '25:00', wakeTime: null } })).toBe(false);
    expect(isLucidOnboardingState({ ...state.onboarding, sleepScheduleDraft: { bedtime: null, wakeTime: '7:00' } })).toBe(false);
    expect(isLucidOnboardingState({ ...state.onboarding, sleepScheduleDraft: { bedtime: '23:15', wakeTime: null } })).toBe(true);
    expect(isLucidOnboardingState({ ...state.onboarding, wakeSensitivity: 'sensitive', draftStep: 2, sleepScheduleConfirmed: true })).toBe(true);
  });

  it('validates local times and real calendar dates', () => {
    expect(isLucidLocalTime('23:59')).toBe(true);
    expect(isLucidLocalTime('24:00')).toBe(false);
    expect(isLucidLocalTime('7:00')).toBe(false);
    expect(isLucidDateKey('2028-02-29')).toBe(true);
    expect(isLucidDateKey('2027-02-29')).toBe(false);
    expect(isLucidTimeZone('Europe/Paris')).toBe(true);
    expect(isLucidTimeZone('Mars/Olympus')).toBe(false);
  });

  it('validates entity identity and idempotent mutation fields', () => {
    const state = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    const mutation = {
      version: 1,
      id: 'mutation-1',
      userScope: 'user:user-1',
      entityType: 'preferences',
      entityKey: 'preferences',
      operation: 'upsert',
      clientRequestId: 'request-1',
      clientUpdatedAt: NOW,
      payload: {
        entity: {
          entityType: 'preferences',
          entityKey: 'preferences',
          value: state.preferences,
        },
      },
      status: 'pending',
      retryCount: 0,
      createdAt: NOW,
    };

    expect(isLucidSyncMutation(mutation)).toBe(true);
    expect(
      isLucidSyncMutation({
        ...mutation,
        entityKey: 'another-key',
      })
    ).toBe(false);
    expect(parseLucidSyncQueue(JSON.stringify([mutation]))).toEqual([mutation]);
    expect(parseLucidSyncQueue('{bad-json')).toBeNull();
  });

  describe('morning capture experiment compatibility', () => {
    const legacy: LucidExperiment = {
      id: 'exp-legacy',
      occurredAt: NOW,
      technique: 'mild',
      preparationMinutes: 10,
      result: 'lucid',
      lucidityLevel: 4,
      recallLevel: 5,
      sleepQuality: 3,
      factors: ['stress'],
      notes: 'legacy morning review',
      updatedAt: NOW,
    };

    const writeCapture: LucidExperiment = {
      id: 'exp-write',
      occurredAt: NOW,
      technique: null,
      preparationMinutes: null,
      result: null,
      lucidityLevel: null,
      recallLevel: null,
      sleepQuality: null,
      factors: [],
      updatedAt: NOW,
      captureMode: 'write',
      recallText: 'the hallway again',
      cueOutcome: 'indeterminate',
    };

    it('accepts valid legacy records and valid new capture records in the same state', () => {
      const state = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
      state.experiments = [legacy, writeCapture];

      expect(isLucidExperiment(legacy)).toBe(true);
      expect(isLucidExperiment(writeCapture)).toBe(true);
      expect(isLucidTrainerState(state)).toBe(true);
      expect(parseLucidTrainerState(JSON.stringify(state))?.experiments).toEqual([
        legacy,
        writeCapture,
      ]);
    });

    it('requires write and speak captures to keep non-empty recall text and a cue outcome', () => {
      expect(isLucidExperiment({ ...writeCapture, recallText: '   ' })).toBe(false);
      expect(isLucidExperiment({ ...writeCapture, recallText: undefined })).toBe(false);
      expect(isLucidExperiment({ ...writeCapture, cueOutcome: undefined })).toBe(false);
      expect(
        isLucidExperiment({
          ...writeCapture,
          captureMode: 'speak',
          voiceCapture: 'stub',
        })
      ).toBe(true);
      expect(
        isLucidExperiment({
          ...writeCapture,
          captureMode: 'speak',
          voiceCapture: undefined,
        })
      ).toBe(false);
    });

    it('rejects every new-only morning-capture field when captureMode is absent', () => {
      expect(isLucidExperiment(legacy)).toBe(true);
      expect(isLucidExperiment({ ...legacy, recallText: 'the hallway' })).toBe(false);
      expect(isLucidExperiment({ ...legacy, cueOutcome: 'indeterminate' })).toBe(false);
      expect(isLucidExperiment({ ...legacy, voiceCapture: 'stub' })).toBe(false);
      expect(
        isLucidExperiment({
          ...legacy,
          techniqueAutoLink: {
            technique: 'mild',
            source: 'program_practice',
            practiceDate: '2026-08-26',
          },
        })
      ).toBe(false);
    });

    it('rejects malformed new-capture combinations while keeping legacy records intact', () => {
      expect(
        isLucidExperiment({
          ...writeCapture,
          captureMode: 'nothing_for_now',
          recallText: undefined,
          cueOutcome: 'not_heard',
        })
      ).toBe(true);
      expect(
        isLucidExperiment({
          ...writeCapture,
          captureMode: 'nothing_for_now',
          recallText: 'still a dream',
          cueOutcome: 'not_heard',
        })
      ).toBe(false);
      expect(
        isLucidExperiment({
          ...writeCapture,
          captureMode: 'nothing_for_now',
          recallText: undefined,
          voiceCapture: 'stub',
          cueOutcome: 'heard_woke',
        })
      ).toBe(false);
      expect(isLucidExperiment({ ...writeCapture, voiceCapture: 'stub' })).toBe(false);
      expect(
        isLucidExperiment({
          ...writeCapture,
          techniqueAutoLink: { technique: 'mild', source: 'guess', practiceDate: '2026-08-26' },
        })
      ).toBe(false);
      expect(
        isLucidExperiment({
          ...writeCapture,
          techniqueAutoLink: {
            technique: 'mild',
            source: 'program_practice',
            practiceDate: '2026-08-26',
          },
        })
      ).toBe(true);
      expect(isLucidExperiment({ ...legacy, technique: null })).toBe(false);
      expect(isLucidExperiment(legacy)).toBe(true);
    });
  });
});
