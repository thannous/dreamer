import {
  classifyLucidRecallEvidence,
  getLucidDayPhase,
  getLucidGuidanceProfile,
  getLucidPersonalizedPlan,
  selectRecentLucidPlanObservations,
  type LucidPlanObservation,
  type LucidPlanPolicy,
} from '@/lib/lucid/personalization';
import type {
  LucidExperienceLevel,
  LucidGoal,
  LucidSleepSchedule,
} from '@/lib/lucid/model';

const GOALS: readonly LucidGoal[] = [
  'first_lucid_dream',
  'improve_recall',
  'more_frequent_lucidity',
  'stabilize_lucidity',
];

const EXPERIENCES: readonly LucidExperienceLevel[] = [
  'beginner',
  'occasional',
  'experienced',
];

const FOCUS_BY_GOAL = {
  first_lucid_dream: 'notice',
  improve_recall: 'recall',
  more_frequent_lucidity: 'frequency',
  stabilize_lucidity: 'stability',
} as const;

const GUIDANCE_BY_EXPERIENCE = {
  beginner: 'guided',
  occasional: 'balanced',
  experienced: 'concise',
} as const;

function utcDate(isoLocal: string): Date {
  return new Date(`${isoLocal}:00.000Z`);
}

function schedule(
  bedtime: string,
  wakeTime: string,
  timeZone = 'UTC'
): LucidSleepSchedule {
  return { bedtime, wakeTime, timeZone };
}

describe('getLucidGuidanceProfile', () => {
  it('uses prudent MILD/guided/notice defaults when goal and experience are null', () => {
    expect(getLucidGuidanceProfile({ goal: null, experience: null })).toEqual({
      focus: 'notice',
      guidance: 'guided',
      recommendedTechnique: 'mild',
      cautionWbtb: true,
    });
  });

  it('keeps prudent MILD defaults when only one of the two values is missing', () => {
    expect(getLucidGuidanceProfile({ goal: null, experience: 'occasional' })).toEqual({
      focus: 'notice',
      guidance: 'balanced',
      recommendedTechnique: 'mild',
      cautionWbtb: false,
    });
    expect(getLucidGuidanceProfile({ goal: null, experience: 'experienced' })).toEqual({
      focus: 'notice',
      guidance: 'concise',
      recommendedTechnique: 'mild',
      cautionWbtb: false,
    });
    expect(getLucidGuidanceProfile({ goal: 'first_lucid_dream', experience: null })).toEqual({
      focus: 'notice',
      guidance: 'guided',
      recommendedTechnique: 'mild',
      cautionWbtb: true,
    });
    expect(getLucidGuidanceProfile({ goal: 'more_frequent_lucidity', experience: null })).toEqual({
      focus: 'frequency',
      guidance: 'guided',
      recommendedTechnique: 'mild',
      cautionWbtb: true,
    });
  });

  it.each(GOALS.flatMap((goal) => EXPERIENCES.map((experience) => [goal, experience] as const)))(
    'maps %s / %s without ever recommending WBTB',
    (goal, experience) => {
      const profile = getLucidGuidanceProfile({ goal, experience });
      const ssild = experience !== 'beginner' && goal === 'more_frequent_lucidity';

      expect(profile.focus).toBe(FOCUS_BY_GOAL[goal]);
      expect(profile.guidance).toBe(GUIDANCE_BY_EXPERIENCE[experience]);
      expect(profile.recommendedTechnique).toBe(ssild ? 'ssild' : 'mild');
      expect(profile.cautionWbtb).toBe(experience === 'beginner');
      expect(profile.recommendedTechnique).not.toBe('wbtb');
    }
  );

  it('recommends SSILD only for more frequent lucidity after the beginner stage', () => {
    expect(
      getLucidGuidanceProfile({
        goal: 'more_frequent_lucidity',
        experience: 'beginner',
      }).recommendedTechnique
    ).toBe('mild');
    expect(
      getLucidGuidanceProfile({
        goal: 'more_frequent_lucidity',
        experience: 'occasional',
      }).recommendedTechnique
    ).toBe('ssild');
    expect(
      getLucidGuidanceProfile({
        goal: 'more_frequent_lucidity',
        experience: 'experienced',
      }).recommendedTechnique
    ).toBe('ssild');
  });
});

describe('getLucidDayPhase', () => {
  const overnight = schedule('22:30', '07:00');

  it.each([
    ['06:59', 'sleep'],
    ['07:00', 'morning'],
    ['08:59', 'morning'],
    ['09:00', 'day'],
    ['20:59', 'day'],
    ['21:00', 'bedtime'],
    ['22:29', 'bedtime'],
    ['22:30', 'sleep'],
    ['00:00', 'sleep'],
  ] as const)('classifies %s as %s across an overnight sleep window', (clock, phase) => {
    expect(getLucidDayPhase(utcDate(`2026-08-24T${clock}`), overnight)).toBe(phase);
  });

  it('keeps daytime sleepers on a same-calendar sleep window', () => {
    const siesta = schedule('13:00', '15:00');
    expect(getLucidDayPhase(utcDate('2026-08-24T12:59'), siesta)).toBe('bedtime');
    expect(getLucidDayPhase(utcDate('2026-08-24T13:00'), siesta)).toBe('sleep');
    expect(getLucidDayPhase(utcDate('2026-08-24T14:59'), siesta)).toBe('sleep');
    expect(getLucidDayPhase(utcDate('2026-08-24T15:00'), siesta)).toBe('morning');
    expect(getLucidDayPhase(utcDate('2026-08-24T16:59'), siesta)).toBe('morning');
    expect(getLucidDayPhase(utcDate('2026-08-24T17:00'), siesta)).toBe('day');
  });

  it('lets morning win when a short waking day overlaps bedtime', () => {
    const shortDay = schedule('08:00', '07:00');
    expect(getLucidDayPhase(utcDate('2026-08-24T07:30'), shortDay)).toBe('morning');
    expect(getLucidDayPhase(utcDate('2026-08-24T08:00'), shortDay)).toBe('sleep');
    expect(getLucidDayPhase(utcDate('2026-08-24T06:59'), shortDay)).toBe('sleep');
  });

  it('reads clock minutes in the schedule timezone, not the host timezone', () => {
    const paris = schedule('22:30', '07:00', 'Europe/Paris');
    expect(getLucidDayPhase(utcDate('2026-08-24T04:59'), paris)).toBe('sleep');
    expect(getLucidDayPhase(utcDate('2026-08-24T05:00'), paris)).toBe('morning');
    expect(getLucidDayPhase(utcDate('2026-08-24T19:00'), paris)).toBe('bedtime');
    expect(getLucidDayPhase(utcDate('2026-08-24T20:30'), paris)).toBe('sleep');
  });

  it('accepts an epoch timestamp as well as a Date', () => {
    expect(getLucidDayPhase(Date.UTC(2026, 7, 24, 7, 0, 0), overnight)).toBe('morning');
    expect(getLucidDayPhase(Date.UTC(2026, 7, 24, 22, 30, 0), overnight)).toBe('sleep');
  });
});

describe('getLucidPersonalizedPlan', () => {
  function observation(
    overrides: Partial<LucidPlanObservation> & Pick<LucidPlanObservation, 'id' | 'occurredAt'>
  ): LucidPlanObservation {
    return {
      updatedAt: overrides.occurredAt,
      factors: [],
      ...overrides,
    };
  }

  function remembered(id: string, occurredAt: number): LucidPlanObservation {
    return observation({
      id,
      occurredAt,
      recallText: 'a hallway',
      recallLevel: 3,
      result: 'pre_lucid',
    });
  }

  function noRecall(id: string, occurredAt: number): LucidPlanObservation {
    return observation({
      id,
      occurredAt,
      result: 'none',
      recallLevel: 0,
    });
  }

  const normalPolicy: LucidPlanPolicy = {
    mode: 'normal',
    allowWbtb: true,
    allowNightSignals: true,
  };

  it('does not mutate observations and sorts newest occurredAt, then updatedAt, then id', () => {
    const observations = [
      observation({ id: 'c', occurredAt: 10, updatedAt: 1 }),
      observation({ id: 'a', occurredAt: 10, updatedAt: 2 }),
      observation({ id: 'b', occurredAt: 11, updatedAt: 1 }),
      observation({ id: 'd', occurredAt: 9, updatedAt: 9 }),
    ];
    const frozen = observations.map((item) => Object.freeze({ ...item }));
    Object.freeze(frozen);
    const snapshot = frozen.map((item) => ({ ...item }));

    expect(selectRecentLucidPlanObservations(frozen).map((item) => item.id)).toEqual([
      'b',
      'a',
      'c',
      'd',
    ]);
    expect(frozen).toEqual(snapshot);
    expect(observations.map((item) => item.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('uses only the seven newest observations and ignores input order', () => {
    const newest = Array.from({ length: 7 }, (_, index) =>
      remembered(`new-${index}`, 100 + index)
    );
    const ignored = noRecall('old', 1);
    const mixed = [ignored, newest[3], newest[0], newest[6], newest[1], newest[5], newest[2], newest[4]];

    expect(selectRecentLucidPlanObservations(mixed).map((item) => item.id)).toEqual([
      'new-6',
      'new-5',
      'new-4',
      'new-3',
      'new-2',
      'new-1',
      'new-0',
    ]);
    expect(classifyLucidRecallEvidence(mixed)).toBe('sufficient');
    expect(classifyLucidRecallEvidence([ignored, ...newest])).toBe(
      classifyLucidRecallEvidence([...newest].reverse())
    );
  });

  it('treats nothing_for_now as unknown recall, never as no recall', () => {
    const deferred = [
      observation({
        id: 'n1',
        occurredAt: 1,
        captureMode: 'nothing_for_now',
        recallLevel: 0,
        result: 'none',
      }),
      observation({
        id: 'n2',
        occurredAt: 2,
        captureMode: 'nothing_for_now',
        recallLevel: 0,
        result: 'none',
      }),
    ];
    expect(classifyLucidRecallEvidence(deferred)).toBe('unknown');
    const plan = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'beginner',
      observations: deferred,
    });
    expect(plan.reasonCode).not.toBe('beginner_weak_recall');
    expect(plan.reasonCode).not.toBe('weak_recall');
  });

  it('classifies weak and sufficient recall from explicit evidence', () => {
    expect(classifyLucidRecallEvidence([noRecall('a', 1), noRecall('b', 2)])).toBe('weak');
    expect(
      classifyLucidRecallEvidence([
        observation({ id: 't', occurredAt: 1, recallText: '  scene  ' }),
        observation({ id: 'r', occurredAt: 2, recallLevel: 1 }),
      ])
    ).toBe('sufficient');
    expect(
      classifyLucidRecallEvidence([
        observation({ id: 'p', occurredAt: 1, result: 'pre_lucid' }),
        observation({ id: 'l', occurredAt: 2, result: 'lucid' }),
      ])
    ).toBe('sufficient');
  });

  it('prioritizes recall for a beginner with weak recall and never recommends WBTB', () => {
    const plan = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'beginner',
      observations: [noRecall('a', 1), noRecall('b', 2)],
    });
    expect(plan).toMatchObject({
      reasonCode: 'beginner_weak_recall',
      primaryAction: 'strengthen_recall',
      focus: 'recall',
      guidance: 'guided',
      recommendedTechnique: null,
      cautionWbtb: true,
      allowWbtb: false,
    });
    expect(plan.recommendedTechnique).not.toBe('wbtb');
  });

  it('guides MILD when recall is sufficient and the goal is a first lucid dream', () => {
    const plan = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'occasional',
      observations: [remembered('a', 1), remembered('b', 2)],
      policy: normalPolicy,
    });
    expect(plan).toMatchObject({
      reasonCode: 'first_lucid_mild',
      primaryAction: 'practice_mild',
      recommendedTechnique: 'mild',
      focus: 'notice',
      guidance: 'guided',
      intensity: 'normal',
      allowWbtb: true,
      allowNightSignals: true,
    });
    expect(plan.recommendedTechnique).not.toBe('wbtb');
  });

  it('enters recovery and suspends WBTB and night signals when recent sleep is degraded', () => {
    const byQuality = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'experienced',
      observations: [
        remembered('ok', 1),
        remembered('low', 2),
        observation({ id: 'sleep', occurredAt: 3, sleepQuality: 2, recallText: 'still a scene' }),
      ],
    });
    expect(byQuality).toMatchObject({
      reasonCode: 'sleep_recovery',
      primaryAction: 'protect_sleep',
      intensity: 'recovery',
      recommendedTechnique: null,
      allowWbtb: false,
      allowNightSignals: false,
    });

    const byDebt = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'experienced',
      observations: [
        remembered('ok', 1),
        observation({
          id: 'debt',
          occurredAt: 4,
          sleepQuality: 4,
          factors: ['sleep_debt'],
          recallText: 'still a scene',
        }),
      ],
    });
    expect(byDebt.reasonCode).toBe('sleep_recovery');
    expect(byDebt.allowNightSignals).toBe(false);
  });

  it('reduces intensity and blocks signals after two heard_woke cues in the last seven', () => {
    const observations = [
      observation({ id: '1', occurredAt: 1, cueOutcome: 'heard_woke', recallText: 'a' }),
      observation({ id: '2', occurredAt: 2, cueOutcome: 'not_heard', recallText: 'b' }),
      observation({ id: '3', occurredAt: 3, cueOutcome: 'heard_woke', recallText: 'c' }),
    ];
    const plan = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'occasional',
      observations,
      policy: { mode: 'reducedIntensity', allowWbtb: false, allowNightSignals: true, reasons: ['repeated_signal_wakeups'] },
    });
    expect(plan).toMatchObject({
      reasonCode: 'repeated_signal_wakeups',
      primaryAction: 'reduce_night_signals',
      intensity: 'reduced',
      recommendedTechnique: 'mild',
      allowWbtb: false,
      allowNightSignals: true,
    });
  });

  it('lets sleep recovery take precedence over repeated cue wakeups', () => {
    const plan = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'occasional',
      observations: [
        observation({
          id: '1',
          occurredAt: 1,
          cueOutcome: 'heard_woke',
          recallText: 'a',
          sleepQuality: 5,
        }),
        observation({
          id: '2',
          occurredAt: 2,
          cueOutcome: 'heard_woke',
          recallText: 'b',
          sleepQuality: 1,
        }),
      ],
    });
    expect(plan.reasonCode).toBe('sleep_recovery');
    expect(plan.intensity).toBe('recovery');
  });

  it('returns the same plan for the same facts regardless of observation order', () => {
    const observations = [
      noRecall('z', 1),
      remembered('m', 5),
      observation({ id: 'w1', occurredAt: 3, cueOutcome: 'heard_woke', recallLevel: 2 }),
      observation({ id: 'w2', occurredAt: 4, cueOutcome: 'heard_woke', recallText: 'x' }),
    ];
    const input = {
      goal: 'first_lucid_dream' as const,
      experience: 'beginner' as const,
      observations,
      policy: normalPolicy,
    };
    expect(getLucidPersonalizedPlan(input)).toEqual(
      getLucidPersonalizedPlan({
        ...input,
        observations: [...observations].reverse(),
      })
    );
    expect(getLucidPersonalizedPlan(input)).toEqual(getLucidPersonalizedPlan(input));
  });

  it.each(GOALS.flatMap((goal) => EXPERIENCES.map((experience) => [goal, experience] as const)))(
    'never recommends WBTB for %s / %s',
    (goal, experience) => {
      const plan = getLucidPersonalizedPlan({
        goal,
        experience,
        observations: [remembered('a', 1), remembered('b', 2), noRecall('c', 3)],
        policy: normalPolicy,
      });
      expect(plan.reasonCode).toBeTruthy();
      expect(plan.recommendedTechnique).not.toBe('wbtb');
      expect(['mild', 'ssild', null]).toContain(plan.recommendedTechnique);
    }
  );

  it('fail-closes WBTB and night signals when no policy is supplied', () => {
    const plan = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'experienced',
      observations: [remembered('a', 1), remembered('b', 2)],
    });
    expect(plan.allowWbtb).toBe(false);
    expect(plan.allowNightSignals).toBe(false);
  });

  it('opens only what the plan still allows under an explicit normal policy', () => {
    const experienced = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'experienced',
      observations: [remembered('a', 1), remembered('b', 2)],
      policy: normalPolicy,
    });
    expect(experienced.allowWbtb).toBe(true);
    expect(experienced.allowNightSignals).toBe(true);

    const beginner = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'beginner',
      observations: [noRecall('a', 1), noRecall('b', 2)],
      policy: normalPolicy,
    });
    expect(beginner.allowWbtb).toBe(false);
    expect(beginner.allowNightSignals).toBe(true);
  });

  it('cannot be opened by observations when the explicit policy denies night features', () => {
    const plan = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'experienced',
      observations: [remembered('a', 1), remembered('b', 2)],
      policy: { mode: 'normal', allowWbtb: false, allowNightSignals: false },
    });
    expect(plan.allowWbtb).toBe(false);
    expect(plan.allowNightSignals).toBe(false);
    expect(plan.reasonCode).toBe('first_lucid_mild');
  });

  it('applies explicit recovery and reduced policies when observations are not more restrictive', () => {
    const recovery = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'experienced',
      observations: [remembered('a', 1), remembered('b', 2)],
      policy: { mode: 'recovery', allowWbtb: false, allowNightSignals: false },
    });
    expect(recovery).toMatchObject({
      reasonCode: 'policy_recovery',
      primaryAction: 'protect_sleep',
      intensity: 'recovery',
      recommendedTechnique: null,
      allowWbtb: false,
      allowNightSignals: false,
    });

    const reduced = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'experienced',
      observations: [remembered('a', 1), remembered('b', 2)],
      policy: {
        mode: 'reducedIntensity',
        allowWbtb: false,
        allowNightSignals: true,
        reasons: ['repeated_signal_wakeups'],
      },
    });
    expect(reduced).toMatchObject({
      reasonCode: 'policy_reduced',
      primaryAction: 'reduce_night_signals',
      intensity: 'reduced',
      recommendedTechnique: 'mild',
      allowWbtb: false,
      allowNightSignals: true,
    });
  });

  it('keeps observation sleep recovery readable over an explicit reduced policy', () => {
    const plan = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'experienced',
      observations: [
        remembered('ok', 1),
        observation({ id: 'sleep', occurredAt: 3, sleepQuality: 1, recallText: 'still a scene' }),
      ],
      policy: { mode: 'reducedIntensity', allowWbtb: false, allowNightSignals: false },
    });
    expect(plan.reasonCode).toBe('sleep_recovery');
    expect(plan.intensity).toBe('recovery');
  });

  it('does not treat nightFeaturesBlocked as policy_reduced or change the technique plan', () => {
    const plan = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'experienced',
      observations: [remembered('a', 1), remembered('b', 2)],
      policy: {
        mode: 'nightFeaturesBlocked',
        allowWbtb: false,
        allowNightSignals: false,
        reasons: ['audio_not_consented'],
      },
    });
    expect(plan).toMatchObject({
      reasonCode: 'first_lucid_mild',
      primaryAction: 'practice_mild',
      recommendedTechnique: 'mild',
      intensity: 'normal',
      allowWbtb: false,
      allowNightSignals: false,
    });
    expect(plan.reasonCode).not.toBe('policy_reduced');
  });

  it('turns nightFeaturesBlocked with sleep or recovery reasons into recovery', () => {
    const sleep = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'experienced',
      observations: [remembered('a', 1), remembered('b', 2)],
      policy: {
        mode: 'nightFeaturesBlocked',
        allowWbtb: false,
        allowNightSignals: false,
        reasons: ['audio_not_consented', 'recent_sleep_degraded'],
      },
    });
    expect(sleep).toMatchObject({
      reasonCode: 'policy_recovery',
      primaryAction: 'protect_sleep',
      intensity: 'recovery',
      allowWbtb: false,
      allowNightSignals: false,
    });

    const requested = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'experienced',
      observations: [remembered('a', 1), remembered('b', 2)],
      policy: {
        mode: 'nightFeaturesBlocked',
        allowWbtb: false,
        allowNightSignals: false,
        reasons: ['audio_not_consented', 'recovery_requested'],
      },
    });
    expect(requested.reasonCode).toBe('policy_recovery');
    expect(requested.allowNightSignals).toBe(false);
  });

  it('keeps reduce_night_signals when nightFeaturesBlocked includes repeated wakeups, with signals still closed', () => {
    const plan = getLucidPersonalizedPlan({
      goal: 'first_lucid_dream',
      experience: 'experienced',
      observations: [remembered('a', 1), remembered('b', 2)],
      policy: {
        mode: 'nightFeaturesBlocked',
        allowWbtb: false,
        allowNightSignals: false,
        reasons: ['audio_not_consented', 'repeated_signal_wakeups'],
      },
    });
    expect(plan).toMatchObject({
      reasonCode: 'policy_reduced',
      primaryAction: 'reduce_night_signals',
      intensity: 'reduced',
      allowWbtb: false,
      allowNightSignals: false,
    });
  });

  it('uses recall_goal and strengthen_recall when the goal is to improve recall', () => {
    const plan = getLucidPersonalizedPlan({
      goal: 'improve_recall',
      experience: 'occasional',
      observations: [remembered('a', 1), remembered('b', 2)],
      policy: normalPolicy,
    });
    expect(plan).toMatchObject({
      reasonCode: 'recall_goal',
      primaryAction: 'strengthen_recall',
      focus: 'recall',
      recommendedTechnique: 'mild',
      allowNightSignals: true,
    });
  });
});
