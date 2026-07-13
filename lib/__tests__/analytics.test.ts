import {
  configureAnalyticsProvider,
  createDebugAnalyticsProvider,
  getDurationMsBucket,
  getPaywallTrigger,
  getRecordingDurationBucket,
  getTranscriptLengthBucket,
  getTranscriptLengthBucketFromLength,
  resetAnalyticsProviderForTesting,
  setAnalyticsProvider,
  trackProductEvent,
  type AnalyticsEventName,
} from '@/lib/analytics';

describe('analytics', () => {
  const originalMockMode = process.env.EXPO_PUBLIC_MOCK_MODE;
  const originalAnalyticsDebug = process.env.EXPO_PUBLIC_ANALYTICS_DEBUG;

  afterEach(() => {
    if (originalMockMode === undefined) {
      delete process.env.EXPO_PUBLIC_MOCK_MODE;
    } else {
      process.env.EXPO_PUBLIC_MOCK_MODE = originalMockMode;
    }
    if (originalAnalyticsDebug === undefined) {
      delete process.env.EXPO_PUBLIC_ANALYTICS_DEBUG;
    } else {
      process.env.EXPO_PUBLIC_ANALYTICS_DEBUG = originalAnalyticsDebug;
    }
    resetAnalyticsProviderForTesting();
    jest.restoreAllMocks();
  });

  it('tracks the first Android audit events through the configured provider', async () => {
    process.env.EXPO_PUBLIC_MOCK_MODE = 'false';
    const events: { name: AnalyticsEventName; properties: unknown }[] = [];
    setAnalyticsProvider({
      track: async (name, properties) => {
        events.push({ name, properties });
      },
    });

    await trackProductEvent('recording_started', {
      input_mode: 'voice',
      language: 'fr',
      speech_available: true,
      offline_model_state: 'unknown',
    });
    await trackProductEvent('recording_saved', {
      input_mode: 'voice',
      capture_context: 'fresh',
      duration_bucket: '16_60s',
      transcript_length_bucket: '101_500',
    });
    await trackProductEvent('recording_activation_insight_shown', {
      surface: 'draft',
      capture_context: 'fresh',
      transcript_length_bucket: '0_100',
      language: 'fr',
    });
    await trackProductEvent('analysis_started', {
      source: 'recording_flow',
      tier: 'free',
      guest_status: 'signed_in',
    });
    await trackProductEvent('analysis_completed', {
      duration_ms_bucket: '5_15s',
      generated_image: true,
      tier: 'free',
    });
    await trackProductEvent('paywall_viewed', {
      trigger: 'analysis_limit',
      tier: 'free',
      usage_count: 3,
      offering_id: 'plus_monthly',
    });
    await trackProductEvent('empty_journal_remembered_cta_clicked', {
      source: 'journal_empty_state',
    });
    await trackProductEvent('onboarding_choice_selected', {
      surface: 'app_onboarding',
      step: 'path',
      choice: 'memory',
    });

    expect(events.map((event) => event.name)).toEqual([
      'recording_started',
      'recording_saved',
      'recording_activation_insight_shown',
      'analysis_started',
      'analysis_completed',
      'paywall_viewed',
      'empty_journal_remembered_cta_clicked',
      'onboarding_choice_selected',
    ]);
  });

  it('no-ops safely without a provider or in mock mode', async () => {
    process.env.EXPO_PUBLIC_MOCK_MODE = 'false';
    await expect(trackProductEvent('paywall_viewed', {
      trigger: 'settings',
      tier: 'free',
      usage_count: null,
      offering_id: null,
    })).resolves.toBeUndefined();

    const track = jest.fn();
    setAnalyticsProvider({ track });
    process.env.EXPO_PUBLIC_MOCK_MODE = 'true';
    await trackProductEvent('paywall_viewed', {
      trigger: 'settings',
      tier: 'free',
      usage_count: null,
      offering_id: null,
    });

    expect(track).not.toHaveBeenCalled();
  });

  it('normalizes buckets and paywall triggers', () => {
    expect(getTranscriptLengthBucket('a'.repeat(100))).toBe('0_100');
    expect(getTranscriptLengthBucket('a'.repeat(101))).toBe('101_500');
    expect(getTranscriptLengthBucket('a'.repeat(501))).toBe('501_1500');
    expect(getTranscriptLengthBucket('a'.repeat(1501))).toBe('1501_plus');
    expect(getTranscriptLengthBucketFromLength(0)).toBe('0_100');
    expect(getTranscriptLengthBucketFromLength(1501)).toBe('1501_plus');

    expect(getRecordingDurationBucket(null)).toBe('unknown');
    expect(getRecordingDurationBucket(15000)).toBe('0_15s');
    expect(getRecordingDurationBucket(60000)).toBe('16_60s');
    expect(getRecordingDurationBucket(180000)).toBe('61_180s');
    expect(getRecordingDurationBucket(181000)).toBe('181s_plus');

    expect(getDurationMsBucket(5000)).toBe('0_5s');
    expect(getDurationMsBucket(15000)).toBe('5_15s');
    expect(getDurationMsBucket(45000)).toBe('15_45s');
    expect(getDurationMsBucket(45001)).toBe('45s_plus');

    expect(getPaywallTrigger('analysis_limit')).toBe('analysis_limit');
    expect(getPaywallTrigger('unknown')).toBe('direct');
    expect(getPaywallTrigger(undefined)).toBe('direct');
  });

  it('swallows provider failures so analytics never blocks product flows', async () => {
    process.env.EXPO_PUBLIC_MOCK_MODE = 'false';
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const track = jest.fn(async () => {
      throw new Error('provider down');
    });
    setAnalyticsProvider({
      track,
    });

    await expect(trackProductEvent('paywall_viewed', {
      trigger: 'direct',
      tier: 'free',
      usage_count: null,
      offering_id: null,
    })).resolves.toBeUndefined();

    expect(track).toHaveBeenCalled();
  });

  it('configures a debug provider when explicitly enabled', async () => {
    process.env.EXPO_PUBLIC_MOCK_MODE = 'false';
    process.env.EXPO_PUBLIC_ANALYTICS_DEBUG = 'true';
    jest.spyOn(console, 'log').mockImplementation(() => {});

    configureAnalyticsProvider();

    await trackProductEvent('recording_saved', {
      input_mode: 'text',
      capture_context: 'remembered',
      duration_bucket: 'unknown',
      transcript_length_bucket: '0_100',
    });

    expect(console.log).toHaveBeenCalledWith(
      '[Analytics]',
      'event',
      'recording_saved',
      {
        input_mode: 'text',
        capture_context: 'remembered',
        duration_bucket: 'unknown',
        transcript_length_bucket: '0_100',
      }
    );
  });

  it('redacts non-primitive debug analytics properties', async () => {
    const debugProvider = createDebugAnalyticsProvider();
    jest.spyOn(console, 'log').mockImplementation(() => {});

    await debugProvider.track('paywall_viewed', {
      trigger: 'direct',
      tier: 'free',
      usage_count: null,
      offering_id: 'a'.repeat(120),
      raw_payload: { transcript: 'private' },
    } as never);

    expect(console.log).toHaveBeenCalledWith(
      '[Analytics]',
      'event',
      'paywall_viewed',
      expect.objectContaining({
        offering_id: `${'a'.repeat(96)}...`,
        raw_payload: '[redacted]',
      })
    );
  });
});
