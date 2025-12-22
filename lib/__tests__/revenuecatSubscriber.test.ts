import { describe, expect, it } from 'vitest';

import {
  inferTierFromEntitlementKeys,
  inferTierFromSubscriber,
  isActiveEntitlement,
  type RevenueCatV1SubscriberResponse,
} from '../revenuecatSubscriber';

describe('revenuecatSubscriber', () => {
  it('returns free when entitlement keys are empty', () => {
    expect(inferTierFromEntitlementKeys([])).toBe('free');
  });

  it('returns null when entitlement keys are unknown', () => {
    expect(inferTierFromEntitlementKeys(['unknown_entitlement'])).toBeNull();
  });

  it('returns plus when active plus entitlement exists', () => {
    const now = new Date('2025-01-01T00:00:00.000Z').getTime();
    const info: RevenueCatV1SubscriberResponse = {
      subscriber: {
        entitlements: {
          'Noctalia Plus': {
            expires_date: new Date(now + 86400000).toISOString(),
          },
        },
      },
    };

    expect(inferTierFromSubscriber(info, now)).toBe('plus');
  });

  it('returns free when entitlement is expired', () => {
    const now = new Date('2025-01-01T00:00:00.000Z').getTime();
    const info: RevenueCatV1SubscriberResponse = {
      subscriber: {
        entitlements: {
          noctalia_plus: {
            expires_date: new Date(now - 1000).toISOString(),
          },
        },
      },
    };

    expect(inferTierFromSubscriber(info, now)).toBe('free');
  });

  it('treats grace period as active', () => {
    const now = new Date('2025-01-01T00:00:00.000Z').getTime();
    const ent = {
      expires_date: new Date(now - 1000).toISOString(),
      grace_period_expires_date: new Date(now + 3600000).toISOString(),
    };

    expect(isActiveEntitlement(ent, now)).toBe(true);
  });
});
