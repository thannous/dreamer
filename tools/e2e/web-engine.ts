import { web } from '@e2e-dev/web';

const selected = process.env.E2E_PLATFORM === 'web' ? process.env.E2E_WEB_LOCALE : undefined;
if (selected && !['en-US', 'fr-FR', 'de-DE'].includes(selected))
  throw new Error('E2E_WEB_LOCALE must be en-US, fr-FR or de-DE.');
export const webLocale = selected ?? (process.env.E2E_PRODUCT === 'lucid' ? 'fr-FR' : 'en-US');

// Attach to an already running local Chrome when requested. The SDK creates
// its own test context and only disconnects at cleanup, preserving user tabs.
const cdpEndpoint = process.env.E2E_WEB_CDP_ENDPOINT;
if (cdpEndpoint !== undefined) {
  const endpoint = new URL(cdpEndpoint);
  if (!['http:', 'ws:'].includes(endpoint.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) ||
      endpoint.username || endpoint.password) {
    throw new Error('E2E_WEB_CDP_ENDPOINT must name a local Chrome DevTools endpoint.');
  }
}

// Stable journeys retain their390x844 engine viewport. Parity fixtures apply
// the historical Desktop Chrome viewport before their bodies run.
export const webEngine = web({
  ...(cdpEndpoint !== undefined ? { connect: { cdpEndpoint: () => cdpEndpoint } } : {}),
  viewport: { width: 390, height: 844 },
  locale: webLocale,
  timezoneId: 'Europe/Paris',
  // The public header gate blocks service workers as the historical config did.
  // It introduces no headers; parity network routing already disables cache.
  headers: {},
});
