import { WORLD_PRODUCTS, isPurchasableWorldId } from '@/constants/worldProducts';
import type { WorldId } from '@/constants/worlds';
import { readJson, StorageKey, writeJson } from '@/services/storageService';

import type { WorldOffer } from '../worldPurchaseService';

const PRICE = '0,99 €';

export async function configure(): Promise<void> {}

export async function currentOwnership(): Promise<WorldId[]> {
  const stored = await readJson<unknown[]>(StorageKey.purchasedWorlds, []);
  return stored.filter(isPurchasableWorldId);
}

export async function listOffers(): Promise<WorldOffer[]> {
  return WORLD_PRODUCTS.map(({ worldId }) => ({ worldId, priceLabel: PRICE, raw: null }));
}

export async function purchase(offer: WorldOffer): Promise<WorldId[]> {
  const owned = new Set(await currentOwnership());
  owned.add(offer.worldId);
  const next = [...owned];
  await writeJson(StorageKey.purchasedWorlds, next);
  return next;
}

export async function restore(): Promise<WorldId[]> {
  return currentOwnership();
}
