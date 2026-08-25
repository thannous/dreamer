import { isMockModeEnabled } from '@/lib/env';

import * as mock from './mocks/worldPurchaseServiceMock';
import * as real from './worldPurchaseServiceReal';

const implementation = isMockModeEnabled() || !real.isConfigured() ? mock : real;

export type WorldOffer = real.WorldOffer | mock.WorldOffer;

export const PURCHASABLE_WORLD_IDS = real.PURCHASABLE_WORLD_IDS;
export const configure = implementation.configure;
export const currentOwnership = implementation.currentOwnership;
export const listOffers = implementation.listOffers as () => Promise<WorldOffer[]>;
export const purchase = implementation.purchase as (
  offer: WorldOffer
) => Promise<import('@/constants/worlds').WorldId[]>;
export const restore = implementation.restore;
