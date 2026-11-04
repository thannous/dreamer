import type { Browser } from '@e2e-dev/web';
import type { App } from 'e2e';
import { appMediaResponse } from './app-media-fixtures';
import { webLocale } from './web-engine';

// The AI consent modal must name where the dream goes (App Review 5.1.2(i), Google
// Play's User Data policy): check that mention in the run's locale, not the whole text.
export const aiConsentDisclosure = ({ 'fr-FR': 'partenaires d’IA : Anthropic pour le texte, Google pour les images', 'de-DE': 'KI-Partner: Anthropic für Text, Google für Bilder' } as Record<string, string>)[webLocale] ?? 'AI partners: Anthropic for text, Google for images';

const PICSUM_HOST = /^(picsum\.photos|fastly\.picsum\.photos)$/;
const PICSUM_SVG = { contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#eee"/></svg>' };
const SERVICE_HOST = /revenuecat|supabase|stripe|purchases|billing/i;

/**
 * Same-origin requests continue; app media and picsum are answered locally; everything else is
 * aborted. Returns the billing/backend hosts it aborted, for a fixture to assert on after the body.
 * Routes a test registers later still win.
 */
export async function guardNetwork(browser: Browser, app: App): Promise<string[]> {
  const origin = new URL(app.baseUrl!).origin;
  const serviceRequests: string[] = [];
  await browser.route('**/*', async route => {
    const url = new URL(route.request.url);
    const media = appMediaResponse(url);
    if (url.origin === origin) await route.continue();
    else if (media) await route.fulfill(media);
    else if (PICSUM_HOST.test(url.hostname)) await route.fulfill(PICSUM_SVG);
    else {
      if (SERVICE_HOST.test(url.hostname)) serviceRequests.push(url.hostname);
      await route.abort();
    }
  });
  return serviceRequests;
}

export async function isolateWeb(browser: Browser, app: App) {
  await guardNetwork(browser, app);
}
