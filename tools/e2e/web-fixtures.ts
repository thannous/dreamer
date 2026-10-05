import type { Browser } from '@e2e-dev/web';
import type { App } from 'e2e';

export async function isolateWeb(browser: Browser, app: App) {
  const origin = new URL(app.baseUrl!).origin;
  await browser.route('**/*', async route => {
    if (new URL(route.request.url).origin === origin) await route.continue();
    else await route.abort();
  });
}
