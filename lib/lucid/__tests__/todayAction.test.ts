import { resolveLucidTodayAction } from '@/lib/lucid/todayAction';

const plan = {
  primaryAction: 'practice_mild' as const,
  intensity: 'normal' as const,
};

const policy = { mode: 'normal' as const };

const active = {
  technique: 'mild' as const,
  status: 'active' as const,
  currentDay: 3,
  completedExerciseIds: ['mild-01', 'mild-02'],
};

describe('resolveLucidTodayAction', () => {
  it('makes morning capture the only morning action even with an active program', () => {
    expect(resolveLucidTodayAction({ phase: 'morning', plan, policy, program: active })).toEqual({
      kind: 'morning_capture', copyKey: 'morning', route: '/lucid/morning',
    });
  });

  it('makes a mindful reality check the only daytime action', () => {
    expect(resolveLucidTodayAction({ phase: 'day', plan, policy, program: active })).toEqual({
      kind: 'reality_check', copyKey: 'reality', route: '/lucid/reality-check',
    });
  });

  it('opens the active guided session at bedtime when sequential access allows it', () => {
    expect(resolveLucidTodayAction({
      phase: 'bedtime', plan, policy, program: active, sessionCount: 7, sessionId: 'mild-03',
    })).toEqual({
      kind: 'guided_ritual', copyKey: 'ritual', route: '/lucid/session/mild/3',
      technique: 'mild', sessionNumber: 3,
    });
  });

  it('keeps paused-program resume explicit at bedtime and never opens its session', () => {
    expect(resolveLucidTodayAction({
      phase: 'bedtime', plan, policy, program: { ...active, status: 'paused' },
      sessionCount: 7, sessionId: 'mild-03',
    })).toEqual({
      kind: 'resume_program', copyKey: 'resumeProgram', route: '/lucid/program/mild', technique: 'mild',
    });
  });

  it('falls back to the program chooser when bedtime has no active ritual', () => {
    expect(resolveLucidTodayAction({ phase: 'bedtime', plan, policy })).toEqual({
      kind: 'choose_program', copyKey: 'chooseProgram', route: '/lucid/(tabs)/programs',
    });
  });

  it('opens quiet Night tools during the sleep phase in normal mode', () => {
    expect(resolveLucidTodayAction({ phase: 'sleep', plan, policy, program: active })).toEqual({
      kind: 'night_tools', copyKey: 'night', route: '/lucid/(tabs)/night',
    });
  });

  it.each([
    [{ mode: 'recovery' as const }, plan],
    [policy, { primaryAction: 'protect_sleep' as const, intensity: 'recovery' as const }],
  ])('routes sleep recovery away from night interruptions', (safety, currentPlan) => {
    expect(resolveLucidTodayAction({
      phase: 'sleep', plan: currentPlan, policy: safety, program: active,
    })).toEqual({
      kind: 'sleep_recovery', copyKey: 'recovery', route: '/lucid/morning',
    });
  });

  it('returns identical output for identical inputs', () => {
    const input = { phase: 'bedtime' as const, plan, policy, program: active, sessionCount: 7, sessionId: 'mild-03' };
    expect(resolveLucidTodayAction(input)).toEqual(resolveLucidTodayAction(input));
  });
});
