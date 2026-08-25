import type { LucidProgramCalendarStatus } from '@/lib/lucid/calendar';
import type { LucidProgramProgress } from '@/lib/lucid/model';

export type LucidSessionAccessReason =
  | 'invalid'
  | 'completed'
  | 'current'
  | 'previous'
  | 'sequential_lock';

export type LucidSessionAccess = {
  allowed: boolean;
  reason: LucidSessionAccessReason;
};

export type LucidSessionAccessInput = {
  sessionNumber: number;
  sessionCount: number;
  exerciseId?: string;
  progress?: Pick<LucidProgramProgress, 'currentDay' | 'completedExerciseIds'> | null;
  /**
   * Recommended cadence only. Calendar statuses such as `upcoming` never lock
   * or unlock a session; sequential progress is the only access gate.
   */
  calendarStatus?: LucidProgramCalendarStatus;
};

export function getLucidSequentialSessionCursor(
  progress?: Pick<LucidProgramProgress, 'currentDay'> | null
): number {
  const day = progress?.currentDay ?? 1;
  return Number.isInteger(day) && day >= 1 ? day : 1;
}

export function isLucidSessionCompleted(
  progress: Pick<LucidProgramProgress, 'completedExerciseIds'> | null | undefined,
  exerciseId: string
): boolean {
  return Boolean(exerciseId) && Boolean(progress?.completedExerciseIds.includes(exerciseId));
}

/**
 * Sequential lock: a later session cannot run until the program cursor reaches it.
 * Completed sessions stay reopenable. The practice calendar is not consulted.
 */
export function evaluateLucidSessionAccess(input: LucidSessionAccessInput): LucidSessionAccess {
  const { sessionNumber, sessionCount, exerciseId, progress } = input;
  if (
    !Number.isInteger(sessionNumber) ||
    !Number.isInteger(sessionCount) ||
    sessionNumber < 1 ||
    sessionCount < 1 ||
    sessionNumber > sessionCount
  ) {
    return { allowed: false, reason: 'invalid' };
  }

  if (exerciseId && isLucidSessionCompleted(progress, exerciseId)) {
    return { allowed: true, reason: 'completed' };
  }

  const cursor = getLucidSequentialSessionCursor(progress);
  if (sessionNumber < cursor) {
    return { allowed: true, reason: 'previous' };
  }
  if (sessionNumber === cursor) {
    return { allowed: true, reason: 'current' };
  }
  return { allowed: false, reason: 'sequential_lock' };
}

export function canAccessLucidSession(input: LucidSessionAccessInput): boolean {
  return evaluateLucidSessionAccess(input).allowed;
}
