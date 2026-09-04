import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  type CustomerInfo,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

import type { WorldId } from '@/constants/worlds';
import { getExpoPublicEnvValue, isMockModeEnabled } from '@/lib/env';

export const PURCHASABLE_WORLD_IDS = ['tide', 'sanctuary', 'cloud'] as const satisfies readonly WorldId[];

const PRODUCT_ID_BY_WORLD = {
  tide: 'noctalia.meditation.world.tide',
  sanctuary: 'noctalia.meditation.world.sanctuary',
  cloud: 'noctalia.meditation.world.cloud',
} as const satisfies Record<(typeof PURCHASABLE_WORLD_IDS)[number], string>;

export type WorldOffer = {
  worldId: (typeof PURCHASABLE_WORLD_IDS)[number];
  priceLabel: string;
  raw: PurchasesStoreProduct;
};

const apiKey = (): string | undefined =>
  Platform.OS === 'ios'
    ? getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_KEY')
    : getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');

export const isConfigured = (): boolean => !!apiKey();

export async function configure(): Promise<void> {
  // Mock mode must never reach the native SDK, even if this module is loaded.
  if (isMockModeEnabled()) return;

  const key = apiKey();
  if (!key || (await Purchases.isConfigured())) return;

  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
  await Purchases.configure({ apiKey: key });
}

function ownedWorlds(info: CustomerInfo): WorldId[] {
  const purchased = new Set(info.allPurchasedProductIdentifiers);
  return PURCHASABLE_WORLD_IDS.filter((worldId) => purchased.has(PRODUCT_ID_BY_WORLD[worldId]));
}

export async function currentOwnership(): Promise<WorldId[]> {
  if (!isConfigured()) return [];
  return ownedWorlds(await Purchases.getCustomerInfo());
}

export async function listOffers(): Promise<WorldOffer[]> {
  if (!isConfigured()) return [];

  const products = await Purchases.getProducts(
    Object.values(PRODUCT_ID_BY_WORLD),
    PRODUCT_CATEGORY.NON_SUBSCRIPTION
  );

  return products.flatMap((product) => {
    const worldId = PURCHASABLE_WORLD_IDS.find(
      (candidate) => PRODUCT_ID_BY_WORLD[candidate] === product.identifier
    );
    return worldId ? [{ worldId, priceLabel: product.priceString, raw: product }] : [];
  });
}

export async function purchase(offer: WorldOffer): Promise<WorldId[]> {
  const { customerInfo } = await Purchases.purchaseStoreProduct(offer.raw);
  return ownedWorlds(customerInfo);
}

export async function restore(): Promise<WorldId[]> {
  if (!isConfigured()) return [];
  return ownedWorlds(await Purchases.restorePurchases());
}
