import type { WorldId } from '@/constants/worlds';
import { isMockModeEnabled } from '@/lib/env';

import * as mock from './mocks/worldPurchaseServiceMock';

/**
 * Conditional export, resolved at call time — the Noctalia convention.
 *
 * Mock is an explicit opt-in (`EXPO_PUBLIC_MOCK_MODE`). The real RevenueCat
 * client is loaded only outside mock mode: a static import would initialise the
 * native SDK during `start:mock` whenever a Test Store key is also present.
 *
 * A missing RevenueCat key never unlocks worlds: the real client stays
 * selected and returns no ownership / no offers, so the UI cannot simulate a
 * purchase.
 */
export const PURCHASABLE_WORLD_IDS = [
  'tide',
  'sanctuary',
  'cloud',
] as const satisfies readonly WorldId[];

export type WorldOffer =
  | mock.WorldOffer
  | {
      worldId: (typeof PURCHASABLE_WORLD_IDS)[number];
      priceLabel: string;
      raw: unknown;
    };

type PurchasableWorldId = (typeof PURCHASABLE_WORLD_IDS)[number];

type WorldPurchaseService = {
  configure: () => Promise<void>;
  currentOwnership: () => Promise<WorldId[]>;
  listOffers: () => Promise<WorldOffer[]>;
  purchase: (offer: { worldId: PurchasableWorldId }) => Promise<WorldId[]>;
  restore: () => Promise<WorldId[]>;
};

const getImplementation = (): WorldPurchaseService => {
  if (isMockModeEnabled()) return mock;

  // Lazy so mock mode never evaluates `react-native-purchases`.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock must not import the native SDK
  return require('./worldPurchaseServiceReal') as WorldPurchaseService;
};

export const configure = (): Promise<void> => getImplementation().configure();
export const currentOwnership = (): Promise<WorldId[]> => getImplementation().currentOwnership();
export const listOffers = (): Promise<WorldOffer[]> => getImplementation().listOffers();
export const purchase = (offer: WorldOffer): Promise<WorldId[]> =>
  getImplementation().purchase(offer);
export const restore = (): Promise<WorldId[]> => getImplementation().restore();
