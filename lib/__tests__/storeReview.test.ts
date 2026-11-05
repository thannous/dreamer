import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';
import {
  canOpenStoreReviewPage,
  markStoreReviewPaywallSeen,
  openStoreReviewPage,
  recordStoreReviewAnalysisRead,
  requestStoreReviewIfDue,
} from '@/lib/storeReview';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(async () => true),
  requestReview: jest.fn(async () => undefined),
}));

// The native sheet cannot be observed by an E2E journey, so these cases pin the
// pacing that keeps the app from asking too early, too often or after the paywall.
const DAY_MS = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 9, 1, 9);

async function readAnalyses(count: number) {
  for (let i = 0; i < count; i += 1) await recordStoreReviewAnalysisRead();
}

describe('store review pacing', () => {
  let now = START;

  beforeEach(async () => {
    now = START;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    await AsyncStorage.clear();
    jest.mocked(StoreReview.requestReview).mockClear();
    markStoreReviewPaywallSeen(START - 365 * DAY_MS);
  });

  afterEach(() => jest.restoreAllMocks());

  it('waits for the third analysis read and two days after first use', async () => {
    await readAnalyses(2);
    now = START + 3 * DAY_MS;
    await expect(requestStoreReviewIfDue({ kind: 'analysis_read' })).resolves.toBe(false);

    now = START;
    await readAnalyses(1);
    await expect(requestStoreReviewIfDue({ kind: 'analysis_read' })).resolves.toBe(false);

    now = START + 2 * DAY_MS;
    await expect(requestStoreReviewIfDue({ kind: 'analysis_read' })).resolves.toBe(true);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('asks at most once every 30 days, even when the store request fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.mocked(StoreReview.requestReview).mockRejectedValueOnce(new Error('no activity'));
    await readAnalyses(3);
    now = START + 3 * DAY_MS;
    await expect(requestStoreReviewIfDue({ kind: 'analysis_read' })).resolves.toBe(true);

    now += 29 * DAY_MS;
    await expect(requestStoreReviewIfDue({ kind: 'weekly_recap', dreamCount: 6 })).resolves.toBe(false);

    now += DAY_MS;
    await expect(requestStoreReviewIfDue({ kind: 'weekly_recap', dreamCount: 6 })).resolves.toBe(true);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(2);
  });

  it('needs three dreams in the weekly recap', async () => {
    await recordStoreReviewAnalysisRead();
    now = START + 3 * DAY_MS;
    await expect(requestStoreReviewIfDue({ kind: 'weekly_recap', dreamCount: 2 })).resolves.toBe(false);
    await expect(requestStoreReviewIfDue({ kind: 'weekly_recap', dreamCount: 3 })).resolves.toBe(true);
  });

  it('stays quiet for ten minutes after the paywall', async () => {
    await readAnalyses(3);
    now = START + 3 * DAY_MS;
    markStoreReviewPaywallSeen(now);

    now += 9 * 60 * 1000;
    await expect(requestStoreReviewIfDue({ kind: 'analysis_read' })).resolves.toBe(false);

    now += 60 * 1000;
    await expect(requestStoreReviewIfDue({ kind: 'analysis_read' })).resolves.toBe(true);
  });

  it('does not ask when the store cannot show the sheet', async () => {
    jest.mocked(StoreReview.isAvailableAsync).mockResolvedValueOnce(false);
    await readAnalyses(3);
    now = START + 3 * DAY_MS;
    await expect(requestStoreReviewIfDue({ kind: 'analysis_read' })).resolves.toBe(false);
    await expect(requestStoreReviewIfDue({ kind: 'analysis_read' })).resolves.toBe(true);
  });
});

// Settings shows "Rate app" only where the store page that takes a review exists.
describe('store review page from Settings', () => {
  afterEach(() => jest.restoreAllMocks());

  it('offers the Play Store page, and no App Store page before the first iOS release is on sale', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    jest.replaceProperty(Platform, 'OS', 'android');
    expect(canOpenStoreReviewPage()).toBe(true);
    await openStoreReviewPage();
    expect(openURL).toHaveBeenCalledWith('market://details?id=com.tanuki75.noctalia');

    jest.replaceProperty(Platform, 'OS', 'ios');
    expect(canOpenStoreReviewPage()).toBe(false);
    jest.replaceProperty(Platform, 'OS', 'web');
    expect(canOpenStoreReviewPage()).toBe(false);
  });
});
