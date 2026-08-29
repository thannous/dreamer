import { isMockModeEnabled } from '@/lib/env';

import * as mock from './mocks/worldPurchaseServiceMock';
import * as real from './worldPurchaseServiceReal';

/**
 * Mock is an explicit opt-in (`EXPO_PUBLIC_MOCK_MODE`). A missing RevenueCat
 * key never unlocks worlds: the real client stays selected and returns no
 * ownership / no offers, so the UI cannot simulate a purchase.
 */
const implementation = isMockModeEnabled() ? mock : real;

export type WorldOffer = real.WorldOffer | mock.WorldOffer;

export const PURCHASABLE_WORLD_IDS = real.PURCHASABLE_WORLD_IDS;
export const configure = implementation.configure;
export const currentOwnership = implementation.currentOwnership;
export const listOffers = implementation.listOffers as () => Promise<WorldOffer[]>;
export const purchase = implementation.purchase as (
  offer: WorldOffer
) => Promise<import('@/constants/worlds').WorldId[]>;
export const restore = implementation.restore;
