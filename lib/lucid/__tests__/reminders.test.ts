import { buildLucidReminderPlan, getLucidRealityReminderTimes, shiftLucidLocalTime } from '@/lib/lucid/reminders';
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
});
