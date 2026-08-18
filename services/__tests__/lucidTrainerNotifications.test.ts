import type * as NotificationTypes from 'expo-notifications';
import {
  cancelAllLucidTrainerNotifications,
  cancelLucidNightCues,
  cancelLucidTrainerReminders,
  LUCID_NIGHT_CUE_NOTIFICATION_CHANNEL_IDS,
  normalizeLucidNotificationPermission,
  reconcileLucidTrainerReminders,
  restoreLucidNightSignalPlan,
  scheduleLucidNightCues,
  type LucidNotificationAdapter,
  type LucidReminderPlan,
} from '@/services/lucidTrainerNotifications';
import { createLucidNightSignalPlan } from '@/lib/lucid/audio';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationPriority: { DEFAULT: 'default' },
  IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    WEEKLY: 'weekly',
    DATE: 'date',
  },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

type Permission = NotificationTypes.NotificationPermissionsStatus;

function permission(
  status: 'granted' | 'denied' | 'undetermined',
  canAskAgain = status !== 'denied'
): Permission {
  return {
    status,
    granted: status === 'granted',
    expires: 'never',
    canAskAgain,
  } as Permission;
}

function adapterFactory(params: {
  platform?: LucidNotificationAdapter['platform'];
  permission?: Permission;
  requestedPermission?: Permission;
}) {
  let currentPermission = params.permission ?? permission('granted');
  let scheduled: NotificationTypes.NotificationRequest[] = [];
  let nextId = 1;
  const events: string[] = [];
  const adapter: LucidNotificationAdapter = {
    platform: params.platform ?? 'android',
    configureChannel: jest.fn(async () => {
      events.push('channel');
    }),
    configureNightCueChannel: jest.fn(async (soundId, volumeBand) => {
      events.push(`night-channel:${soundId}:${volumeBand}`);
    }),
    getPermissions: jest.fn(async () => {
      events.push('get-permission');
      return currentPermission;
    }),
    requestPermissions: jest.fn(async () => {
      events.push('request-permission');
      currentPermission = params.requestedPermission ?? currentPermission;
      return currentPermission;
    }),
    getScheduled: jest.fn(async () => [...scheduled]),
    schedule: jest.fn(async (request) => {
      const identifier = `scheduled-${nextId++}`;
      scheduled.push({
        identifier,
        content: request.content as NotificationTypes.NotificationContent,
        trigger: request.trigger,
      });
      return identifier;
    }),
    cancel: jest.fn(async (identifier) => {
      scheduled = scheduled.filter((request) => request.identifier !== identifier);
    }),
  };
  return {
    adapter,
    events,
    setPermission(value: Permission) {
      currentPermission = value;
    },
    addScheduled(value: NotificationTypes.NotificationRequest) {
      scheduled.push(value);
    },
    get scheduled() {
      return scheduled;
    },
  };
}

function plan(): LucidReminderPlan {
  return {
    version: 1,
    timeZone: 'Europe/Paris',
    reminders: [
      {
        id: 'reality-workdays',
        family: 'reality_check',
        enabled: true,
        weekdays: [2, 3],
        time: '11:30',
        title: 'Reality check',
        body: 'Pause and inspect your surroundings.',
        url: '/lucid/reality-check',
      },
    ],
  };
}

const NIGHT_START = 1_700_000_000_000;
const MINUTE = 60 * 1000;

function nightPlan(startAt = NIGHT_START) {
  const result = createLucidNightSignalPlan({
    enabled: true,
    sessionStartAt: startAt,
    timerMinutes: 360,
    cueOffsetsMinutes: [90, 180],
    requestedVolume: 0.9,
    requestedCueDurationMs: 7_000,
    soundId: 'ocean',
    safety: {
      acknowledged: true,
      playbackRoute: 'speaker',
      sleepIsFragile: false,
      hearingConcern: false,
    },
  });
  if (result.status !== 'ready') throw new Error('Expected a night plan');
  return result.plan;
}

const nightContent = {
  title: 'Lucid Trainer',
  body: 'A gentle reality cue.',
  url: '/lucid/(tabs)/night',
} as const;

describe('lucidTrainerNotifications', () => {
  it('normalizes granted, provisional and permanently denied permissions', () => {
    expect(normalizeLucidNotificationPermission(permission('granted')).status).toBe(
      'granted'
    );
    expect(
      normalizeLucidNotificationPermission({
        ...permission('undetermined'),
        ios: { status: 3 },
      } as Permission).status
    ).toBe('granted');
    expect(normalizeLucidNotificationPermission(permission('denied', false))).toEqual({
      status: 'denied',
      canAskAgain: false,
    });
  });

  it('schedules stable logical occurrences and leaves a matching plan untouched', async () => {
    const mock = adapterFactory({});
    const first = await reconcileLucidTrainerReminders(plan(), {
      adapter: mock.adapter,
      now: 1_700_000_000_000,
      timeZoneOffsetMinutes: -120,
    });
    expect(first.scheduledIds).toEqual(['scheduled-1', 'scheduled-2']);

    const second = await reconcileLucidTrainerReminders(plan(), {
      adapter: mock.adapter,
      now: 1_700_000_100_000,
      timeZoneOffsetMinutes: -120,
    });
    expect(second).toMatchObject({
      scheduledIds: [],
      cancelledIds: [],
      unchangedOccurrenceIds: [
        'reality-workdays:weekday:2',
        'reality-workdays:weekday:3',
      ],
      timeContextChanged: false,
    });
    expect(mock.scheduled).toHaveLength(2);
  });

  it('reconciles DST or timezone offset changes by replacing only owned reminders', async () => {
    const mock = adapterFactory({});
    await reconcileLucidTrainerReminders(plan(), {
      adapter: mock.adapter,
      timeZoneOffsetMinutes: -120,
    });

    const result = await reconcileLucidTrainerReminders(plan(), {
      adapter: mock.adapter,
      timeZoneOffsetMinutes: -60,
    });
    expect(result.timeContextChanged).toBe(true);
    expect(result.cancelledIds).toEqual(['scheduled-1', 'scheduled-2']);
    expect(result.scheduledIds).toEqual(['scheduled-3', 'scheduled-4']);
  });

  it('cancels owned reminders when permission is refused and preserves unrelated ones', async () => {
    const mock = adapterFactory({});
    await reconcileLucidTrainerReminders(plan(), {
      adapter: mock.adapter,
      timeZoneOffsetMinutes: -120,
    });
    mock.addScheduled({
      identifier: 'unrelated',
      content: { data: { anotherOwner: true } } as unknown as NotificationTypes.NotificationContent,
      trigger: null,
    });
    mock.setPermission(permission('denied', false));

    const result = await reconcileLucidTrainerReminders(plan(), {
      adapter: mock.adapter,
      timeZoneOffsetMinutes: -120,
    });
    expect(result).toMatchObject({ permission: 'denied', canAskAgain: false });
    expect(result.cancelledIds).toEqual(['scheduled-1', 'scheduled-2']);
    expect(mock.scheduled.map((request) => request.identifier)).toEqual(['unrelated']);
  });

  it('creates the Android channel before asking contextual permission', async () => {
    const mock = adapterFactory({
      permission: permission('undetermined', true),
      requestedPermission: permission('granted'),
    });

    const result = await reconcileLucidTrainerReminders(plan(), {
      adapter: mock.adapter,
      requestPermissionIfNeeded: true,
      timeZoneOffsetMinutes: -120,
    });

    expect(result.permission).toBe('granted');
    expect(mock.events).toEqual(['channel', 'get-permission', 'request-permission']);
  });

  it('targets cancellation by reminder family and product identifiers', async () => {
    const mock = adapterFactory({});
    const mixedPlan = plan();
    mixedPlan.reminders.push({
      id: 'morning',
      family: 'morning_review',
      enabled: true,
      weekdays: [2],
      time: '07:15',
      title: 'Morning review',
      body: 'Record the outcome of last night.',
      url: '/lucid/morning',
    });
    await reconcileLucidTrainerReminders(mixedPlan, {
      adapter: mock.adapter,
      timeZoneOffsetMinutes: -120,
    });

    const cancelledById = await cancelLucidTrainerReminders(
      { reminderId: 'morning' },
      mock.adapter
    );
    expect(cancelledById).toEqual(['scheduled-1']);
    const cancelledByFamily = await cancelLucidTrainerReminders(
      { family: 'reality_check' },
      mock.adapter
    );
    expect(cancelledByFamily).toEqual(['scheduled-2', 'scheduled-3']);
    expect(mock.scheduled).toHaveLength(0);
  });

  it('uses an explicit timezone calendar trigger on iOS and reports web unsupported', async () => {
    const ios = adapterFactory({ platform: 'ios' });
    await reconcileLucidTrainerReminders(plan(), {
      adapter: ios.adapter,
      timeZoneOffsetMinutes: -120,
    });
    expect(ios.adapter.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({
          type: 'calendar',
          timezone: 'Europe/Paris',
          repeats: true,
        }),
      })
    );

    const web = adapterFactory({ platform: 'web' });
    await expect(
      reconcileLucidTrainerReminders(plan(), { adapter: web.adapter })
    ).resolves.toMatchObject({ permission: 'unsupported' });
    expect(web.adapter.getPermissions).not.toHaveBeenCalled();
  });

  it('rejects duplicate IDs, invalid times and malformed routes', async () => {
    const invalid = plan();
    invalid.reminders.push({ ...invalid.reminders[0], time: '25:00' });

    await expect(
      reconcileLucidTrainerReminders(invalid, { adapter: adapterFactory({}).adapter })
    ).rejects.toThrow('Invalid Lucid Trainer reminder definition');
  });

  it('schedules night cues as dated local notifications with the selected short sound', async () => {
    const mock = adapterFactory({});
    const generatedPlan = nightPlan();

    const result = await scheduleLucidNightCues(generatedPlan, {
      adapter: mock.adapter,
      now: NIGHT_START,
      content: nightContent,
    });

    expect(result).toMatchObject({
      permission: 'granted',
      scheduledIds: ['scheduled-1', 'scheduled-2'],
      cancelledIds: [],
      skippedCueIds: [],
    });
    expect(mock.events).toEqual([
      'night-channel:ocean:gentle',
      'get-permission',
    ]);
    expect(mock.adapter.schedule).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        content: expect.objectContaining({
          sound: 'lucid_cue_ocean.wav',
          vibrate: [0],
          data: expect.objectContaining({
            lucidNightSoundId: 'ocean',
            lucidNightVolume: 0.3,
            lucidNightVolumeBand: 'gentle',
          }),
        }),
        trigger: {
          type: 'date',
          date: NIGHT_START + 90 * MINUTE,
          channelId: LUCID_NIGHT_CUE_NOTIFICATION_CHANNEL_IDS.ocean.gentle,
        },
      })
    );
  });

  it('does not let reminder reconciliation cancel night cue notifications', async () => {
    const mock = adapterFactory({});
    await scheduleLucidNightCues(nightPlan(), {
      adapter: mock.adapter,
      now: NIGHT_START,
      content: nightContent,
    });

    const reconciliation = await reconcileLucidTrainerReminders(plan(), {
      adapter: mock.adapter,
      now: NIGHT_START,
      timeZoneOffsetMinutes: -120,
    });

    expect(reconciliation.cancelledIds).toEqual([]);
    expect(mock.scheduled.map((request) => request.identifier)).toEqual([
      'scheduled-1',
      'scheduled-2',
      'scheduled-3',
      'scheduled-4',
    ]);
  });

  it('cancels night cues independently and preserves ordinary reminders', async () => {
    const mock = adapterFactory({});
    await scheduleLucidNightCues(nightPlan(), {
      adapter: mock.adapter,
      now: NIGHT_START,
      content: nightContent,
    });
    await reconcileLucidTrainerReminders(plan(), {
      adapter: mock.adapter,
      timeZoneOffsetMinutes: -120,
    });

    await expect(cancelLucidNightCues({}, mock.adapter)).resolves.toEqual([
      'scheduled-1',
      'scheduled-2',
    ]);
    expect(mock.scheduled.map((request) => request.identifier)).toEqual([
      'scheduled-3',
      'scheduled-4',
    ]);
  });

  it('cancels reminders and night cues together for trainer data deletion', async () => {
    const mock = adapterFactory({});
    await scheduleLucidNightCues(nightPlan(), {
      adapter: mock.adapter,
      now: NIGHT_START,
      content: nightContent,
    });
    await reconcileLucidTrainerReminders(plan(), {
      adapter: mock.adapter,
      timeZoneOffsetMinutes: -120,
    });

    await expect(cancelAllLucidTrainerNotifications(mock.adapter)).resolves.toEqual([
      'scheduled-1',
      'scheduled-2',
      'scheduled-3',
      'scheduled-4',
    ]);
    expect(mock.scheduled).toEqual([]);
  });

  it('drops elapsed cues on restore and never reschedules them', async () => {
    const mock = adapterFactory({});
    const generatedPlan = nightPlan();
    await scheduleLucidNightCues(generatedPlan, {
      adapter: mock.adapter,
      now: NIGHT_START,
      content: nightContent,
    });

    const restored = await restoreLucidNightSignalPlan({
      adapter: mock.adapter,
      now: NIGHT_START + 100 * MINUTE,
    });
    expect(restored?.cues.map((cue) => cue.id)).toEqual([
      generatedPlan.cues[1].id,
    ]);
    expect(mock.scheduled.map((request) => request.identifier)).toEqual([
      'scheduled-2',
    ]);
    expect(mock.adapter.schedule).toHaveBeenCalledTimes(2);

    await expect(
      restoreLucidNightSignalPlan({
        adapter: mock.adapter,
        now: NIGHT_START + 400 * MINUTE,
      })
    ).resolves.toBeNull();
    expect(mock.scheduled).toEqual([]);
    expect(mock.adapter.schedule).toHaveBeenCalledTimes(2);
  });

  it('skips already elapsed cues instead of replaying them when scheduling resumes late', async () => {
    const mock = adapterFactory({});
    const generatedPlan = nightPlan();

    const result = await scheduleLucidNightCues(generatedPlan, {
      adapter: mock.adapter,
      now: NIGHT_START + 100 * MINUTE,
      content: nightContent,
    });

    expect(result.skippedCueIds).toEqual([generatedPlan.cues[0].id]);
    expect(result.scheduledIds).toEqual(['scheduled-1']);
    expect(
      (mock.adapter.schedule as jest.Mock).mock.calls[0][0].trigger.date
    ).toBe(generatedPlan.cues[1].startsAt);
  });

  it('rejects a night cue route that the root navigator will not open', async () => {
    const mock = adapterFactory({});

    await expect(
      scheduleLucidNightCues(nightPlan(), {
        adapter: mock.adapter,
        now: NIGHT_START,
        content: {
          ...nightContent,
          url: '/lucid/night' as typeof nightContent.url,
        },
      })
    ).rejects.toThrow('Invalid Lucid Trainer night cue content');
    expect(mock.adapter.schedule).not.toHaveBeenCalled();
  });

  it('rolls back a partial replacement when a new cue cannot be scheduled', async () => {
    const mock = adapterFactory({});
    await scheduleLucidNightCues(nightPlan(), {
      adapter: mock.adapter,
      now: NIGHT_START,
      content: nightContent,
    });
    const originalIds = mock.scheduled.map((request) => request.identifier);
    let attempt = 0;
    (mock.adapter.schedule as jest.Mock).mockImplementation(async (request) => {
      attempt += 1;
      if (attempt === 2) throw new Error('native_schedule_failed');
      const identifier = 'replacement-1';
      mock.addScheduled({
        identifier,
        content: request.content as NotificationTypes.NotificationContent,
        trigger: request.trigger,
      });
      return identifier;
    });

    await expect(
      scheduleLucidNightCues(nightPlan(NIGHT_START + MINUTE), {
        adapter: mock.adapter,
        now: NIGHT_START + MINUTE,
        content: nightContent,
      })
    ).rejects.toThrow('native_schedule_failed');
    expect(mock.scheduled.map((request) => request.identifier)).toEqual(originalIds);
  });
});
