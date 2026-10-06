import { web } from '@e2e-dev/web';

const selected = process.env.E2E_PLATFORM === 'web' ? process.env.E2E_WEB_LOCALE : undefined;
if (selected && !['en-US', 'fr-FR', 'de-DE'].includes(selected))
  throw new Error('E2E_WEB_LOCALE must be en-US, fr-FR or de-DE.');
export const webLocale = selected ?? (process.env.E2E_PRODUCT === 'lucid' ? 'fr-FR' : 'en-US');

// Stable journeys retain their390x844 engine viewport. Parity fixtures apply
// the historical Desktop Chrome viewport before their bodies run.
export const webEngine = web({
  viewport: { width: 390, height: 844 },
  locale: webLocale,
  timezoneId: 'Europe/Paris',
  // The public header gate blocks service workers as the historical config did.
  // It introduces no headers; parity network routing already disables cache.
  headers: {},
});
