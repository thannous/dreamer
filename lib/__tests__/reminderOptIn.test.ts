import en from '@/lib/i18n/en';
import de from '@/lib/i18n/de';
import es from '@/lib/i18n/es';
import fr from '@/lib/i18n/fr';
import italian from '@/lib/i18n/it';
import pt from '@/lib/i18n/pt';
import {
  buildOptInNotificationSettings,
  deriveWeekendTime,
  getReminderTimeBucket,
  REMINDER_OPT_IN_PRESETS,
} from '@/lib/reminderOptIn';

const notificationCopyKeys = [
  'reminders.opt_in.includes',
  'notifications.analysis_ready.title',
  'notifications.analysis_ready.body',
] as const;

const packs = { en, fr, es, de, it: italian, pt } as const;

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
    ).toEqual({ weekdayEnabled: true, weekdayTime: '07:30', weekendEnabled: true, weekendTime: '08:30', weeklyRecapEnabled: true, streakRiskEnabled: false, inactivityNudgeEnabled: false });

    expect(
      buildOptInNotificationSettings(
        { weekdayEnabled: false, weekdayTime: '07:00', weekendEnabled: true, weekendTime: '11:15' },
        '06:30'
      )
    ).toEqual({ weekdayEnabled: true, weekdayTime: '06:30', weekendEnabled: true, weekendTime: '11:15', weeklyRecapEnabled: true, streakRiskEnabled: false, inactivityNudgeEnabled: false });
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
    // One tap arms the essential morning reminder and the Sunday recap.
    // Streak and inactivity stay off unless the user already enabled them.
    expect(enabled).toEqual([
      'weekdayEnabled',
      'weekendEnabled',
      'weeklyRecapEnabled',
    ]);
    expect(en['reminders.opt_in.includes']).toBeTruthy();
  });

  it('localizes opt-in disclosure and analysis-ready copy in every catalogue', () => {
    for (const translations of Object.values(packs)) {
      for (const key of notificationCopyKeys) {
        expect(translations[key]).toEqual(expect.any(String));
        expect(translations[key]).not.toBe(key);
        expect(translations[key].trim()).not.toBe('');
      }
      expect(translations['reminders.opt_in.includes'].toLowerCase()).toMatch(/sunday recap|récap du dimanche|resumen del domingo|sonntagsübersicht|riepilogo della domenica|resumo de domingo/);
      expect(translations['notifications.analysis_ready.body'].toLowerCase()).not.toMatch(
        /symbol|symbole|símbolo|simbolo|nightmare|cauchemar|pesadilla|incubo|pesadelo/
      );
    }
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
