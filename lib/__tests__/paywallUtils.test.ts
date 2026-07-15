import { describe, expect, it } from '@jest/globals';

import {
  calculateAnnualDiscount,
  calculateMonthlyEquivalent,
  sortPackages,
} from '@/lib/paywallUtils';
import type { PurchasePackage } from '@/lib/types';

describe('paywallUtils', () => {
  it('[B] Given monthly+annual packages When sorting Then monthly comes first', () => {
    // Given
    const packages: PurchasePackage[] = [
      { id: 'annual', interval: 'annual', price: 96, priceFormatted: '$96', currency: 'USD' },
      { id: 'monthly', interval: 'monthly', price: 10, priceFormatted: '$10', currency: 'USD' },
    ];

    // When
    const sorted = sortPackages(packages);

    // Then
    expect(sorted.map((p) => p.id)).toEqual(['monthly', 'annual']);
  });

  it('[E] Given invalid package pricing When calculating annual discount Then it returns null', () => {
    // Given
    const packages: PurchasePackage[] = [
      { id: 'monthly', interval: 'monthly', price: 0, priceFormatted: '$0', currency: 'USD' },
      { id: 'annual', interval: 'annual', price: 96, priceFormatted: '$96', currency: 'USD' },
    ];

    // When
    const discount = calculateAnnualDiscount(packages);

    // Then
    expect(discount).toBeNull();
  });

  it('[B] Given lower annual pricing When calculating annual discount Then it returns the rounded savings', () => {
    const packages: PurchasePackage[] = [
      { id: 'monthly', interval: 'monthly', price: 9.99, priceFormatted: '$9.99', currency: 'USD' },
      { id: 'annual', interval: 'annual', price: 79.99, priceFormatted: '$79.99', currency: 'USD' },
    ];

    expect(calculateAnnualDiscount(packages)).toBe(33);
  });

  it('[B] Given mock EUR pricing When calculating annual discount Then it returns 47 percent', () => {
    const packages: PurchasePackage[] = [
      { id: 'monthly', interval: 'monthly', price: 3.59, priceFormatted: '3,59 €', currency: 'EUR' },
      { id: 'annual', interval: 'annual', price: 22.99, priceFormatted: '22,99 €', currency: 'EUR' },
    ];

    expect(calculateAnnualDiscount(packages)).toBe(47);
  });

  it('[E] Given annual pricing without savings When calculating annual discount Then it returns null', () => {
    const packages: PurchasePackage[] = [
      { id: 'monthly', interval: 'monthly', price: 10, priceFormatted: '$10', currency: 'USD' },
      { id: 'annual', interval: 'annual', price: 120, priceFormatted: '$120', currency: 'USD' },
    ];

    expect(calculateAnnualDiscount(packages)).toBeNull();
  });

  it('[B] Given annual pricing When comparing plans Then it returns the monthly equivalent', () => {
    const annual: PurchasePackage = {
      id: 'annual',
      interval: 'annual',
      price: 22.99,
      priceFormatted: '22,99 €',
      currency: 'EUR',
    };

    expect(calculateMonthlyEquivalent(annual)).toBeCloseTo(1.9158, 4);
  });

  it('[B] Given monthly pricing When comparing plans Then it keeps the monthly price', () => {
    const monthly: PurchasePackage = {
      id: 'monthly',
      interval: 'monthly',
      price: 3.59,
      priceFormatted: '3,59 €',
      currency: 'EUR',
    };

    expect(calculateMonthlyEquivalent(monthly)).toBe(3.59);
  });
});
