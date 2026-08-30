import {
  buildLucidReminderPlan,
  getLucidMindfulPauseReminderBody,
  getLucidRealityReminderTimes,
  shiftLucidLocalTime,
} from '@/lib/lucid/reminders';
import { createInitialLucidTrainerState } from '@/lib/lucid/domain';
import { getLucidContent } from '@/lib/lucid/content';

describe('Lucid Trainer reminder plans', () => {
  it('shifts local times across midnight', () => {
    expect(shiftLucidLocalTime('00:10', -30)).toBe('23:40');
    expect(shiftLucidLocalTime('22:30', 270)).toBe('03:00');
  });

  it('spreads contextual checks through the waking window', () => {
    expect(getLucidRealityReminderTimes({ wakeTime: '07:00', bedtime: '23:00', count: 3 })).toEqual([
      '11:00',
      '15:00',
      '19:00',
    ]);
  });

  it('keeps all reminders disabled until the user opts in', () => {
    const state = createInitialLucidTrainerState({ now: 1, timeZone: 'Europe/Paris', locale: 'fr' });
    const plan = buildLucidReminderPlan(state, getLucidContent('fr'));
    expect(plan.timeZone).toBe('Europe/Paris');
    expect(plan.reminders.every((reminder) => reminder.enabled === false)).toBe(true);
  });

  it('cycles configured anchors in stable localized reminder windows', () => {
    const state = createInitialLucidTrainerState({ now: 1, timeZone: 'Europe/Paris', locale: 'fr' });
    state.preferences.notificationsEnabled = true;
    state.preferences.realityCheckRemindersPerDay = 3;
    state.preferences.mindfulPauseReminderAnchors = ['emotion', 'unusual_event'];

    const realityReminders = buildLucidReminderPlan(state, getLucidContent('fr'))
      .reminders.filter((reminder) => reminder.family === 'reality_check');

    expect(realityReminders.map((reminder) => reminder.body)).toEqual([
      'Si vous remarquez une émotion forte, faites une pause et questionnez cet instant.',
      'Si vous remarquez un événement inhabituel, faites une pause et questionnez cet instant.',
      'Si vous remarquez une émotion forte, faites une pause et questionnez cet instant.',
    ]);
  });

  it('uses a localized neutral window for historical or empty anchor preferences', () => {
    expect(getLucidMindfulPauseReminderBody('en', undefined, 4)).toBe(
      'If you notice a quiet window, pause and question the moment.'
    );
    expect(getLucidMindfulPauseReminderBody('it', [], 0)).toBe(
      'Se noti un momento tranquillo, fermati e metti in dubbio questo istante.'
    );
  });

  it('keeps morning and bedtime reminders when mindful-pause reminders are zero', () => {
    const state = createInitialLucidTrainerState({ now: 1, timeZone: 'Europe/Paris', locale: 'en' });
    state.preferences.notificationsEnabled = true;
    state.preferences.realityCheckRemindersPerDay = 0;

    const reminders = buildLucidReminderPlan(state, getLucidContent('en')).reminders;

    expect(reminders.some((reminder) => reminder.family === 'reality_check')).toBe(false);
    expect(reminders).toEqual(expect.arrayContaining([
      expect.objectContaining({ family: 'bedtime', enabled: true }),
      expect.objectContaining({ family: 'morning_review', enabled: true }),
    ]));
  });
});
