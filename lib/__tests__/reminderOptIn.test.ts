import en from '@/lib/i18n/en';
import {
  buildOptInNotificationSettings,
  deriveWeekendTime,
  getReminderTimeBucket,
  REMINDER_OPT_IN_PRESETS,
} from '@/lib/reminderOptIn';

describe('reminderOptIn', () => {
  it('offers four morning presets', () => {
    expect(REMINDER_OPT_IN_PRESETS).toEqual(['06:30', '07:00', '07:30', '08:00']);
  });

  it('derives the weekend time one hour later, capped at 23:00', () => {
    expect(deriveWeekendTime('07:00')).toBe('08:00');
    expect(deriveWeekendTime('06:30')).toBe('07:30');
    expect(deriveWeekendTime('22:45')).toBe('23:00');
    expect(deriveWeekendTime('nonsense')).toBe('10:00');
  });

  it('enables both weekday and weekend reminders, keeping a customised weekend time', () => {
    expect(
      buildOptInNotificationSettings(
        { weekdayEnabled: false, weekdayTime: '07:00', weekendEnabled: false, weekendTime: '10:00' },
        '07:30'
      )
    ).toEqual({ weekdayEnabled: true, weekdayTime: '07:30', weekendEnabled: true, weekendTime: '08:30', weeklyRecapEnabled: true, streakRiskEnabled: true, inactivityNudgeEnabled: true });

    expect(
      buildOptInNotificationSettings(
        { weekdayEnabled: false, weekdayTime: '07:00', weekendEnabled: true, weekendTime: '11:15' },
        '06:30'
      )
    ).toEqual({ weekdayEnabled: true, weekdayTime: '06:30', weekendEnabled: true, weekendTime: '11:15', weeklyRecapEnabled: true, streakRiskEnabled: true, inactivityNudgeEnabled: true });
  });

  it('arms exactly the families the card discloses, and no more', () => {
    const next = buildOptInNotificationSettings(
      { weekdayEnabled: false, weekdayTime: '07:00', weekendEnabled: false, weekendTime: '10:00' },
      '07:00'
    );
    const enabled = Object.entries(next)
      .filter(([, value]) => value === true)
      .map(([key]) => key)
      .sort();
    // One tap arms the morning reminder (weekday + weekend), the Sunday recap,
    // the evening streak heads-up and the two comeback nudges. Every family
    // below must be named in `reminders.opt_in.includes` (rendered by
    // ReminderOptInCard) before the user accepts — adding one here without
    // updating that copy is a silent opt-in.
    expect(enabled).toEqual([
      'inactivityNudgeEnabled',
      'streakRiskEnabled',
      'weekdayEnabled',
      'weekendEnabled',
      'weeklyRecapEnabled',
    ]);
    expect(en['reminders.opt_in.includes']).toBeTruthy();
  });

  it('buckets reminder times without exposing the exact value', () => {
    expect(getReminderTimeBucket('05:45')).toBe('before_6');
    expect(getReminderTimeBucket('06:30')).toBe('6_7');
    expect(getReminderTimeBucket('07:00')).toBe('7_8');
    expect(getReminderTimeBucket('08:00')).toBe('8_9');
    expect(getReminderTimeBucket('09:10')).toBe('after_9');
    expect(getReminderTimeBucket(null)).toBe('unknown');
    expect(getReminderTimeBucket('7h')).toBe('unknown');
  });
});
