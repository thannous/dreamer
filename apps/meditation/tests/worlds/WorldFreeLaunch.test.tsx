import { renderHook } from '@testing-library/react-native';
import React from 'react';

import { canAccessWorld, WORLD_BY_ID, WORLD_IDS } from '@/constants/worlds';
import { WORLD_SALES_ENABLED } from '@/constants/worldSales';
import { WorldPurchaseProvider, useWorldPurchases } from '@/context/WorldPurchaseContext';
import * as purchases from '@/services/worldPurchaseService';

jest.mock('@/services/worldPurchaseService', () => ({
  configure: jest.fn(),
  currentOwnership: jest.fn(),
  listOffers: jest.fn(),
  purchase: jest.fn(),
  restore: jest.fn(),
}));

describe('Meditation v1 free worlds', () => {
  it('opens every world without a purchase while world sales are off', () => {
    expect(WORLD_SALES_ENABLED).toBe(false);
    const ownsNothing = () => false;

    for (const id of WORLD_IDS) {
      expect(WORLD_BY_ID[id].access).toBe('free');
      expect(canAccessWorld(id, ownsNothing)).toBe(true);
    }
  });

  it('never initialises the store SDK, so nothing leaves the device', () => {
    const { result } = renderHook(() => useWorldPurchases(), {
      wrapper: ({ children }) => <WorldPurchaseProvider>{children}</WorldPurchaseProvider>,
    });

    expect(result.current.loaded).toBe(true);
    expect(result.current.worldAccess('tide')).toBe('free');
    expect(purchases.configure).not.toHaveBeenCalled();
    expect(purchases.currentOwnership).not.toHaveBeenCalled();
    expect(purchases.listOffers).not.toHaveBeenCalled();
  });
});
