import {
  canAccessLucidSession,
  canUseLucidNightSignals,
  canUseLucidWbtb,
  DEFAULT_LUCID_SAFETY_FACTS,
  evaluateLucidSafetyPolicy,
  evaluateLucidSafetyPolicyFromState,
  evaluateLucidSessionAccess,
  getLucidNightSignalIntensity,
  getLucidSequentialSessionCursor,
  getLucidWbtbDenialReason,
  isLucidEmergencyNightStopAllowed,
  isLucidNightSignalIntensityReduced,
  LUCID_SAFETY_MODE_PRECEDENCE,
  LUCID_SAFETY_REASON_CODES,
  resolveLucidSafetyFacts,
  type LucidSafetyFacts,
  type LucidSafetyPolicy,
} from '@/lib/lucid/safety';

describe('Lucid session access policy', () => {
  const progress = {
    currentDay: 3,
    completedExerciseIds: ['mild-01', 'mild-02'],
    status: 'active' as const,
  };

  it('keeps the current sequential session open even if the calendar still says upcoming', () => {
    expect(
      evaluateLucidSessionAccess({
        sessionNumber: 3,
        sessionCount: 7,
        exerciseId: 'mild-03',
        progress,
        calendarStatus: 'upcoming',
      })
    ).toEqual({ allowed: true, reason: 'current' });
  });

  it('reopens a completed session and blocks a later sequential session', () => {
    expect(
      evaluateLucidSessionAccess({
        sessionNumber: 1,
        sessionCount: 7,
        exerciseId: 'mild-01',
        progress,
        calendarStatus: 'upcoming',
      })
    ).toEqual({ allowed: true, reason: 'completed' });

    expect(
      evaluateLucidSessionAccess({
        sessionNumber: 4,
        sessionCount: 7,
        exerciseId: 'mild-04',
        progress,
        calendarStatus: 'available',
      })
    ).toEqual({ allowed: false, reason: 'sequential_lock' });
  });

  it('does not treat a recommended calendar date as a sequential lock', () => {
    expect(
      canAccessLucidSession({
        sessionNumber: 1,
        sessionCount: 7,
        exerciseId: 'mild-01',
        progress: { currentDay: 1, completedExerciseIds: [], status: 'active' as const },
        calendarStatus: 'upcoming',
      })
    ).toBe(true);
    expect(getLucidSequentialSessionCursor(undefined)).toBe(1);
  });

  it('rejects an out-of-range session number', () => {
    expect(
      evaluateLucidSessionAccess({
        sessionNumber: 8,
        sessionCount: 7,
        progress,
      })
    ).toEqual({ allowed: false, reason: 'invalid' });
  });

  it('blocks the current session of a paused program while keeping completed history open', () => {
    const paused = {
      currentDay: 3,
      completedExerciseIds: ['mild-01', 'mild-02'],
      status: 'paused' as const,
    };

    expect(
      evaluateLucidSessionAccess({
        sessionNumber: 3,
        sessionCount: 7,
        exerciseId: 'mild-03',
        progress: paused,
      })
    ).toEqual({ allowed: false, reason: 'paused' });

    expect(
      evaluateLucidSessionAccess({
        sessionNumber: 2,
        sessionCount: 7,
        exerciseId: 'mild-02',
        progress: paused,
      })
    ).toEqual({ allowed: true, reason: 'completed' });

    expect(
      canAccessLucidSession({
        sessionNumber: 3,
        sessionCount: 7,
        exerciseId: 'mild-03',
        progress: paused,
      })
    ).toBe(false);
  });
});

describe('LucidSafetyPolicy', () => {
  function facts(overrides: Partial<LucidSafetyFacts> = {}): LucidSafetyFacts {
    return { ...DEFAULT_LUCID_SAFETY_FACTS, ...overrides };
  }

  function consentedFacts(overrides: Partial<LucidSafetyFacts> = {}): LucidSafetyFacts {
    return facts({ ...overrides, audioConsented: true });
  }

  function expectAuthorizations(
    policy: LucidSafetyPolicy,
    expected: Pick<LucidSafetyPolicy, 'allowWbtb' | 'allowNightSignals' | 'nightSignalIntensity'>
  ) {
    expect(policy.allowWbtb).toBe(expected.allowWbtb);
    expect(policy.allowNightSignals).toBe(expected.allowNightSignals);
    expect(policy.nightSignalIntensity).toBe(expected.nightSignalIntensity);
    expect(policy.emergencyStopAllowed).toBe(true);
  }

  describe('mode precedence', () => {
    it('keeps the current safe night behavior in normal mode when audio is explicitly consented', () => {
      expect(evaluateLucidSafetyPolicy(consentedFacts())).toEqual({
        mode: 'normal',
        allowWbtb: true,
        allowNightSignals: true,
        nightSignalIntensity: 'normal',
        emergencyStopAllowed: true,
        reasons: [],
      });
    });

    it('fail-closes DEFAULT_LUCID_SAFETY_FACTS without explicit audio consent', () => {
      const policy = evaluateLucidSafetyPolicy(DEFAULT_LUCID_SAFETY_FACTS);
      expect(DEFAULT_LUCID_SAFETY_FACTS.audioConsented).toBe(false);
      expect(policy.mode).toBe('nightFeaturesBlocked');
      expect(policy.allowNightSignals).toBe(false);
      expect(policy.reasons).toEqual(['audio_not_consented']);
    });

    it('selects nightFeaturesBlocked over recovery, reduced intensity, and mixed sleep facts', () => {
      expect(
        evaluateLucidSafetyPolicy(
          facts({
            audioConsented: false,
            hearingConcern: true,
            recoveryRequested: true,
            recentSleepDegraded: true,
            sleepIsFragile: true,
          })
        ).mode
      ).toBe('nightFeaturesBlocked');

      expect(
        evaluateLucidSafetyPolicy(facts({ audioConsented: false, recoveryRequested: true })).mode
      ).toBe('nightFeaturesBlocked');

      expect(
        evaluateLucidSafetyPolicy(
          consentedFacts({ hearingConcern: true, recentSleepDegraded: true })
        ).mode
      ).toBe('nightFeaturesBlocked');
    });

    it('selects recovery over reduced intensity', () => {
      expect(
        evaluateLucidSafetyPolicy(
          consentedFacts({ recoveryRequested: true, recentSleepDegraded: true })
        ).mode
      ).toBe('recovery');
      expect(
        evaluateLucidSafetyPolicy(consentedFacts({ recoveryRequested: true, sleepIsFragile: true }))
          .mode
      ).toBe('recovery');
    });

    it('selects reducedIntensity over normal for degraded or fragile sleep', () => {
      expect(evaluateLucidSafetyPolicy(consentedFacts({ recentSleepDegraded: true })).mode).toBe(
        'reducedIntensity'
      );
      expect(evaluateLucidSafetyPolicy(consentedFacts({ sleepIsFragile: true })).mode).toBe(
        'reducedIntensity'
      );
    });

    it('uses a stable most-restrictive-first precedence list', () => {
      expect(LUCID_SAFETY_MODE_PRECEDENCE).toEqual([
        'nightFeaturesBlocked',
        'recovery',
        'reducedIntensity',
        'normal',
      ]);
    });
  });

  describe('reason determinism and order', () => {
    it('emits only canonical codes in a fixed order', () => {
      const policy = evaluateLucidSafetyPolicy(
        facts({
          recentSleepDegraded: true,
          recoveryRequested: true,
          sleepIsFragile: true,
          hearingConcern: true,
          audioConsented: false,
        })
      );

      expect(policy.reasons).toEqual([...LUCID_SAFETY_REASON_CODES]);
      expect(policy.reasons).toEqual([
        'audio_not_consented',
        'hearing_concern',
        'recovery_requested',
        'fragile_sleep',
        'recent_sleep_degraded',
      ]);
    });

    it('is deterministic regardless of input property order', () => {
      const left = evaluateLucidSafetyPolicy({
        recentSleepDegraded: true,
        hearingConcern: true,
        audioConsented: true,
        sleepIsFragile: false,
        recoveryRequested: true,
      });
      const right = evaluateLucidSafetyPolicy({
        audioConsented: true,
        recoveryRequested: true,
        sleepIsFragile: false,
        hearingConcern: true,
        recentSleepDegraded: true,
      });

      expect(left).toEqual(right);
      expect(left.reasons).toEqual(['hearing_concern', 'recovery_requested', 'recent_sleep_degraded']);
      expect(evaluateLucidSafetyPolicy(consentedFacts({ recoveryRequested: true }))).toEqual(
        evaluateLucidSafetyPolicy(consentedFacts({ recoveryRequested: true }))
      );
    });
  });

  describe('WBTB, night signals, and emergency stop', () => {
    it('blocks WBTB and signals in recovery', () => {
      const policy = evaluateLucidSafetyPolicy(consentedFacts({ recoveryRequested: true }));
      expect(policy.mode).toBe('recovery');
      expect(policy.reasons).toEqual(['recovery_requested']);
      expectAuthorizations(policy, {
        allowWbtb: false,
        allowNightSignals: false,
        nightSignalIntensity: 'blocked',
      });
    });

    it('blocks WBTB and signals when night features are blocked', () => {
      const policy = evaluateLucidSafetyPolicy(facts({ audioConsented: false }));
      expect(policy.mode).toBe('nightFeaturesBlocked');
      expectAuthorizations(policy, {
        allowWbtb: false,
        allowNightSignals: false,
        nightSignalIntensity: 'blocked',
      });
    });

    it('blocks WBTB and reduces signal intensity when only recent sleep is degraded', () => {
      const policy = evaluateLucidSafetyPolicy(consentedFacts({ recentSleepDegraded: true }));
      expect(policy.mode).toBe('reducedIntensity');
      expect(policy.reasons).toEqual(['recent_sleep_degraded']);
      expectAuthorizations(policy, {
        allowWbtb: false,
        allowNightSignals: true,
        nightSignalIntensity: 'reduced',
      });
    });

    it('blocks signals in reducedIntensity when a safety fact requires it', () => {
      const policy = evaluateLucidSafetyPolicy(consentedFacts({ sleepIsFragile: true }));
      expect(policy.mode).toBe('reducedIntensity');
      expect(policy.reasons).toEqual(['fragile_sleep']);
      expectAuthorizations(policy, {
        allowWbtb: false,
        allowNightSignals: false,
        nightSignalIntensity: 'blocked',
      });
    });

    it('keeps the emergency night stop available in every mode', () => {
      const cases: LucidSafetyFacts[] = [
        consentedFacts(),
        consentedFacts({ recentSleepDegraded: true }),
        consentedFacts({ recoveryRequested: true }),
        facts({ audioConsented: false }),
        consentedFacts({ hearingConcern: true }),
        consentedFacts({ sleepIsFragile: true }),
      ];

      for (const input of cases) {
        const policy = evaluateLucidSafetyPolicy(input);
        expect(policy.emergencyStopAllowed).toBe(true);
        expect(isLucidEmergencyNightStopAllowed(input)).toBe(true);
        expect(isLucidEmergencyNightStopAllowed(policy)).toBe(true);
      }

      expect(isLucidEmergencyNightStopAllowed()).toBe(true);
    });
  });

  describe('audio consent, fragile sleep, and hearing concern', () => {
    it('blocks night features when audio is not consented', () => {
      const policy = evaluateLucidSafetyPolicy(facts({ audioConsented: false }));
      expect(policy.mode).toBe('nightFeaturesBlocked');
      expect(policy.reasons).toEqual(['audio_not_consented']);
      expect(policy.allowWbtb).toBe(false);
      expect(policy.allowNightSignals).toBe(false);
    });

    it('blocks night signals for fragile sleep without leaving reducedIntensity', () => {
      const policy = evaluateLucidSafetyPolicy(
        consentedFacts({ sleepIsFragile: true, recentSleepDegraded: true })
      );
      expect(policy.mode).toBe('reducedIntensity');
      expect(policy.reasons).toEqual(['fragile_sleep', 'recent_sleep_degraded']);
      expect(policy.allowWbtb).toBe(false);
      expect(policy.allowNightSignals).toBe(false);
      expect(policy.nightSignalIntensity).toBe('blocked');
    });

    it('blocks night features when a hearing concern is present', () => {
      const policy = evaluateLucidSafetyPolicy(consentedFacts({ hearingConcern: true }));
      expect(policy.mode).toBe('nightFeaturesBlocked');
      expect(policy.reasons).toEqual(['hearing_concern']);
      expect(policy.allowWbtb).toBe(false);
      expect(policy.allowNightSignals).toBe(false);
    });
  });

  describe('route and audio helpers', () => {
    it('mirrors policy decisions for WBTB, signals, and reduced intensity', () => {
      const normal = consentedFacts();
      const reduced = consentedFacts({ recentSleepDegraded: true });
      const blocked = consentedFacts({ hearingConcern: true });

      expect(canUseLucidWbtb(normal)).toBe(true);
      expect(canUseLucidNightSignals(normal)).toBe(true);
      expect(getLucidNightSignalIntensity(normal)).toBe('normal');
      expect(isLucidNightSignalIntensityReduced(normal)).toBe(false);

      expect(canUseLucidWbtb(reduced)).toBe(false);
      expect(canUseLucidNightSignals(reduced)).toBe(true);
      expect(getLucidNightSignalIntensity(reduced)).toBe('reduced');
      expect(isLucidNightSignalIntensityReduced(reduced)).toBe(true);

      const blockedPolicy = evaluateLucidSafetyPolicy(blocked);
      expect(canUseLucidWbtb(blockedPolicy)).toBe(false);
      expect(canUseLucidNightSignals(blockedPolicy)).toBe(false);
      expect(getLucidNightSignalIntensity(blockedPolicy)).toBe('blocked');
      expect(isLucidNightSignalIntensityReduced(blockedPolicy)).toBe(false);
    });
  });

  describe('persisted-state adapter', () => {
    it('maps only audioSafetyAccepted from persisted onboarding and fail-closes the rest', () => {
      expect(resolveLucidSafetyFacts()).toEqual(DEFAULT_LUCID_SAFETY_FACTS);
      expect(resolveLucidSafetyFacts({ onboarding: { audioSafetyAccepted: false } })).toEqual(
        DEFAULT_LUCID_SAFETY_FACTS
      );
      expect(resolveLucidSafetyFacts({ onboarding: { audioSafetyAccepted: true } })).toEqual({
        recoveryRequested: false,
        recentSleepDegraded: false,
        sleepIsFragile: false,
        hearingConcern: false,
        audioConsented: true,
      });
      expect(evaluateLucidSafetyPolicyFromState({ onboarding: { audioSafetyAccepted: true } })).toEqual(
        evaluateLucidSafetyPolicy(consentedFacts())
      );
    });

    it('does not infer recovery, degraded sleep, fragility, or hearing from storage', () => {
      const policy = evaluateLucidSafetyPolicyFromState({
        onboarding: { audioSafetyAccepted: true },
      });
      expect(policy.mode).toBe('normal');
      expect(policy.reasons).toEqual([]);
      expect(policy.allowWbtb).toBe(true);
    });

    it('lets explicit current facts force every safety fact, including false', () => {
      expect(
        resolveLucidSafetyFacts(
          { onboarding: { audioSafetyAccepted: false } },
          {
            audioConsented: true,
            recoveryRequested: true,
            recentSleepDegraded: true,
            sleepIsFragile: true,
            hearingConcern: true,
          }
        )
      ).toEqual({
        recoveryRequested: true,
        recentSleepDegraded: true,
        sleepIsFragile: true,
        hearingConcern: true,
        audioConsented: true,
      });

      expect(
        resolveLucidSafetyFacts(
          { onboarding: { audioSafetyAccepted: true } },
          { audioConsented: false, recentSleepDegraded: false }
        )
      ).toEqual(DEFAULT_LUCID_SAFETY_FACTS);

      const reduced = evaluateLucidSafetyPolicyFromState(
        { onboarding: { audioSafetyAccepted: true } },
        { recentSleepDegraded: true }
      );
      expect(reduced.mode).toBe('reducedIntensity');
      expect(reduced.allowWbtb).toBe(false);
      expect(reduced.allowNightSignals).toBe(true);
      expect(reduced.nightSignalIntensity).toBe('reduced');
      expect(getLucidWbtbDenialReason(reduced)).toBe('recent_sleep_degraded');

      const recovery = evaluateLucidSafetyPolicyFromState(
        { onboarding: { audioSafetyAccepted: true } },
        { recoveryRequested: true }
      );
      expect(recovery.mode).toBe('recovery');
      expect(recovery.allowWbtb).toBe(false);
      expect(recovery.allowNightSignals).toBe(false);
      expect(getLucidWbtbDenialReason(recovery)).toBe('recovery_requested');
      expect(getLucidWbtbDenialReason(consentedFacts())).toBeNull();
    });
  });
});
