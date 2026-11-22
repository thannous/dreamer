import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  type CustomerInfo,
} from 'react-native-purchases';

import { WORLD_PRODUCTS } from '@/constants/worldProducts';
import type { WorldId } from '@/constants/worlds';
import { getExpoPublicEnvValue, isMockModeEnabled } from '@/lib/env';

import type { WorldOffer } from './worldPurchaseService';

const apiKey = (): string | undefined =>
  Platform.OS === 'ios'
    ? getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_KEY')
    : getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');

function requireConfigured(): void {
  if (!apiKey()) {
    throw new Error('World purchase service is not configured');
  }
}

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
  return WORLD_PRODUCTS.filter(({ productId }) => purchased.has(productId)).map(({ worldId }) => worldId);
}

export async function currentOwnership(): Promise<WorldId[]> {
  requireConfigured();
  return ownedWorlds(await Purchases.getCustomerInfo());
}

export async function listOffers(): Promise<WorldOffer[]> {
  requireConfigured();

  const products = await Purchases.getProducts(
    WORLD_PRODUCTS.map(({ productId }) => productId),
    PRODUCT_CATEGORY.NON_SUBSCRIPTION
  );

  return products.flatMap((product) => {
    const world = WORLD_PRODUCTS.find(({ productId }) => productId === product.identifier);
    return world ? [{ worldId: world.worldId, priceLabel: product.priceString, raw: product }] : [];
  });
}

export async function purchase(offer: WorldOffer): Promise<WorldId[]> {
  if (!offer.raw) throw new Error('World offer has no store product');
  const { customerInfo } = await Purchases.purchaseStoreProduct(offer.raw);
  return ownedWorlds(customerInfo);
}

export async function restore(): Promise<WorldId[]> {
  requireConfigured();
  return ownedWorlds(await Purchases.restorePurchases());
}
