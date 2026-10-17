import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';

import { logger } from '@/lib/logger';

/**
 * In-app store review requests. The native sheet is shown by Apple or Google,
 * who cap it on their side (Apple: 3 per year) and may show nothing at all, so
 * this module only decides when asking is worth it and never asks beforehand
 * whether the person likes the app (Play policy forbids that gating).
 */

const STATE_KEY = 'noctalia.storeReview.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

const IOS_APP_STORE_ID = '6805876363';
const ANDROID_PACKAGE = 'com.tanuki75.noctalia';
const IOS_WRITE_REVIEW_URL = `https://apps.apple.com/app/id${IOS_APP_STORE_ID}?action=write-review`;
const ANDROID_MARKET_URL = `market://details?id=${ANDROID_PACKAGE}`;
const ANDROID_WEB_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

export const STORE_REVIEW_RULES = {
  minAnalysesRead: 3,
  minWeeklyRecapDreams: 3,
  minDaysSinceFirstSeen: 2,
  minDaysBetweenRequests: 90,
  quietAfterPaywallMs: 10 * 60 * 1000,
} as const;

export type StoreReviewState = {
  firstSeenAt: number;
  analysesRead: number;
  lastRequestedAt: number | null;
};

export type StoreReviewTrigger =
  | { kind: 'analysis_read' }
  | { kind: 'weekly_recap'; dreamCount: number };

let lastPaywallAt: number | null = null;

/** The paywall is a poor moment to ask for a rating, and so are the minutes after it. */
export function markStoreReviewPaywallSeen(now = Date.now()): void {
  lastPaywallAt = now;
}

export function isStoreReviewDue(
  state: StoreReviewState,
  trigger: StoreReviewTrigger,
  now: number,
  paywallSeenAt: number | null = lastPaywallAt,
): boolean {
  if (now - state.firstSeenAt < STORE_REVIEW_RULES.minDaysSinceFirstSeen * DAY_MS) return false;
  if (
    state.lastRequestedAt !== null &&
    now - state.lastRequestedAt < STORE_REVIEW_RULES.minDaysBetweenRequests * DAY_MS
  ) {
    return false;
  }
  if (paywallSeenAt !== null && now - paywallSeenAt < STORE_REVIEW_RULES.quietAfterPaywallMs) {
    return false;
  }
  return trigger.kind === 'analysis_read'
    ? state.analysesRead >= STORE_REVIEW_RULES.minAnalysesRead
    : trigger.dreamCount >= STORE_REVIEW_RULES.minWeeklyRecapDreams;
}

function parseState(raw: string | null, now: number): StoreReviewState {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StoreReviewState>;
      if (typeof parsed.firstSeenAt === 'number') {
        return {
          firstSeenAt: parsed.firstSeenAt,
          analysesRead: typeof parsed.analysesRead === 'number' ? parsed.analysesRead : 0,
          lastRequestedAt: typeof parsed.lastRequestedAt === 'number' ? parsed.lastRequestedAt : null,
        };
      }
    } catch {
      // A corrupt record restarts the waiting period instead of asking early.
    }
  }
  return { firstSeenAt: now, analysesRead: 0, lastRequestedAt: null };
}

// Serialises read-modify-write so two screens cannot both ask or lose a count.
let stateChain: Promise<unknown> = Promise.resolve();

function updateState<T>(
  work: (state: StoreReviewState, now: number) => Promise<{ state: StoreReviewState; result: T }>,
): Promise<T> {
  const run = stateChain.then(async () => {
    const now = Date.now();
    const state = parseState(await AsyncStorage.getItem(STATE_KEY), now);
    const next = await work(state, now);
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(next.state));
    return next.result;
  });
  stateChain = run.catch(() => undefined);
  return run;
}

/** Counts a dream analysis that was shown to the person. */
export async function recordStoreReviewAnalysisRead(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await updateState(async (state) => ({
      state: { ...state, analysesRead: state.analysesRead + 1 },
      result: undefined,
    }));
  } catch (error) {
    logger.warn('[storeReview] Failed to record analysis read', error);
  }
}

/** Shows the native review sheet when the trigger and the pacing rules allow it. */
export async function requestStoreReviewIfDue(trigger: StoreReviewTrigger): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await updateState(async (state, now) => {
      if (!isStoreReviewDue(state, trigger, now) || !(await StoreReview.isAvailableAsync())) {
        return { state, result: false };
      }
      // Recorded before asking: a sheet the store chose not to show still counts,
      // so a failing request cannot turn into a retry on every screen exit.
      void StoreReview.requestReview().catch((error: unknown) => {
        logger.warn('[storeReview] Review request failed', error);
      });
      return { state: { ...state, lastRequestedAt: now }, result: true };
    });
  } catch (error) {
    logger.warn('[storeReview] Failed to evaluate review request', error);
    return false;
  }
}

export function canOpenStoreReviewPage(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Manual entry from settings: opens the store page where a review can be written. */
export async function openStoreReviewPage(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL(IOS_WRITE_REVIEW_URL);
      return;
    }
    if (Platform.OS === 'android') {
      try {
        await Linking.openURL(ANDROID_MARKET_URL);
      } catch {
        await Linking.openURL(ANDROID_WEB_URL);
      }
    }
  } catch (error) {
    logger.warn('[storeReview] Failed to open store page', error);
  }
}
