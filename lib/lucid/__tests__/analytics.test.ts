import {
  createLucidAnalyticsEvent,
  DEFAULT_LUCID_ANALYTICS_PREFERENCE,
  LUCID_ANALYTICS_EVENT_NAMES,
  parseLucidAnalyticsEvent,
  resolveLucidAnalyticsPreference,
} from '@/lib/lucid/analytics';

describe('lucid analytics privacy contract', () => {
  it('keeps analytics disabled unless the stored preference is explicitly enabled', () => {
    expect(DEFAULT_LUCID_ANALYTICS_PREFERENCE).toBe('disabled');
    expect(resolveLucidAnalyticsPreference(undefined)).toBe('disabled');
    expect(resolveLucidAnalyticsPreference(false)).toBe('disabled');
    expect(resolveLucidAnalyticsPreference(1)).toBe('disabled');
    expect(resolveLucidAnalyticsPreference(true)).toBe('enabled');
    expect(
      createLucidAnalyticsEvent('disabled', 'lucid_training_completed', {
        technique: 'mild',
        phase: 'bedtime',
        outcome: 'completed',
        duration: '5_15m',
      })
    ).toBeNull();
  });

  it('accepts only the five product event families and coarse enum properties', () => {
    const events = [
      createLucidAnalyticsEvent('enabled', 'lucid_activation_completed', {
        goal: 'lucidity',
        experience: 'new',
        reminder_frequency: 'medium',
      }),
      createLucidAnalyticsEvent('enabled', 'lucid_training_completed', {
        technique: 'ssild',
        phase: 'night',
        outcome: 'completed',
        duration: 'under_5m',
      }),
      createLucidAnalyticsEvent('enabled', 'lucid_retention_observed', {
        week: 'week_2_4',
        active_days: '3_4',
        status: 'returning',
      }),
      createLucidAnalyticsEvent('enabled', 'lucid_noctalia_handoff', {
        action: 'transfer_summary',
        outcome: 'fallback',
        transfer: 'experiment_summary',
      }),
      createLucidAnalyticsEvent('enabled', 'lucid_conversion', {
        surface: 'paywall',
        action: 'restored',
        tier: 'plus',
      }),
    ];

    expect(events.map((event) => event?.eventName)).toEqual(
      LUCID_ANALYTICS_EVENT_NAMES
    );
    expect(events.every((event) => event && !('occurredAt' in event))).toBe(true);
  });

  it('rejects content, identifiers, exact times, unknown values, and extra envelope keys', () => {
    const privateOrPreciseProperties = [
      {
        technique: 'mild',
        phase: 'bedtime',
        outcome: 'completed',
        duration: '5_15m',
        note: 'I dreamed about a private event',
      },
      {
        technique: 'mild',
        phase: 'bedtime',
        outcome: 'completed',
        duration: '5_15m',
        userId: 'user-123',
      },
      {
        technique: 'mild',
        phase: 'bedtime',
        outcome: 'completed',
        duration: '5_15m',
        occurredAt: 1_700_000_000_000,
      },
      {
        technique: 'mild',
        phase: '03:42',
        outcome: 'completed',
        duration: '5_15m',
      },
    ];

    for (const properties of privateOrPreciseProperties) {
      expect(
        createLucidAnalyticsEvent(
          'enabled',
          'lucid_training_completed',
          properties
        )
      ).toBeNull();
    }

    expect(
      parseLucidAnalyticsEvent({
        schemaVersion: 1,
        eventName: 'lucid_conversion',
        properties: {
          surface: 'paywall',
          action: 'viewed',
          tier: 'free',
        },
        sentAt: '2026-08-13T03:42:00Z',
      })
    ).toBeNull();
  });

  it('strictly parses a persisted allowlisted event', () => {
    expect(
      parseLucidAnalyticsEvent({
        schemaVersion: 1,
        eventName: 'lucid_retention_observed',
        properties: {
          week: 'week_5_plus',
          active_days: '5_7',
          status: 'active',
        },
      })
    ).toEqual({
      schemaVersion: 1,
      eventName: 'lucid_retention_observed',
      properties: {
        week: 'week_5_plus',
        active_days: '5_7',
        status: 'active',
      },
    });
  });
});
