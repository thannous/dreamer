import type {
  LucidExperienceLevel,
  LucidGoal,
  LucidSleepSchedule,
} from './model';

export type LucidGuidanceFocus = 'notice' | 'recall' | 'frequency' | 'stability';
export type LucidGuidanceTone = 'guided' | 'balanced' | 'concise';
export type LucidRecommendedTechnique = 'mild' | 'ssild';
export type LucidDayPhase = 'morning' | 'day' | 'bedtime' | 'sleep';

export type LucidGuidanceProfile = {
  focus: LucidGuidanceFocus;
  guidance: LucidGuidanceTone;
  recommendedTechnique: LucidRecommendedTechnique;
  cautionWbtb: boolean;
};

export type LucidGuidanceProfileInput = {
  goal: LucidGoal | null;
  experience: LucidExperienceLevel | null;
};

const MINUTES_PER_DAY = 24 * 60;
const MORNING_WINDOW_MINUTES = 120;
const BEDTIME_WINDOW_MINUTES = 90;

const GOAL_FOCUS: Record<LucidGoal, LucidGuidanceFocus> = {
  first_lucid_dream: 'notice',
  improve_recall: 'recall',
  more_frequent_lucidity: 'frequency',
  stabilize_lucidity: 'stability',
};

const EXPERIENCE_GUIDANCE: Record<LucidExperienceLevel, LucidGuidanceTone> = {
  beginner: 'guided',
  occasional: 'balanced',
  experienced: 'concise',
};

function wrapMinutes(value: number): number {
  return ((value % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function minuteOfClock(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function isInHalfOpenWindow(now: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

function minuteOfInstant(now: number | Date, timeZone: string): number {
  const date = now instanceof Date ? now : new Date(now);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function getLucidGuidanceProfile(
  input: LucidGuidanceProfileInput
): LucidGuidanceProfile {
  const focus = input.goal ? GOAL_FOCUS[input.goal] : 'notice';
  const guidance = input.experience
    ? EXPERIENCE_GUIDANCE[input.experience]
    : 'guided';
  const beginnerOrUnknown =
    input.experience === 'beginner' || input.experience == null;
  const recommendedTechnique: LucidRecommendedTechnique =
    !beginnerOrUnknown && input.goal === 'more_frequent_lucidity'
      ? 'ssild'
      : 'mild';

  return {
    focus,
    guidance,
    recommendedTechnique,
    cautionWbtb: beginnerOrUnknown,
  };
}

export function getLucidDayPhase(
  now: number | Date,
  sleepSchedule: LucidSleepSchedule
): LucidDayPhase {
  const current = minuteOfInstant(now, sleepSchedule.timeZone || 'UTC');
  const wake = minuteOfClock(sleepSchedule.wakeTime);
  const bed = minuteOfClock(sleepSchedule.bedtime);
  const morningEnd = wrapMinutes(wake + MORNING_WINDOW_MINUTES);
  const bedtimeStart = wrapMinutes(bed - BEDTIME_WINDOW_MINUTES);

  // Sleep is the protected window. Morning and bedtime only apply while awake,
  // and morning wins if a short waking day makes those two overlap.
  if (isInHalfOpenWindow(current, bed, wake)) return 'sleep';
  if (isInHalfOpenWindow(current, wake, morningEnd)) return 'morning';
  if (isInHalfOpenWindow(current, bedtimeStart, bed)) return 'bedtime';
  return 'day';
}
