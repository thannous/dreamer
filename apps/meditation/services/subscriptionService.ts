import { isMockModeEnabled } from '@/lib/env';

import * as mock from './mocks/subscriptionServiceMock';
import * as real from './subscriptionServiceReal';

/**
 * Conditional export, resolved at bundle time — the Noctalia convention.
 *
 * Mock is an explicit opt-in (`EXPO_PUBLIC_MOCK_MODE`). A missing RevenueCat
 * key never falls back to a fake store: the real client stays selected and
 * returns free / no offers, so the UI cannot simulate a purchase.
 */
const implementation = isMockModeEnabled() ? mock : real;

export type Offer = real.Offer | mock.Offer;

export const configure = implementation.configure;
export const currentTier = implementation.currentTier;
export const listOffers = implementation.listOffers as () => Promise<Offer[]>;
export const purchase = implementation.purchase as (offer: Offer) => Promise<'free' | 'plus'>;
export const restore = implementation.restore;
