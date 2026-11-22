import { areMockWorldSalesEnabled } from '@/lib/env';

/**
 * One-time world purchases stay off for Meditation v1 (owner decision,
 * 2026-10-08): every world opens for free at launch. Only the explicit
 * mock sales profile exercises the purchase flow.
 */
export const WORLD_SALES_ENABLED = areMockWorldSalesEnabled();
