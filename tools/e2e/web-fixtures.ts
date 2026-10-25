import type { Browser } from '@e2e-dev/web';
import type { App } from 'e2e';
import { webLocale } from './web-engine';

// The AI consent modal must name where the dream goes (App Review 5.1.2(i), Google
// Play's User Data policy): check that mention in the run's locale, not the whole text.
export const aiConsentDisclosure = ({ 'fr-FR': 'services d’IA externes', 'de-DE': 'externe KI-Dienste' } as Record<string, string>)[webLocale] ?? 'external AI services';

export async function isolateWeb(browser: Browser, app: App) {
  const origin = new URL(app.baseUrl!).origin;
  await browser.route('**/*', async route => {
    if (new URL(route.request.url).origin === origin) await route.continue();
    else await route.abort();
  });
}
