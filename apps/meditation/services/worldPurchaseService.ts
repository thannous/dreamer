import type { PurchasesStoreProduct } from 'react-native-purchases';

import type { PurchasableWorldId } from '@/constants/worldProducts';
import type { WorldId } from '@/constants/worlds';
import { isMockModeEnabled } from '@/lib/env';

import * as mock from './mocks/worldPurchaseServiceMock';

export type WorldOffer = {
  worldId: PurchasableWorldId;
  priceLabel: string;
  raw: PurchasesStoreProduct | null;
};

type WorldPurchaseService = {
  configure: () => Promise<void>;
  currentOwnership: () => Promise<WorldId[]>;
  listOffers: () => Promise<WorldOffer[]>;
  purchase: (offer: WorldOffer) => Promise<WorldId[]>;
  restore: () => Promise<WorldId[]>;
};

const getImplementation = (): WorldPurchaseService => {
  if (isMockModeEnabled()) return mock;

  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock must not import the native SDK
  return require('./worldPurchaseServiceReal') as typeof import('./worldPurchaseServiceReal');
};

export const configure = (): Promise<void> => getImplementation().configure();
export const currentOwnership = (): Promise<WorldId[]> => getImplementation().currentOwnership();
export const listOffers = (): Promise<WorldOffer[]> => getImplementation().listOffers();
export const purchase = (offer: WorldOffer): Promise<WorldId[]> =>
  getImplementation().purchase(offer);
export const restore = (): Promise<WorldId[]> => getImplementation().restore();
