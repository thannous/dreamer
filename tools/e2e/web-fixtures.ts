import type { Browser } from '@e2e-dev/web';
import type { App } from 'e2e';
import { appMediaResponse } from './app-media-fixtures';
import { webLocale } from './web-engine';

// The AI consent modal must name where the dream goes (App Review 5.1.2(i), Google
// Play's User Data policy): check that mention in the run's locale, not the whole text.
export const aiConsentDisclosure = ({ 'fr-FR': 'partenaires d’IA : Anthropic pour le texte, Google pour les images', 'de-DE': 'KI-Partner: Anthropic für Text, Google für Bilder' } as Record<string, string>)[webLocale] ?? 'AI partners: Anthropic for text, Google for images';

export async function isolateWeb(browser: Browser, app: App) {
  const origin = new URL(app.baseUrl!).origin;
  await browser.route('**/*', async route => {
    const url = new URL(route.request.url);
    const media = appMediaResponse(url);
    if (url.origin === origin) await route.continue();
    else if (media) await route.fulfill(media);
    else await route.abort();
  });
}
