export const LUCID_ANALYTICS_EVENT_NAMES = [
  'lucid_activation_completed',
  'lucid_training_completed',
  'lucid_retention_observed',
  'lucid_noctalia_handoff',
  'lucid_conversion',
] as const;

export type LucidAnalyticsEventName =
  (typeof LUCID_ANALYTICS_EVENT_NAMES)[number];
export type LucidAnalyticsPreference = 'disabled' | 'enabled';

export const DEFAULT_LUCID_ANALYTICS_PREFERENCE: LucidAnalyticsPreference =
  'disabled';

export type LucidAnalyticsPropertiesByEvent = {
  lucid_activation_completed: {
    goal: 'lucidity' | 'recall' | 'consistency' | 'exploration';
    experience: 'new' | 'some' | 'experienced';
    reminder_frequency: 'none' | 'low' | 'medium' | 'high';
  };
  lucid_training_completed: {
    technique: 'mild' | 'ssild' | 'wbtb';
    phase: 'day' | 'bedtime' | 'night' | 'morning';
    outcome: 'completed' | 'skipped' | 'interrupted';
    duration: 'under_5m' | '5_15m' | '15m_plus';
  };
  lucid_retention_observed: {
    week: 'week_1' | 'week_2_4' | 'week_5_plus';
    active_days: '0' | '1_2' | '3_4' | '5_7';
    status: 'active' | 'returning' | 'lapsed';
  };
  lucid_noctalia_handoff: {
    action: 'open_noctalia' | 'transfer_summary';
    outcome: 'opened' | 'fallback' | 'cancelled' | 'failed';
    transfer: 'none' | 'experiment_summary';
  };
  lucid_conversion: {
    surface: 'program' | 'paywall' | 'settings';
    action: 'viewed' | 'started' | 'completed' | 'restored';
    tier: 'free' | 'plus' | 'unknown';
  };
};

export type LucidAnalyticsEvent = {
  [Name in LucidAnalyticsEventName]: {
    schemaVersion: 1;
    eventName: Name;
    properties: Readonly<LucidAnalyticsPropertiesByEvent[Name]>;
  };
}[LucidAnalyticsEventName];

const EVENT_PROPERTY_ALLOWLIST = {
  lucid_activation_completed: {
    goal: ['lucidity', 'recall', 'consistency', 'exploration'],
    experience: ['new', 'some', 'experienced'],
    reminder_frequency: ['none', 'low', 'medium', 'high'],
  },
  lucid_training_completed: {
    technique: ['mild', 'ssild', 'wbtb'],
    phase: ['day', 'bedtime', 'night', 'morning'],
    outcome: ['completed', 'skipped', 'interrupted'],
    duration: ['under_5m', '5_15m', '15m_plus'],
  },
  lucid_retention_observed: {
    week: ['week_1', 'week_2_4', 'week_5_plus'],
    active_days: ['0', '1_2', '3_4', '5_7'],
    status: ['active', 'returning', 'lapsed'],
  },
  lucid_noctalia_handoff: {
    action: ['open_noctalia', 'transfer_summary'],
    outcome: ['opened', 'fallback', 'cancelled', 'failed'],
    transfer: ['none', 'experiment_summary'],
  },
  lucid_conversion: {
    surface: ['program', 'paywall', 'settings'],
    action: ['viewed', 'started', 'completed', 'restored'],
    tier: ['free', 'plus', 'unknown'],
  },
} as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function isEventName(value: unknown): value is LucidAnalyticsEventName {
  return LUCID_ANALYTICS_EVENT_NAMES.includes(value as LucidAnalyticsEventName);
}

function hasAllowedProperties(
  eventName: LucidAnalyticsEventName,
  properties: unknown
): properties is LucidAnalyticsPropertiesByEvent[LucidAnalyticsEventName] {
  if (!isPlainObject(properties)) return false;

  const schema = EVENT_PROPERTY_ALLOWLIST[eventName] as Record<
    string,
    readonly string[]
  >;
  const keys = Object.keys(schema);
  if (!hasExactKeys(properties, keys)) return false;

  return keys.every((key) => {
    const value = properties[key];
    return typeof value === 'string' && schema[key]?.includes(value) === true;
  });
}

export function resolveLucidAnalyticsPreference(
  storedValue: unknown
): LucidAnalyticsPreference {
  return storedValue === 'enabled' || storedValue === true
    ? 'enabled'
    : DEFAULT_LUCID_ANALYTICS_PREFERENCE;
}

export function parseLucidAnalyticsEvent(
  value: unknown
): LucidAnalyticsEvent | null {
  if (!isPlainObject(value)) return null;
  if (!hasExactKeys(value, ['schemaVersion', 'eventName', 'properties'])) {
    return null;
  }
  if (value.schemaVersion !== 1 || !isEventName(value.eventName)) return null;
  if (!hasAllowedProperties(value.eventName, value.properties)) return null;

  return {
    schemaVersion: 1,
    eventName: value.eventName,
    properties: { ...value.properties },
  } as LucidAnalyticsEvent;
}

export function createLucidAnalyticsEvent<
  Name extends LucidAnalyticsEventName,
>(
  preference: unknown,
  eventName: Name,
  properties: LucidAnalyticsPropertiesByEvent[Name] | unknown
): Extract<LucidAnalyticsEvent, { eventName: Name }> | null {
  if (resolveLucidAnalyticsPreference(preference) !== 'enabled') return null;

  return parseLucidAnalyticsEvent({
    schemaVersion: 1,
    eventName,
    properties,
  }) as Extract<LucidAnalyticsEvent, { eventName: Name }> | null;
}
