import type { WorldId } from '@/constants/worlds';
import { readJson, StorageKey, writeJson } from '@/services/storageService';

export const PURCHASABLE_WORLD_IDS = ['tide', 'sanctuary', 'cloud'] as const satisfies readonly WorldId[];

export type WorldOffer = {
  worldId: (typeof PURCHASABLE_WORLD_IDS)[number];
  priceLabel: string;
  raw: null;
};

const PRICE = '0,99 €';

export const isConfigured = (): boolean => true;

export async function configure(): Promise<void> {}

export async function currentOwnership(): Promise<WorldId[]> {
  const stored = await readJson<unknown[]>(StorageKey.purchasedWorlds, []);
  return stored.filter((value): value is WorldId =>
    PURCHASABLE_WORLD_IDS.includes(value as (typeof PURCHASABLE_WORLD_IDS)[number])
  );
}

export async function listOffers(): Promise<WorldOffer[]> {
  return PURCHASABLE_WORLD_IDS.map((worldId) => ({ worldId, priceLabel: PRICE, raw: null }));
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
