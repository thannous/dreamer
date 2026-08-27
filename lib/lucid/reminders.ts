import type { LucidTrainerContent } from '@/lib/lucid/content';
import type { LucidMindfulPauseAnchor, LucidTrainerState } from '@/lib/lucid/model';
import type { LucidReminderDefinition, LucidReminderPlan } from '@/services/lucidTrainerNotifications';

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7] as const;

function minuteOfDay(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function shiftLucidLocalTime(time: string, minutes: number): string {
  const shifted = ((minuteOfDay(time) + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(shifted / 60)).padStart(2, '0')}:${String(shifted % 60).padStart(2, '0')}`;
}

export function getLucidRealityReminderTimes(params: {
  wakeTime: string;
  bedtime: string;
  count: number;
}): string[] {
  const count = Math.max(0, Math.min(12, Math.floor(params.count)));
  if (count === 0) return [];
  const wake = minuteOfDay(params.wakeTime);
  let bed = minuteOfDay(params.bedtime);
  if (bed <= wake) bed += 1440;
  const span = bed - wake;
  return Array.from({ length: count }, (_, index) => {
    // Divide the actual waking interval into equal segments. The first and last
    // checks therefore stay naturally away from wake-up and bedtime without
    // applying a second, surprising margin to the user's schedule.
    const time = Math.round(wake + (span * (index + 1)) / (count + 1));
    const normalized = ((time % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
  });
}

type MindfulPauseReminderCopy = Readonly<{
  neutral: string;
  anchors: Readonly<Record<LucidMindfulPauseAnchor, string>>;
}>;

const MINDFUL_PAUSE_REMINDER_COPY: Readonly<
  Record<LucidTrainerContent['locale'], MindfulPauseReminderCopy>
> = {
  en: {
    neutral: 'If you notice a quiet window, pause and question the moment.',
    anchors: {
      transition: 'If you notice a transition, pause and question the moment.',
      emotion: 'If you notice a strong emotion, pause and question the moment.',
      unusual_event: 'If you notice something unusual, pause and question the moment.',
      dream_sign: 'If you notice a confirmed dream sign, pause and question the moment.',
    },
  },
  fr: {
    neutral: 'Si vous remarquez un moment calme, faites une pause et questionnez cet instant.',
    anchors: {
      transition: 'Si vous remarquez une transition, faites une pause et questionnez cet instant.',
      emotion: 'Si vous remarquez une émotion forte, faites une pause et questionnez cet instant.',
      unusual_event: 'Si vous remarquez un événement inhabituel, faites une pause et questionnez cet instant.',
      dream_sign: 'Si vous remarquez un signe onirique confirmé, faites une pause et questionnez cet instant.',
    },
  },
  es: {
    neutral: 'Si notas un momento tranquilo, haz una pausa y cuestiona este instante.',
    anchors: {
      transition: 'Si notas una transición, haz una pausa y cuestiona este instante.',
      emotion: 'Si notas una emoción intensa, haz una pausa y cuestiona este instante.',
      unusual_event: 'Si notas algo inusual, haz una pausa y cuestiona este instante.',
      dream_sign: 'Si notas una señal onírica confirmada, haz una pausa y cuestiona este instante.',
    },
  },
  de: {
    neutral: 'Wenn dir ein ruhiger Moment auffällt, halte inne und hinterfrage den Augenblick.',
    anchors: {
      transition: 'Wenn dir ein Übergang auffällt, halte inne und hinterfrage den Augenblick.',
      emotion: 'Wenn dir ein starkes Gefühl auffällt, halte inne und hinterfrage den Augenblick.',
      unusual_event: 'Wenn dir etwas Ungewöhnliches auffällt, halte inne und hinterfrage den Augenblick.',
      dream_sign: 'Wenn dir ein bestätigtes Traumzeichen auffällt, halte inne und hinterfrage den Augenblick.',
    },
  },
  it: {
    neutral: 'Se noti un momento tranquillo, fermati e metti in dubbio questo istante.',
    anchors: {
      transition: 'Se noti una transizione, fermati e metti in dubbio questo istante.',
      emotion: 'Se noti un’emozione forte, fermati e metti in dubbio questo istante.',
      unusual_event: 'Se noti qualcosa di insolito, fermati e metti in dubbio questo istante.',
      dream_sign: 'Se noti un segnale onirico confermato, fermati e metti in dubbio questo istante.',
    },
  },
};

export function getLucidMindfulPauseReminderBody(
  locale: LucidTrainerContent['locale'],
  anchors: readonly LucidMindfulPauseAnchor[] | undefined,
  index: number
): string {
  const copy = MINDFUL_PAUSE_REMINDER_COPY[locale];
  if (!anchors || anchors.length === 0) {
    return copy.neutral;
  }
  return copy.anchors[anchors[index % anchors.length]];
}

export function buildLucidReminderPlan(
  state: LucidTrainerState,
  content: LucidTrainerContent
): LucidReminderPlan {
  const enabled = state.preferences.notificationsEnabled;
  const schedule = state.onboarding.sleepSchedule;
  const anchors = state.preferences.mindfulPauseReminderAnchors;
  const realityTimes = getLucidRealityReminderTimes({
    wakeTime: schedule.wakeTime,
    bedtime: schedule.bedtime,
    count: state.preferences.realityCheckRemindersPerDay,
  });
  const reminders: LucidReminderDefinition[] = realityTimes.map((time, index) => ({
    id: `reality-${index + 1}`,
    family: 'reality_check',
    enabled,
    weekdays: [...EVERY_DAY],
    time,
    title: content.realityChecks.title,
    body: getLucidMindfulPauseReminderBody(content.locale, anchors, index),
    url: '/lucid/reality-check',
  }));

  reminders.push({
    id: 'bedtime-preparation',
    family: 'bedtime',
    enabled,
    weekdays: [...EVERY_DAY],
    time: shiftLucidLocalTime(schedule.bedtime, -30),
    title: content.nightSignals.title,
    body: content.nightSignals.setupSteps[0],
    url: '/lucid/(tabs)/night',
  });
  reminders.push({
    id: 'morning-review',
    family: 'morning_review',
    enabled,
    weekdays: [...EVERY_DAY],
    time: shiftLucidLocalTime(schedule.wakeTime, 5),
    title: content.morningReview.title,
    body: content.morningReview.intro,
    url: '/lucid/morning',
  });

  const wbtbActive = state.progress.some(
    (progress) => progress.technique === 'wbtb' && progress.status === 'active'
  );
  reminders.push({
    id: 'wbtb-window',
    family: 'wbtb',
    enabled: enabled && wbtbActive,
    weekdays: [...EVERY_DAY],
    time: shiftLucidLocalTime(schedule.bedtime, 270),
    title: content.programs.wbtb.title,
    body: content.programs.wbtb.stopRules[0],
    url: '/lucid/program/wbtb',
  });

  return {
    version: 1,
    timeZone: schedule.timeZone || state.preferences.timeZone,
    reminders,
  };
}
