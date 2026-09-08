/** Explicit API capabilities for newly issued, server-recognized client tokens.
 * Legacy and guest behavior is handled separately by the router. A route added
 * to index.ts does not automatically become accessible to a scoped client.
 */
const JOURNAL_ROUTES = new Set([
  'POST /chat', 'POST /transcribe', 'POST /analyzeDream',
  'POST /analyzeDreamFull', 'POST /categorizeDream',
  'POST /analysis-jobs', 'POST /analysis-jobs/status',
  'POST /image-jobs', 'POST /image-jobs/status',
  'POST /generateImage', 'POST /generateImageWithReference',
  'POST /quota/status', 'POST /auth/mark-upgrade',
  'POST /subscription/refresh', 'POST /subscription/sync',
]);

export function isProductRouteAllowed(product: unknown, route: string): boolean {
  if (product !== 'journal' && product !== 'lucid') return false;
  // Event submission conveys no authority to read another product's data.
  if (route === 'POST /analytics/events') return true;
  // Global account/analytics deletion, Apple credential storage and technical
  // reconciliation are deliberately unavailable to scoped product clients.
  return product === 'journal' && JOURNAL_ROUTES.has(route);
}
