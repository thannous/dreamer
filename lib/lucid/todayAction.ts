import type { LucidProgramProgress } from '@/lib/lucid/model';
import type { LucidDayPhase, LucidPersonalizedPlan } from '@/lib/lucid/personalization';
import { evaluateLucidSessionAccess, type LucidSafetyPolicy } from '@/lib/lucid/safety';

export type LucidTodayActionKind =
  | 'morning_capture'
  | 'reality_check'
  | 'guided_ritual'
  | 'choose_program'
  | 'resume_program'
  | 'night_tools'
  | 'sleep_recovery';

export type LucidTodayActionCopyKey =
  | 'morning'
  | 'reality'
  | 'ritual'
  | 'chooseProgram'
  | 'resumeProgram'
  | 'night'
  | 'recovery';

export type LucidTodayActionRoute =
  | '/lucid/morning'
  | '/lucid/reality-check'
  | '/lucid/(tabs)/night'
  | '/lucid/(tabs)/programs'
  | `/lucid/program/${LucidProgramProgress['technique']}`
  | `/lucid/session/${LucidProgramProgress['technique']}/${number}`;

export type LucidTodayAction = {
  kind: LucidTodayActionKind;
  copyKey: LucidTodayActionCopyKey;
  route: LucidTodayActionRoute;
  technique?: LucidProgramProgress['technique'];
  sessionNumber?: number;
};

export type LucidTodayActionInput = {
  phase: LucidDayPhase;
  plan: Pick<LucidPersonalizedPlan, 'primaryAction' | 'intensity'>;
  policy: Pick<LucidSafetyPolicy, 'mode'>;
  program?: Pick<
    LucidProgramProgress,
    'technique' | 'status' | 'currentDay' | 'completedExerciseIds'
  > | null;
  sessionCount?: number;
  sessionId?: string | null;
};

const MORNING_ACTION: LucidTodayAction = {
  kind: 'morning_capture',
  copyKey: 'morning',
  route: '/lucid/morning',
};

const REALITY_ACTION: LucidTodayAction = {
  kind: 'reality_check',
  copyKey: 'reality',
  route: '/lucid/reality-check',
};

/**
 * Resolves the only primary action Today may expose. Phase owns the decision;
 * program progress remains secondary except when bedtime needs a ritual.
 */
export function resolveLucidTodayAction(input: LucidTodayActionInput): LucidTodayAction {
  if (input.phase === 'morning') return MORNING_ACTION;
  if (input.phase === 'day') return REALITY_ACTION;

  if (input.phase === 'sleep') {
    const recovery =
      input.policy.mode === 'recovery' ||
      input.plan.intensity === 'recovery' ||
      input.plan.primaryAction === 'protect_sleep';
    return recovery
      ? { kind: 'sleep_recovery', copyKey: 'recovery', route: '/lucid/morning' }
      : { kind: 'night_tools', copyKey: 'night', route: '/lucid/(tabs)/night' };
  }

  const program = input.program;
  if (program?.status === 'paused') {
    return {
      kind: 'resume_program',
      copyKey: 'resumeProgram',
      route: `/lucid/program/${program.technique}`,
      technique: program.technique,
    };
  }

  if (program?.status === 'active' && input.sessionId && input.sessionCount) {
    const access = evaluateLucidSessionAccess({
      sessionNumber: program.currentDay,
      sessionCount: input.sessionCount,
      exerciseId: input.sessionId,
      progress: program,
    });
    if (access.allowed) {
      return {
        kind: 'guided_ritual',
        copyKey: 'ritual',
        route: `/lucid/session/${program.technique}/${program.currentDay}`,
        technique: program.technique,
        sessionNumber: program.currentDay,
      };
    }
    return {
      kind: 'resume_program',
      copyKey: 'resumeProgram',
      route: `/lucid/program/${program.technique}`,
      technique: program.technique,
    };
  }

  return {
    kind: 'choose_program',
    copyKey: 'chooseProgram',
    route: '/lucid/(tabs)/programs',
  };
}
