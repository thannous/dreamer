import { getExpoPublicEnvValue, isAnalyticsDebugEnabled, isMockModeEnabled } from '@/lib/env';
import { createScopedLogger } from '@/lib/logger';
import type { SubscriptionTier } from '@/lib/types';

const log = createScopedLogger('[Analytics]');

export type AnalyticsEventMap = {
  recording_started: {
    input_mode: 'voice' | 'text';
    language: string;
    speech_available: boolean;
    offline_model_state: 'ready' | 'online_fallback' | 'unavailable' | 'unknown';
  };
  recording_saved: {
    input_mode: 'voice' | 'text';
    duration_bucket: '0_15s' | '16_60s' | '61_180s' | '181s_plus' | 'unknown';
    transcript_length_bucket: '0_100' | '101_500' | '501_1500' | '1501_plus';
  };
  analysis_started: {
    source: 'recording_flow' | 'journal_detail' | 'retry' | 'unknown';
    tier: SubscriptionTier;
    guest_status: 'guest' | 'signed_in';
  };
  analysis_completed: {
    duration_ms_bucket: '0_5s' | '5_15s' | '15_45s' | '45s_plus';
    generated_image: boolean;
    tier: SubscriptionTier;
  };
  paywall_viewed: {
    trigger: PaywallTrigger;
    tier: SubscriptionTier;
    usage_count: number | null;
    offering_id: string | null;
  };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;
export type AnalysisSource = AnalyticsEventMap['analysis_started']['source'];

export type PaywallTrigger =
  | 'analysis_limit'
  | 'analysis_cta'
  | 'exploration_limit'
  | 'image_generation'
  | 'settings'
  | 'settings_quota'
  | 'restore'
  | 'returning_device'
  | 'direct';

export type AnalyticsProvider = {
  track: <TName extends AnalyticsEventName>(
    eventName: TName,
    properties: AnalyticsEventMap[TName]
  ) => void | Promise<void>;
};

let provider: AnalyticsProvider | null = null;
let defaultProviderConfigured = false;

export function setAnalyticsProvider(nextProvider: AnalyticsProvider | null) {
  provider = nextProvider;
  defaultProviderConfigured = true;
}

export function resetAnalyticsProviderForTesting() {
  provider = null;
  defaultProviderConfigured = false;
}

function sanitizeAnalyticsProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => {
      if (value == null || typeof value === 'boolean' || typeof value === 'number') {
        return [key, value];
      }
      if (typeof value === 'string') {
        return [key, value.length > 96 ? `${value.slice(0, 96)}...` : value];
      }
      return [key, '[redacted]'];
    })
  );
}

export function createDebugAnalyticsProvider(): AnalyticsProvider {
  return {
    track: (eventName, properties) => {
      log.debug('event', eventName, sanitizeAnalyticsProperties(properties as Record<string, unknown>));
    },
  };
}

export function configureAnalyticsProvider() {
  if (defaultProviderConfigured || provider) {
    return;
  }

  defaultProviderConfigured = true;

  if (isAnalyticsDebugEnabled()) {
    provider = createDebugAnalyticsProvider();
  }
}

export function getTranscriptLengthBucket(
  text: string
): AnalyticsEventMap['recording_saved']['transcript_length_bucket'] {
  const length = text.trim().length;
  if (length <= 100) return '0_100';
  if (length <= 500) return '101_500';
  if (length <= 1500) return '501_1500';
  return '1501_plus';
}

export function getDurationMsBucket(
  durationMs: number
): AnalyticsEventMap['analysis_completed']['duration_ms_bucket'] {
  if (durationMs <= 5000) return '0_5s';
  if (durationMs <= 15000) return '5_15s';
  if (durationMs <= 45000) return '15_45s';
  return '45s_plus';
}

export function getRecordingDurationBucket(
  durationMs: number | null | undefined
): AnalyticsEventMap['recording_saved']['duration_bucket'] {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) return 'unknown';
  if (durationMs <= 15000) return '0_15s';
  if (durationMs <= 60000) return '16_60s';
  if (durationMs <= 180000) return '61_180s';
  return '181s_plus';
}

export function getPaywallTrigger(value: unknown): PaywallTrigger {
  if (typeof value !== 'string') return 'direct';
  const candidate = value.trim();
  switch (candidate) {
    case 'analysis_limit':
    case 'analysis_cta':
    case 'exploration_limit':
    case 'image_generation':
    case 'settings':
    case 'settings_quota':
    case 'restore':
    case 'returning_device':
    case 'direct':
      return candidate;
    default:
      return 'direct';
  }
}

export async function trackProductEvent<TName extends AnalyticsEventName>(
  eventName: TName,
  properties: AnalyticsEventMap[TName]
) {
  if (isMockModeEnabled() || getExpoPublicEnvValue('EXPO_PUBLIC_MOCK_MODE') === 'true') {
    return;
  }

  configureAnalyticsProvider();

  if (!provider) {
    return;
  }

  try {
    await provider.track(eventName, properties);
  } catch (error) {
    log.warn('track failed', eventName, error);
  }
}
