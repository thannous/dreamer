import {
  DEFAULT_SCHEDULE,
  formatHour,
  nextOccurrence,
  scheduleTriggers,
  toggleDay,
  WEEKDAYS,
  type ReminderSchedule,
} from '@/lib/reminders';

const schedule = (over: Partial<ReminderSchedule> = {}): ReminderSchedule => ({
  ...DEFAULT_SCHEDULE,
  enabled: true,
  ...over,
});

describe('formatHour', () => {
  it('pads both parts', () => {
    expect(formatHour(9, 5)).toBe('09:05');
    expect(formatHour(21, 30)).toBe('21:30');
  });
});

describe('nextOccurrence', () => {
  // 2026-08-19 is a Wednesday.
  const wednesdayEvening = new Date(2026, 7, 19, 18, 0, 0);

  it('is null while the reminder is off', () => {
    expect(nextOccurrence(schedule({ enabled: false }), wednesdayEvening)).toBeNull();
  });

  it('fires tonight when the hour has not passed', () => {
    const next = nextOccurrence(schedule({ hour: 21, minute: 30 }), wednesdayEvening);
    expect(next?.getDate()).toBe(19);
    expect(next?.getHours()).toBe(21);
  });

  it('rolls to tomorrow once the hour has passed', () => {
    const lateNight = new Date(2026, 7, 19, 22, 0, 0);
    const next = nextOccurrence(schedule({ hour: 21, minute: 30 }), lateNight);
    expect(next?.getDate()).toBe(20);
  });

  it('skips to the next selected weekday', () => {
    // Only Saturday (6) and Sunday (7), from a Wednesday.
    const next = nextOccurrence(schedule({ days: [6, 7], hour: 9, minute: 0 }), wednesdayEvening);
    expect(next?.getDate()).toBe(22);
  });

  it('wraps across the end of the week', () => {
    const sundayNight = new Date(2026, 7, 23, 23, 0, 0); // Sunday
    const next = nextOccurrence(schedule({ days: [1], hour: 8, minute: 0 }), sundayNight);
    expect(next?.getDate()).toBe(24); // the Monday after
  });

  it('treats an empty day list as every day', () => {
    const next = nextOccurrence(schedule({ days: [], hour: 21, minute: 30 }), wednesdayEvening);
    expect(next?.getDate()).toBe(19);
  });
});

describe('scheduleTriggers', () => {
  it('produces nothing while off', () => {
    expect(scheduleTriggers(schedule({ enabled: false }))).toHaveLength(0);
  });

  it('collapses every day into a single daily trigger', () => {
    expect(scheduleTriggers(schedule({ days: [] }))).toEqual([{ hour: 21, minute: 30 }]);
    expect(scheduleTriggers(schedule({ days: WEEKDAYS }))).toHaveLength(1);
  });

  it('emits one trigger per weekday for a partial selection', () => {
    // A repeating daily trigger cannot express "weekdays only".
    const triggers = scheduleTriggers(schedule({ days: [1, 3, 5] }));
    expect(triggers).toHaveLength(3);
    expect(triggers.map((trigger) => trigger.weekday)).toEqual([1, 3, 5]);
  });
});

describe('toggleDay', () => {
  it('adds and removes, keeping the list sorted', () => {
    expect(toggleDay([1, 3], 2)).toEqual([1, 2, 3]);
    expect(toggleDay([1, 2, 3], 2)).toEqual([1, 3]);
  });
});
