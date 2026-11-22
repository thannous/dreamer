import type { WorldId } from '@/constants/worlds';

export const WORLD_PRODUCTS = [
  { worldId: 'tide', productId: 'noctalia.meditation.world.tide' },
  { worldId: 'sanctuary', productId: 'noctalia.meditation.world.sanctuary' },
  { worldId: 'cloud', productId: 'noctalia.meditation.world.cloud' },
] as const satisfies readonly { worldId: WorldId; productId: string }[];

export type PurchasableWorldId = (typeof WORLD_PRODUCTS)[number]['worldId'];

export function isPurchasableWorldId(value: unknown): value is PurchasableWorldId {
  return WORLD_PRODUCTS.some(({ worldId }) => worldId === value);
}
