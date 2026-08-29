import { describe, expect, it } from '@jest/globals';

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

    it('given legacy Plus entitlement alias returns it', () => {
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

    it('given unknown entitlement key does not unlock Noctalia Plus', () => {
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

      expect(result).toBeNull();
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

    it('given active legacy Plus entitlement alias returns plus tier', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            premium: { productIdentifier: 'test' },
          },
        },
      };
      expect(mapTierFromCustomerInfo(info)).toBe('plus');
    });

    it('given an unknown active entitlement returns free tier', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            some_random_entitlement: { productIdentifier: 'test' },
          },
        },
      };
      expect(mapTierFromCustomerInfo(info)).toBe('free');
    });

    it('ignores a companion entitlement when Noctalia Plus is absent', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            lucid_trainer_plus: { productIdentifier: 'lucid_trainer_annual' },
          },
        },
      };

      expect(mapStatus(info)).toEqual({
        tier: 'free',
        isActive: false,
        expiryDate: null,
        productId: null,
        willRenew: undefined,
      });
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

    it('given active subscription returns plus active status', () => {
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
        tier: 'plus',
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

    it('preserves recognized Plus expiry history from entitlements.all without unlocking access', () => {
      const expiredAt = '2026-08-28T12:00:00.000Z';
      const info: CustomerInfoLike = {
        entitlements: {
          active: {},
          all: {
            plus: {
              productIdentifier: 'rc_promo_plus_yearly',
              expirationDate: expiredAt,
              willRenew: false,
            },
          },
        },
      };

      expect(mapStatus(info)).toEqual({
        tier: 'free',
        isActive: false,
        expiryDate: expiredAt,
        productId: 'rc_promo_plus_yearly',
        willRenew: false,
      });
    });

    it('ignores unknown or companion entitlements.all entries', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {},
          all: {
            lucid_trainer_plus: {
              productIdentifier: 'lucid_trainer_annual',
              expirationDate: '2026-08-28T12:00:00.000Z',
              willRenew: false,
            },
            custom_entitlement: {
              productIdentifier: 'custom_product',
              expirationDate: '2027-01-01T00:00:00.000Z',
            },
          },
        },
      };

      expect(mapStatus(info)).toEqual({
        tier: 'free',
        isActive: false,
        expiryDate: null,
        productId: null,
        willRenew: undefined,
      });
    });

    it('keeps an active recognized Plus entitlement over historical Plus entries', () => {
      const activeExpiry = '2027-08-28T12:00:00.000Z';
      const info: CustomerInfoLike = {
        entitlements: {
          active: {
            noctalia_plus: {
              productIdentifier: 'noctalia_plus_annual',
              expirationDate: activeExpiry,
              willRenew: true,
            },
          },
          all: {
            premium: {
              productIdentifier: 'noctalia_premium_monthly',
              expirationDate: '2026-01-15T00:00:00.000Z',
              willRenew: false,
            },
            noctalia_plus: {
              productIdentifier: 'noctalia_plus_annual',
              expirationDate: activeExpiry,
              willRenew: true,
            },
          },
        },
      };

      expect(mapStatus(info)).toEqual({
        tier: 'plus',
        isActive: true,
        expiryDate: activeExpiry,
        productId: 'noctalia_plus_annual',
        willRenew: true,
      });
    });

    it('selects the latest valid historical Plus expiration and never treats it as active', () => {
      const info: CustomerInfoLike = {
        entitlements: {
          active: {},
          all: {
            premium: {
              productIdentifier: 'noctalia_premium_monthly',
              expirationDate: '2026-01-15T00:00:00.000Z',
              willRenew: false,
            },
            noctalia_plus: {
              productIdentifier: 'noctalia_plus_annual',
              expirationDate: '2026-08-28T12:00:00.000Z',
              willRenew: false,
            },
            plus: {
              productIdentifier: 'rc_promo_plus_yearly',
              expirationDate: 'not-a-date',
              willRenew: true,
            },
          },
        },
      };

      expect(mapStatus(info)).toEqual({
        tier: 'free',
        isActive: false,
        expiryDate: '2026-08-28T12:00:00.000Z',
        productId: 'noctalia_plus_annual',
        willRenew: false,
      });
    });

    it('does not invent expiry history when entitlements.all is absent or empty', () => {
      expect(mapStatus({ entitlements: { active: {} } })).toEqual({
        tier: 'free',
        isActive: false,
        expiryDate: null,
        productId: null,
        willRenew: undefined,
      });

      expect(mapStatus({ entitlements: { active: {}, all: {} } })).toEqual({
        tier: 'free',
        isActive: false,
        expiryDate: null,
        productId: null,
        willRenew: undefined,
      });

      expect(
        mapStatus({
          entitlements: {
            active: {},
            all: {
              plus: {
                productIdentifier: 'rc_promo_plus_yearly',
                expirationDate: 'not-a-date',
                willRenew: false,
              },
            },
          },
        })
      ).toEqual({
        tier: 'free',
        isActive: false,
        expiryDate: null,
        productId: 'rc_promo_plus_yearly',
        willRenew: false,
      });
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

    it('given subscriptionPeriod P1Y returns annual before packageType', () => {
      expect(mapIntervalFromId('monthly_plan', 'MONTHLY', 'P1Y')).toBe('annual');
    });

    it('given subscriptionPeriod P1M returns monthly before packageType', () => {
      expect(mapIntervalFromId('annual_plan', 'ANNUAL', 'P1M')).toBe('monthly');
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
          title: 'Monthly Plus',
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
        title: 'Monthly Plus',
        description: 'Full access to all features',
        freeTrialDays: null,
      });
    });

    it('exposes the free-trial length from Play free phases and iOS intro prices', () => {
      const playTrial: PurchasesPackageLike = {
        identifier: 'annual',
        packageType: 'ANNUAL',
        product: {
          price: 21.99,
          priceString: '$21.99',
          defaultOption: {
            freePhase: { billingPeriod: { unit: 'WEEK', value: 1, iso8601: 'P1W' }, billingCycleCount: 1 },
          },
        },
      };
      expect(mapPackage(playTrial).freeTrialDays).toBe(7);

      const iosTrial: PurchasesPackageLike = {
        identifier: 'annual',
        packageType: 'ANNUAL',
        product: {
          price: 21.99,
          priceString: '$21.99',
          introPrice: { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 14, cycles: 1 },
        },
      };
      expect(mapPackage(iosTrial).freeTrialDays).toBe(14);

      const discountedIntro: PurchasesPackageLike = {
        identifier: 'monthly',
        packageType: 'MONTHLY',
        product: {
          price: 3.49,
          priceString: '$3.49',
          introPrice: { price: 0.99, periodUnit: 'MONTH', periodNumberOfUnits: 1, cycles: 3 },
        },
      };
      expect(mapPackage(discountedIntro).freeTrialDays).toBeNull();
    });

    it('given annual package returns annual interval', () => {
      const pkg: PurchasesPackageLike = {
        identifier: 'noctalia_annual',
        packageType: 'ANNUAL',
        product: {
          priceString: '$39.99',
          currencyCode: 'USD',
          title: 'Annual Plus',
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
        freeTrialDays: null,
      });
    });

    it('given EUR currency formats correctly', () => {
      const pkg: PurchasesPackageLike = {
        identifier: 'noctalia_monthly_eu',
        packageType: 'MONTHLY',
        product: {
          priceString: '4,99 €',
          currencyCode: 'EUR',
          title: 'Mensuel Plus',
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

    it('given store subscriptionPeriod conflicts with packageType uses billing period', () => {
      const pkg: PurchasesPackageLike = {
        identifier: 'noctalia_plus:monthly',
        packageType: 'MONTHLY',
        product: {
          subscriptionPeriod: 'P1Y',
          priceString: '$39.99',
          currencyCode: 'USD',
          title: 'Monthly configured as yearly',
          description: 'Store period is authoritative',
        },
      };

      const result = mapPackage(pkg);

      expect(result.interval).toBe('annual');
    });
  });
});
