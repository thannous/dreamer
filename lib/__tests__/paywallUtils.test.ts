import { describe, expect, it } from 'vitest';

import { calculateAnnualDiscount, sortPackages } from '@/lib/paywallUtils';
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
});

