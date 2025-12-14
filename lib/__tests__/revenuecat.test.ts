import { describe, expect, it } from 'vitest';

import {
  getActiveEntitlement,
  mapIntervalFromId,
  mapPackage,
  mapStatus,
  mapTierFromCustomerInfo,
  type CustomerInfoLike,
  type PurchasesPackageLike,
} from '../revenuecat';

describe('revenuecat utils', () => {
  describe('getActiveEntitlement', () => {
    it('given null info returns null', () => {
      expect(getActiveEntitlement(null)).toBeNull();
    });

    it('given empty entitlements returns null', () => {
      const info: CustomerInfoLike = {
        entitlements: { active: {} },
      };
      expect(getActiveEntitlement(info)).toBeNull();
    });

    it('given premium entitlement returns it', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            premium: {
              productIdentifier: 'noctalia_premium_monthly',
              expirationDate: '2024-12-31',
            },
          },
        },
      };

      const result = getActiveEntitlement(info);

      expect(result).toEqual({
        productIdentifier: 'noctalia_premium_monthly',
        expirationDate: '2024-12-31',
      });
    });

    it('given noctalia_plus entitlement returns it', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            noctalia_plus: {
              productIdentifier: 'noctalia_plus_annual',
              expirationDate: '2025-03-15',
            },
          },
        },
      };

      const result = getActiveEntitlement(info);

      expect(result?.productIdentifier).toBe('noctalia_plus_annual');
    });

    it('given multiple entitlements returns highest priority', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            noctaliaPlus: { productIdentifier: 'low_priority' },
            premium: { productIdentifier: 'high_priority' },
            'noctalia-plus': { productIdentifier: 'medium_priority' },
          },
        },
      };

      const result = getActiveEntitlement(info);

      expect(result?.productIdentifier).toBe('high_priority');
    });

    it('given unknown entitlement key returns first one', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            custom_entitlement: {
              productIdentifier: 'custom_product',
            },
          },
        },
      };

      const result = getActiveEntitlement(info);

      expect(result?.productIdentifier).toBe('custom_product');
    });

    it('given undefined entitlements returns null', () => {
      const info: CustomerInfoLike = {};
      expect(getActiveEntitlement(info)).toBeNull();
    });
  });

  describe('mapTierFromCustomerInfo', () => {
    it('given null info returns free tier', () => {
      expect(mapTierFromCustomerInfo(null)).toBe('free');
    });

    it('given no active entitlements returns free tier', () => {
      const info: CustomerInfoLike = {
        entitlements: { active: {} },
      };
      expect(mapTierFromCustomerInfo(info)).toBe('free');
    });

    it('given active premium entitlement returns premium tier', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            premium: { productIdentifier: 'test' },
          },
        },
      };
      expect(mapTierFromCustomerInfo(info)).toBe('premium');
    });

    it('given any active entitlement returns premium tier', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            some_random_entitlement: { productIdentifier: 'test' },
          },
        },
      };
      expect(mapTierFromCustomerInfo(info)).toBe('premium');
    });
  });

  describe('mapStatus', () => {
    it('given null info returns free inactive status', () => {
      const result = mapStatus(null);

      expect(result).toEqual({
        tier: 'free',
        isActive: false,
        expiryDate: null,
        productId: null,
      });
    });

    it('given active subscription returns premium active status', () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            premium: {
              productIdentifier: 'noctalia_monthly',
              expirationDate: futureDate,
            },
          },
        },
      };

      const result = mapStatus(info);

      expect(result).toEqual({
        tier: 'premium',
        isActive: true,
        expiryDate: futureDate,
        productId: 'noctalia_monthly',
      });
    });

    it('given entitlement without expiration date returns null expiry', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            premium: {
              productIdentifier: 'lifetime_purchase',
            },
          },
        },
      };

      const result = mapStatus(info);

      expect(result.expiryDate).toBeNull();
      expect(result.isActive).toBe(true);
    });

    it('given entitlement with null expiration returns null expiry', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            premium: {
              productIdentifier: 'test',
              expirationDate: null,
            },
          },
        },
      };

      const result = mapStatus(info);

      expect(result.expiryDate).toBeNull();
    });
  });

  describe('mapIntervalFromId', () => {
    it('given ANNUAL packageType returns annual', () => {
      expect(mapIntervalFromId('any_id', 'ANNUAL')).toBe('annual');
    });

    it('given MONTHLY packageType returns monthly', () => {
      expect(mapIntervalFromId('any_id', 'MONTHLY')).toBe('monthly');
    });

    it('given id containing "year" returns annual', () => {
      expect(mapIntervalFromId('noctalia_yearly_premium')).toBe('annual');
    });

    it('given id containing "annual" returns annual', () => {
      expect(mapIntervalFromId('noctalia_annual_sub')).toBe('annual');
    });

    it('given id containing "annuel" returns annual', () => {
      expect(mapIntervalFromId('abonnement_annuel')).toBe('annual');
    });

    it('given id with uppercase ANNUAL returns annual', () => {
      expect(mapIntervalFromId('NOCTALIA_ANNUAL')).toBe('annual');
    });

    it('given monthly id without packageType returns monthly', () => {
      expect(mapIntervalFromId('noctalia_monthly_premium')).toBe('monthly');
    });

    it('given unknown id without packageType defaults to monthly', () => {
      expect(mapIntervalFromId('noctalia_premium_v2')).toBe('monthly');
    });

    it('given packageType takes precedence over id', () => {
      // ID suggests annual but packageType is MONTHLY
      expect(mapIntervalFromId('annual_plan', 'MONTHLY')).toBe('monthly');
    });
  });

  describe('mapPackage', () => {
    it('given full package info returns mapped package', () => {
      const pkg: PurchasesPackageLike = {
        identifier: 'noctalia_monthly',
        packageType: 'MONTHLY',
        product: {
          price: 4.99,
          priceString: '$4.99',
          currencyCode: 'USD',
          title: 'Monthly Premium',
          description: 'Full access to all features',
        },
      };

      const result = mapPackage(pkg);

      expect(result).toEqual({
        id: 'noctalia_monthly',
        interval: 'monthly',
        price: 4.99,
        priceFormatted: '$4.99',
        currency: 'USD',
        title: 'Monthly Premium',
        description: 'Full access to all features',
      });
    });

    it('given annual package returns annual interval', () => {
      const pkg: PurchasesPackageLike = {
        identifier: 'noctalia_annual',
        packageType: 'ANNUAL',
        product: {
          priceString: '$39.99',
          currencyCode: 'USD',
          title: 'Annual Premium',
          description: 'Best value!',
        },
      };

      const result = mapPackage(pkg);

      expect(result.interval).toBe('annual');
    });

    it('given missing product fields uses empty strings', () => {
      const pkg: PurchasesPackageLike = {
        identifier: 'minimal_pkg',
        product: {},
      };

      const result = mapPackage(pkg);

      expect(result).toEqual({
        id: 'minimal_pkg',
        interval: 'monthly',
        price: 0,
        priceFormatted: '',
        currency: '',
        title: '',
        description: '',
      });
    });

    it('given EUR currency formats correctly', () => {
      const pkg: PurchasesPackageLike = {
        identifier: 'noctalia_monthly_eu',
        packageType: 'MONTHLY',
        product: {
          priceString: '4,99 €',
          currencyCode: 'EUR',
          title: 'Mensuel Premium',
          description: 'Accès complet',
        },
      };

      const result = mapPackage(pkg);

      expect(result.priceFormatted).toBe('4,99 €');
      expect(result.currency).toBe('EUR');
    });

    it('given packageType undefined infers from id', () => {
      const pkg: PurchasesPackageLike = {
        identifier: 'yearly_subscription',
        product: {
          priceString: '$29.99',
          currencyCode: 'USD',
          title: 'Yearly',
          description: 'Yearly subscription',
        },
      };

      const result = mapPackage(pkg);

      expect(result.interval).toBe('annual');
    });
  });
});
