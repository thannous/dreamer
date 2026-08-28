import { Platform } from 'react-native';

import {
  LUCID_HK_SLEEP_ANALYSIS_IDENTIFIER,
  normalizeLucidHkSleepSamples,
  type LucidHkSleepNormalization,
  type LucidHkSleepSampleInput,
} from '@/lib/lucid/healthKitSleep';

export type LucidHealthKitAvailability = 'available' | 'unavailable';

export type LucidHealthKitEmptyReason =
  | 'query_before_auth'
  | 'unavailable'
  | 'native_failure'
  | 'ambiguous_empty'
  | 'invalid_range';

export const LUCID_HK_SLEEP_QUERY_LIMIT = 512 as const;

export type LucidHealthKitQueryResult =
  | { status: 'ready'; normalization: LucidHkSleepNormalization }
  | { status: 'empty'; reason: LucidHealthKitEmptyReason; detail: string };

export type LucidHealthKitNativeQueryOptions = {
  filter?: { date?: { startDate?: Date; endDate?: Date } };
  limit: number;
  ascending: boolean;
};

export type LucidHealthKitNative = {
  isHealthDataAvailable?: () => boolean;
  isHealthDataAvailableAsync?: () => Promise<boolean>;
  requestAuthorization?: (request: {
    toRead?: string[];
    toShare?: string[];
  }) => Promise<boolean>;
  queryCategorySamples?: (
    identifier: string,
    options: LucidHealthKitNativeQueryOptions
  ) => Promise<LucidHkSleepSampleInput[]>;
};

async function defaultNative(): Promise<LucidHealthKitNative | null> {
  try {
    return (await import('@kingstinct/react-native-healthkit')) as unknown as LucidHealthKitNative;
  } catch {
    return null;
  }
}

async function readAvailability(native: LucidHealthKitNative | null): Promise<boolean> {
  if (!native) return false;
  if (typeof native.isHealthDataAvailable === 'function') {
    try {
      return native.isHealthDataAvailable() === true;
    } catch {
      return false;
    }
  }
  if (typeof native.isHealthDataAvailableAsync === 'function') {
    try {
      return (await native.isHealthDataAvailableAsync()) === true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function getLucidHealthKitAvailability(
  native?: LucidHealthKitNative | null
): Promise<LucidHealthKitAvailability> {
  if (Platform.OS !== 'ios') return 'unavailable';
  const resolved = native === undefined ? await defaultNative() : native;
  return (await readAvailability(resolved)) ? 'available' : 'unavailable';
}

export async function requestLucidHealthKitSleepReadAuthorization(
  native?: LucidHealthKitNative | null
): Promise<{ status: 'prompted' | 'unavailable' | 'native_failure'; authorized?: boolean }> {
  const resolved = native === undefined ? await defaultNative() : native;
  if ((await getLucidHealthKitAvailability(resolved)) === 'unavailable') {
    return { status: 'unavailable' };
  }
  if (typeof resolved?.requestAuthorization !== 'function') {
    return { status: 'native_failure' };
  }
  try {
    const authorized = await resolved.requestAuthorization({
      toRead: [LUCID_HK_SLEEP_ANALYSIS_IDENTIFIER],
    });
    return { status: 'prompted', authorized: authorized === true };
  } catch {
    return { status: 'native_failure' };
  }
}

function isValidQueryRange(range: { startDate: Date; endDate: Date }): boolean {
  const startMs = range.startDate instanceof Date ? range.startDate.getTime() : Number.NaN;
  const endMs = range.endDate instanceof Date ? range.endDate.getTime() : Number.NaN;
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
}

export async function queryLucidHealthKitSleepAnalysis(
  range: { startDate: Date; endDate: Date },
  options: { hasRequestedAuthorization: boolean; native?: LucidHealthKitNative | null } = {
    hasRequestedAuthorization: false,
  }
): Promise<LucidHealthKitQueryResult> {
  const native = options.native === undefined ? await defaultNative() : options.native;
  if (!options.hasRequestedAuthorization) {
    return {
      status: 'empty',
      reason: 'query_before_auth',
      detail: 'Sleep import is requested only after an explicit connect/import action.',
    };
  }
  if (!isValidQueryRange(range)) {
    return {
      status: 'empty',
      reason: 'invalid_range',
      detail: 'Sleep import requires finite Date bounds with end after start.',
    };
  }
  if ((await getLucidHealthKitAvailability(native)) === 'unavailable') {
    return {
      status: 'empty',
      reason: 'unavailable',
      detail: 'HealthKit sleepAnalysis is unavailable on this platform or device.',
    };
  }
  if (typeof native?.queryCategorySamples !== 'function') {
    return {
      status: 'empty',
      reason: 'native_failure',
      detail: 'The HealthKit category query is missing.',
    };
  }
  try {
    const samples = await native.queryCategorySamples(LUCID_HK_SLEEP_ANALYSIS_IDENTIFIER, {
      filter: { date: { startDate: range.startDate, endDate: range.endDate } },
      limit: LUCID_HK_SLEEP_QUERY_LIMIT,
      ascending: true,
    });
    const rawCount = Array.isArray(samples) ? samples.length : 0;
    const normalization = normalizeLucidHkSleepSamples(samples ?? []);
    if (rawCount === 0) {
      return {
        status: 'empty',
        reason: 'ambiguous_empty',
        detail:
          'HealthKit returned no samples. iOS cannot distinguish a read denial from genuinely empty sleep data.',
      };
    }
    return { status: 'ready', normalization };
  } catch {
    return {
      status: 'empty',
      reason: 'native_failure',
      detail: 'The HealthKit query failed before any sleepAnalysis samples could be read.',
    };
  }
}
