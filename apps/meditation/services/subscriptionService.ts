import { isMockModeEnabled } from '@/lib/env';

import * as mock from './mocks/subscriptionServiceMock';
import * as real from './subscriptionServiceReal';

/**
 * Conditional export, resolved at bundle time — the Noctalia convention.
 *
 * The mock also stands in when no RevenueCat key is configured: a paywall that
 * cannot be opened is a paywall nobody reviews before release.
 */
const implementation = isMockModeEnabled() || !real.isConfigured() ? mock : real;

export type Offer = real.Offer | mock.Offer;

export const configure = implementation.configure;
export const currentTier = implementation.currentTier;
export const listOffers = implementation.listOffers as () => Promise<Offer[]>;
export const purchase = implementation.purchase as (offer: Offer) => Promise<'free' | 'plus'>;
export const restore = implementation.restore;
