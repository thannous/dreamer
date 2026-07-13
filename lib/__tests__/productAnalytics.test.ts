import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

import {
  createProductAnalyticsProvider,
  flushProductAnalytics,
  getProductAnalyticsPreference,
  initializeProductAnalytics,
  isProductAnalyticsAvailable,
  resetProductAnalyticsForTesting,
  setProductAnalyticsLocale,
  setProductAnalyticsEnabled,
} from '@/lib/productAnalytics';
import { fetchProductAnalyticsJSON } from '@/lib/productAnalyticsGuestSession';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
}));

jest.mock('expo-network', () => ({
  NetworkStateType: { NONE: 'NONE', WIFI: 'WIFI' },
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('@/lib/productAnalyticsGuestSession', () => ({
  fetchProductAnalyticsJSON: jest.fn(),
  resetProductAnalyticsGuestSessionForTesting: jest.fn(async () => undefined),
}));

jest.mock('@/lib/config', () => ({
  getApiBaseUrl: () => 'https://example.test/api',
}));

const mockFetch = jest.mocked(fetchProductAnalyticsJSON);
const mockNetworkState = jest.mocked(Network.getNetworkStateAsync);

describe('first-party product analytics', () => {
  const originalPlatform = Platform.OS;
  const originalFlag = process.env.EXPO_PUBLIC_PRODUCT_ANALYTICS_ENABLED;
  let uuidCounter = 0;

  beforeEach(async () => {
    await AsyncStorage.clear();
    await resetProductAnalyticsForTesting();
    Platform.OS = 'android';
    process.env.EXPO_PUBLIC_PRODUCT_ANALYTICS_ENABLED = 'true';
    uuidCounter = 0;
    jest.mocked(Crypto.randomUUID).mockImplementation(
      () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`
    );
    mockNetworkState.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
      type: Network.NetworkStateType.NONE,
    });
    mockFetch.mockReset();
  });

  afterEach(async () => {
    await resetProductAnalyticsForTesting();
    jest.restoreAllMocks();
    Platform.OS = originalPlatform;
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_PRODUCT_ANALYTICS_ENABLED;
    else process.env.EXPO_PUBLIC_PRODUCT_ANALYTICS_ENABLED = originalFlag;
  });

  it('is available only for Android when the client feature flag is enabled', () => {
    expect(isProductAnalyticsAvailable()).toBe(true);
    Platform.OS = 'ios';
    expect(isProductAnalyticsAvailable()).toBe(false);
    Platform.OS = 'android';
    process.env.EXPO_PUBLIC_PRODUCT_ANALYTICS_ENABLED = 'false';
    expect(isProductAnalyticsAvailable()).toBe(false);
  });

  it('persists an event before a network send and never stores content fields', async () => {
    const provider = createProductAnalyticsProvider();
    await provider.track('onboarding_step_viewed', { step: 'intro' });

    const raw = await AsyncStorage.getItem('product-analytics-queue-v1');
    const queue = JSON.parse(raw ?? '[]');
    expect(queue).toHaveLength(1);
    expect(queue[0]).toEqual(expect.objectContaining({
      event_name: 'onboarding_step_viewed',
      platform: 'android',
      locale: 'fr',
      properties: { step: 'intro' },
    }));
    expect(JSON.stringify(queue)).not.toMatch(/transcript|fingerprint|user_id|dream_id/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects forbidden, unknown, and free-form runtime properties before local storage', async () => {
    const provider = createProductAnalyticsProvider();
    await provider.track('onboarding_step_viewed', {
      step: 'intro',
      transcript: 'private dream',
    } as never);
    await provider.track('onboarding_step_viewed', {
      step: 'intro',
      message: 'mon rêve privé',
    } as never);
    await provider.track('onboarding_step_viewed', {
      step: 'mon rêve privé',
    } as never);
    await provider.track('onboarding_choice_selected', {
      surface: 'recording_onboarding',
      step: 'capture_mode',
      choice: 'library',
    } as never);

    expect(await AsyncStorage.getItem('product-analytics-queue-v1')).toBeNull();
  });

  it('keeps activation insight analytics free of dream-derived semantic properties', async () => {
    const provider = createProductAnalyticsProvider();
    const safeProperties = {
      surface: 'draft',
      capture_context: 'fresh',
      transcript_length_bucket: '0_100',
      language: 'fr',
    } as const;

    await provider.track('recording_activation_insight_shown', safeProperties);
    await provider.track('recording_activation_insight_shown', {
      ...safeProperties,
      tone: 'signals',
      primary_signal_id: 'emotion',
      signal_ids: 'emotion,place',
      signal_count: 2,
    } as never);

    const queue = JSON.parse((await AsyncStorage.getItem('product-analytics-queue-v1')) ?? '[]');
    expect(queue).toHaveLength(1);
    expect(queue[0].properties).toEqual(safeProperties);
  });

  it('deduplicates first_value_viewed once per seven-day journey', async () => {
    const provider = createProductAnalyticsProvider();
    const properties = {
      value: 'recording_insight',
      onboarding_path: 'skip',
      hours_since_onboarding_bucket: '0_1h',
    } as const;

    await provider.track('first_value_viewed', properties);
    await provider.track('first_value_viewed', properties);

    const queue = JSON.parse((await AsyncStorage.getItem('product-analytics-queue-v1')) ?? '[]');
    expect(queue.filter((item: { event_name: string }) => item.event_name === 'first_value_viewed')).toHaveLength(1);
  });

  it('purges a corrupt FIFO head instead of blocking later valid events', async () => {
    await AsyncStorage.setItem('product-analytics-queue-v1', JSON.stringify([{
      event_id: 'not-a-uuid',
      event_name: 'unknown_event',
      schema_version: 1,
      occurred_at: new Date().toISOString(),
      journey_id: null,
      platform: 'android',
      app_version: '2.0.2',
      locale: 'fr',
      properties: { transcript: 'private' },
    }]));

    const provider = createProductAnalyticsProvider();
    await provider.track('onboarding_step_viewed', { step: 'path' });

    const queue = JSON.parse((await AsyncStorage.getItem('product-analytics-queue-v1')) ?? '[]');
    expect(queue).toHaveLength(1);
    expect(queue[0].event_name).toBe('onboarding_step_viewed');
    expect(queue[0].event_id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('removes a malformed queue JSON blob before accepting a valid event', async () => {
    await AsyncStorage.setItem('product-analytics-queue-v1', '{not-json');

    const provider = createProductAnalyticsProvider();
    await provider.track('onboarding_step_viewed', { step: 'intro' });

    const raw = await AsyncStorage.getItem('product-analytics-queue-v1');
    expect(() => JSON.parse(raw ?? '')).not.toThrow();
    expect(JSON.parse(raw ?? '[]')).toHaveLength(1);
  });

  it('persists an opposition even when analytics transport is unavailable', async () => {
    Platform.OS = 'web';

    await setProductAnalyticsEnabled(false);

    expect(await getProductAnalyticsPreference()).toBe('disabled');
    expect(await AsyncStorage.getItem('product-analytics-preference-v1')).toBe('disabled');
  });

  it('fails closed when the stored preference cannot be read', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(getProductAnalyticsPreference()).resolves.toBe('disabled');
  });

  it('treats an unknown stored preference as disabled while null remains the default opt-in', async () => {
    await AsyncStorage.setItem('product-analytics-preference-v1', 'unexpected-value');
    await resetProductAnalyticsForTesting();
    expect(await getProductAnalyticsPreference()).toBe('disabled');

    await AsyncStorage.removeItem('product-analytics-preference-v1');
    await resetProductAnalyticsForTesting();
    expect(await getProductAnalyticsPreference()).toBe('enabled');
  });

  it('uses the effective app locale supplied by the bootstrap', async () => {
    setProductAnalyticsLocale('it');
    const provider = createProductAnalyticsProvider();
    await provider.track('onboarding_started', { experience_version: 2 });

    const queue = JSON.parse((await AsyncStorage.getItem('product-analytics-queue-v1')) ?? '[]');
    expect(queue[0].locale).toBe('it');
  });

  it('purges queued data for the session even if persisting an opposition fails', async () => {
    const provider = createProductAnalyticsProvider();
    await provider.track('onboarding_started', { experience_version: 2 });
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(setProductAnalyticsEnabled(false)).rejects.toThrow('storage unavailable');

    expect(await AsyncStorage.getItem('product-analytics-queue-v1')).toBeNull();
    expect(await getProductAnalyticsPreference()).toBe('disabled');
  });

  it('purges queued events immediately and requests deletion of known journeys', async () => {
    const provider = createProductAnalyticsProvider();
    await provider.track('onboarding_started', { experience_version: 2 });
    mockNetworkState.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: Network.NetworkStateType.WIFI,
    });
    mockFetch.mockResolvedValue({ deleted: true });

    await setProductAnalyticsEnabled(false);

    expect(await AsyncStorage.getItem('product-analytics-queue-v1')).toBeNull();
    expect(await AsyncStorage.getItem('product-analytics-journey-v1')).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.test/api/analytics/events',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('serializes an in-flight POST before the final opt-out DELETE', async () => {
    mockNetworkState.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: Network.NetworkStateType.WIFI,
    });
    let releasePost: () => void = () => undefined;
    const postGate = new Promise<void>((resolve) => {
      releasePost = resolve;
    });
    mockFetch.mockImplementation(async (_url, options) => {
      if (options.method === 'POST') {
        await postGate;
        const ids = ((options.body as { events: { event_id: string }[] }).events)
          .map((event) => event.event_id);
        return { accepted_event_ids: ids };
      }
      return { deleted: true };
    });

    const provider = createProductAnalyticsProvider();
    await provider.track('onboarding_started', { experience_version: 2 });
    for (let index = 0; index < 20 && !mockFetch.mock.calls.some(([, options]) => options.method === 'POST'); index += 1) {
      await Promise.resolve();
    }
    expect(mockFetch.mock.calls.some(([, options]) => options.method === 'POST')).toBe(true);

    const disablePromise = setProductAnalyticsEnabled(false);
    await Promise.resolve();
    expect(mockFetch.mock.calls.some(([, options]) => options.method === 'DELETE')).toBe(false);
    releasePost();
    await disablePromise;

    const methods = mockFetch.mock.calls.map(([, options]) => options.method);
    expect(methods).toEqual(['POST', 'DELETE']);
    expect(await AsyncStorage.getItem('product-analytics-queue-v1')).toBeNull();
  });

  it('batches more than 20 pending deletions without loss', async () => {
    const baseNow = Date.now();
    const pending = Array.from({ length: 25 }, (_, index) => ({
      journeyId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      expiresAt: baseNow + 7 * 24 * 60 * 60 * 1000,
    }));
    await AsyncStorage.setItem('product-analytics-pending-deletion-v1', JSON.stringify(pending));
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseNow);

    await initializeProductAnalytics();
    expect(JSON.parse((await AsyncStorage.getItem('product-analytics-pending-deletion-v1')) ?? '[]')).toHaveLength(25);

    mockNetworkState.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: Network.NetworkStateType.WIFI,
    });
    mockFetch.mockResolvedValue({ deleted: true });
    await initializeProductAnalytics();

    const deleteCalls = mockFetch.mock.calls.filter(([, options]) => options.method === 'DELETE');
    expect(deleteCalls).toHaveLength(2);
    expect((deleteCalls[0][1].body as { journey_ids: string[] }).journey_ids).toHaveLength(20);
    expect((deleteCalls[1][1].body as { journey_ids: string[] }).journey_ids).toHaveLength(5);
    expect(await AsyncStorage.getItem('product-analytics-pending-deletion-v1')).toBeNull();
    nowSpy.mockRestore();
  });

  it('drops pending deletion identifiers after seven days even when remote deletion fails', async () => {
    const baseNow = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseNow);
    const provider = createProductAnalyticsProvider();
    await provider.track('onboarding_started', { experience_version: 2 });
    nowSpy.mockReturnValue(baseNow + 6 * 24 * 60 * 60 * 1000);
    mockNetworkState.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: Network.NetworkStateType.WIFI,
    });
    mockFetch.mockRejectedValue(new Error('remote unavailable'));

    await setProductAnalyticsEnabled(false);

    const pendingRaw = await AsyncStorage.getItem('product-analytics-pending-deletion-v1');
    const pending = JSON.parse(pendingRaw ?? '[]');
    expect(pending).toHaveLength(1);
    expect(pending[0].expiresAt).toBe(baseNow + 7 * 24 * 60 * 60 * 1000);

    nowSpy.mockReturnValue(baseNow + 7 * 24 * 60 * 60 * 1000 + 1);
    mockNetworkState.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
      type: Network.NetworkStateType.NONE,
    });
    await initializeProductAnalytics();

    expect(await AsyncStorage.getItem('product-analytics-pending-deletion-v1')).toBeNull();
    nowSpy.mockRestore();
  });

  it('purges without backfill when the server kill switch is disabled', async () => {
    mockNetworkState.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: Network.NetworkStateType.WIFI,
    });
    mockFetch.mockRejectedValue({
      status: 503,
      body: { error: { code: 'ANALYTICS_INGEST_DISABLED' } },
    });

    const provider = createProductAnalyticsProvider();
    await provider.track('onboarding_started', { experience_version: 2 });
    await flushProductAnalytics();

    expect(await AsyncStorage.getItem('product-analytics-queue-v1')).toBeNull();
    expect(await AsyncStorage.getItem('product-analytics-journey-v1')).toBeNull();
    expect(isProductAnalyticsAvailable()).toBe(false);
    const callsAfterDisable = mockFetch.mock.calls.length;

    await provider.track('onboarding_step_viewed', { step: 'path' });
    await flushProductAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(callsAfterDisable);
    expect(await AsyncStorage.getItem('product-analytics-queue-v1')).toBeNull();
  });
});
