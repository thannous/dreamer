import { createInitialLucidTrainerState, createLucidProgramProgress, mergeLucidProgramProgress } from '@/lib/lucid/domain';
import {
  abandonLucidGuidedRitualProgress,
  advanceLucidGuidedRitualProgress,
  completeLucidGuidedRitualProgress,
  createLucidGuidedRitualPlan,
  createLucidGuidedRitualProgress,
  resumeLucidGuidedRitualProgress,
  selectLucidMildRehearsalSource,
} from '@/lib/lucid/guidedRitual';
import {
  isLucidGuidedRitualProgress,
  isLucidProgramProgress,
} from '@/lib/lucid/model';
import type { LucidSafetyMode, LucidSafetyPolicy } from '@/lib/lucid/safety';

const NOW = 1_700_000_000_000;

function policy(
  mode: LucidSafetyMode,
  overrides: Partial<LucidSafetyPolicy> = {}
): LucidSafetyPolicy {
  return {
    mode,
    allowWbtb: mode === 'normal',
    allowNightSignals: mode === 'normal',
    nightSignalIntensity: mode === 'normal' ? 'normal' : 'blocked',
    emergencyStopAllowed: true,
    reasons: [],
    ...overrides,
  };
}

describe('Lucid guided ritual plans', () => {
  it('builds exact five-minute full plans for MILD and SSILD', () => {
    for (const technique of ['mild', 'ssild'] as const) {
      const plan = createLucidGuidedRitualPlan(technique, policy('normal'));
      expect(plan.status).toBe('ready');
      if (plan.status !== 'ready') throw new Error('Expected a ready plan');
      expect(plan.mode).toBe('full');
      expect(plan.totalDurationSeconds).toBe(300);
      expect(plan.phases.reduce((sum, phase) => sum + phase.durationSeconds, 0)).toBe(300);
      expect(plan.soundAllowed).toBe(true);
    }
  });

  it('reduces fragile-sleep practice to three minutes', () => {
    const plan = createLucidGuidedRitualPlan(
      'ssild',
      policy('reducedIntensity', {
        allowNightSignals: false,
        nightSignalIntensity: 'blocked',
        reasons: ['fragile_sleep'],
      })
    );
    expect(plan).toMatchObject({
      status: 'ready',
      technique: 'ssild',
      mode: 'reduced',
      totalDurationSeconds: 180,
      soundAllowed: false,
    });
  });

  it('replaces degraded-sleep practice with a three-minute recovery ritual', () => {
    const plan = createLucidGuidedRitualPlan(
      'mild',
      policy('recovery', {
        allowWbtb: false,
        allowNightSignals: false,
        nightSignalIntensity: 'blocked',
        reasons: ['recent_sleep_degraded'],
      })
    );
    expect(plan).toMatchObject({
      status: 'ready',
      mode: 'replacement',
      objective: 'protect_sleep',
      totalDurationSeconds: 180,
    });
    if (plan.status !== 'ready') throw new Error('Expected a ready plan');
    expect(plan.phases.map((phase) => phase.id)).toEqual([
      'recovery_settle',
      'recovery_release',
    ]);
  });

  it('keeps a cognitive ritual available silently while blocking WBTB and unknown techniques', () => {
    const silent = createLucidGuidedRitualPlan(
      'mild',
      policy('nightFeaturesBlocked', {
        allowWbtb: false,
        allowNightSignals: false,
        nightSignalIntensity: 'blocked',
        reasons: ['audio_not_consented'],
      })
    );
    expect(silent).toMatchObject({ status: 'ready', mode: 'full', soundAllowed: false });
    expect(createLucidGuidedRitualPlan('wbtb', policy('normal'))).toEqual({
      status: 'blocked',
      reason: 'wbtb_blocked',
    });
    expect(createLucidGuidedRitualPlan('other', policy('normal'))).toEqual({
      status: 'blocked',
      reason: 'unsupported_technique',
    });
  });
});

describe('Lucid guided ritual progress', () => {
  const fullPlan = createLucidGuidedRitualPlan('mild', policy('normal'));
  if (fullPlan.status !== 'ready') throw new Error('Expected a ready plan');

  it('creates, advances, abandons, resumes and completes with monotone timestamps', () => {
    let progress = createLucidGuidedRitualProgress({
      plan: fullPlan,
      sessionId: 'mild:mild-01',
      now: NOW,
    });
    expect(isLucidGuidedRitualProgress(progress, 'mild')).toBe(true);

    progress = advanceLucidGuidedRitualProgress(progress, NOW);
    expect(progress).toMatchObject({ stepIndex: 1, updatedAt: NOW + 1 });
    progress = abandonLucidGuidedRitualProgress(progress, NOW);
    expect(progress).toMatchObject({ status: 'abandoned', stepIndex: 1, updatedAt: NOW + 2 });
    progress = resumeLucidGuidedRitualProgress(progress, NOW);
    expect(progress).toMatchObject({ status: 'in_progress', stepIndex: 1, updatedAt: NOW + 3 });

    while (progress.stepIndex < progress.stepCount - 1) {
      progress = advanceLucidGuidedRitualProgress(progress, NOW);
    }
    progress = completeLucidGuidedRitualProgress(progress, NOW);
    expect(progress.status).toBe('completed');
    expect(progress.completedAt).toBe(progress.updatedAt);
    expect(isLucidGuidedRitualProgress(progress, 'mild')).toBe(true);
  });

  it('rejects invalid transitions and strict invalid persisted shapes', () => {
    const progress = createLucidGuidedRitualProgress({
      plan: fullPlan,
      sessionId: 'mild:mild-01',
      now: NOW,
    });
    expect(() => completeLucidGuidedRitualProgress(progress, NOW + 1)).toThrow(
      'final phase'
    );
    expect(isLucidGuidedRitualProgress({ ...progress, stepIndex: progress.stepCount })).toBe(false);
    expect(isLucidGuidedRitualProgress({
      ...progress,
      status: 'completed',
      completedAt: null,
    })).toBe(false);
    expect(isLucidGuidedRitualProgress({ ...progress, technique: 'wbtb' })).toBe(false);
  });

  it('keeps legacy program progress valid and validates an additive guided ritual', () => {
    const legacy = createLucidProgramProgress('mild', NOW);
    const guidedRitual = createLucidGuidedRitualProgress({
      plan: fullPlan,
      sessionId: 'mild:mild-01',
      now: NOW,
    });
    expect(isLucidProgramProgress(legacy)).toBe(true);
    expect(isLucidProgramProgress({ ...legacy, guidedRitual })).toBe(true);
    expect(isLucidProgramProgress({
      ...legacy,
      guidedRitual: { ...guidedRitual, technique: 'ssild' },
    })).toBe(false);
  });

  it('preserves the newest guided ritual when merging with legacy or concurrent progress', () => {
    const legacy = createLucidProgramProgress('mild', NOW + 100);
    const first = createLucidGuidedRitualProgress({
      plan: fullPlan,
      sessionId: 'mild:mild-01',
      now: NOW,
    });
    const advanced = advanceLucidGuidedRitualProgress(first, NOW + 1);
    const withFirst = { ...createLucidProgramProgress('mild', NOW), guidedRitual: first };
    const withAdvanced = {
      ...createLucidProgramProgress('mild', NOW + 1),
      guidedRitual: advanced,
    };

    expect(mergeLucidProgramProgress(legacy, withFirst).guidedRitual).toEqual(first);
    expect(mergeLucidProgramProgress(withFirst, withAdvanced).guidedRitual).toEqual(advanced);
    const state = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    expect(state.progress).toEqual([]);
  });
});

describe('MILD rehearsal source selection', () => {
  const confirmedSigns = [{
    id: 'sign:mirror',
    label: 'Mirror',
    category: 'object' as const,
    distinctDreamCount: 2,
    sourceDreamIds: ['100', '300'],
  }];

  it('selects the newest source-linked dream and returns bounded verbatim content', () => {
    const source = selectLucidMildRehearsalSource(
      [
        { id: 100, title: 'Old mirror', transcript: 'I saw a mirror.' },
        { id: 300, title: 'Recent mirror', transcript: `Mirror ${'x'.repeat(220)}` },
        { id: 400, title: 'Unlinked', transcript: 'No confirmed sign here.' },
      ],
      confirmedSigns
    );
    expect(source).toMatchObject({
      dreamId: '300',
      dreamTitle: 'Recent mirror',
      signId: 'sign:mirror',
      signLabel: 'Mirror',
    });
    expect(source?.dreamExcerpt.length).toBeLessThanOrEqual(180);
    expect(source?.dreamExcerpt.startsWith('Mirror')).toBe(true);
  });

  it('returns null rather than inferring a sign or dream', () => {
    expect(selectLucidMildRehearsalSource(
      [{ id: 400, title: 'Unlinked', transcript: 'A dream.' }],
      confirmedSigns
    )).toBeNull();
    expect(selectLucidMildRehearsalSource(
      [{ id: 300, title: 'Recent mirror', transcript: 'A dream.' }],
      []
    )).toBeNull();
  });
});
