// German, the longest of the app's labels, on the narrowest phone (320 px): onboarding, the
// Plus offer a reviewer reads before buying, and Settings with its legal rows and account
// deletion keep every action whole and on screen, in a real de-DE browser context.
import type { Browser } from '@e2e-dev/web';
import type { App, Screen } from 'e2e';
import { expect } from 'e2e';
import { journeyTest } from '../traced-parity-test';
import { openHome, openSettings, startGuest } from '../web-journeys';
const test = journeyTest({ locale: 'de-DE', viewport: { width: 320, height: 700 }, tags: ['zone-onboarding', 'zone-paiement', 'zone-connexion'] });

/** The node is on screen, inside the 320 px width, and neither it nor a child clips its text. */
async function expectReadable(screen: Screen, browser: Browser, testId: string) {
  const node = screen.getByTestId(testId);
  await node.scrollIntoView();
  await expect(node).toBeVisible();
  const box = (await node.boundingBox())!;
  expect(box.x, `${testId} starts on screen`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${testId} ends on screen`).toBeLessThanOrEqual(320);
  const clipped = await browser.evaluate((id) => {
    const shown = [...document.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)].find((el) => el.getClientRects().length > 0);
    return shown ? [shown, ...shown.querySelectorAll<HTMLElement>('*')]
      .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.tagName} ${el.scrollWidth}>${el.clientWidth}`) : ['not found'];
  }, testId);
  expect(clipped, `${testId} keeps its text whole`).toEqual([]);
}

async function expectNoSidewaysScroll(app: App, browser: Browser, name: string) {
  expect(await browser.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${name} scrolls sideways`).toBeLessThanOrEqual(0);
  await app.screenshot(name);
}

test('German onboarding, offer and settings keep every action readable at 320px', async ({ app, screen, browser }) => {
  expect(await browser.evaluate(() => navigator.language)).toBe('de-DE');
  await expect(screen.getByTestId('component.onboarding.intro')).toContainText('Deine Träume erzählen');
  await expect(screen.getByTestId('btn.onboarding.intro.next')).toContainText('Starten');
  await expectReadable(screen, browser, 'btn.onboarding.intro.next');
  await startGuest(screen, browser);

  // The offer as a guest meets it: sign in to subscribe, the renewal terms, the terms of use.
  await openHome(screen);
  await screen.getByTestId('btn.header.home.settings').tap();
  await screen.getByTestId('quick-settings.plus').tap();
  await expect(screen.getByTestId('screen.paywall')).toBeVisible();
  await expect(screen.getByTestId('btn.paywall.purchase')).toContainText('Anmelden');
  await expect(screen.getByTestId('text.paywall.storeNotice')).toContainText('verlängert sich automatisch');
  await expect(screen.getByTestId('btn.paywall.termsOfUse')).toContainText('Nutzungsbedingungen');
  for (const testId of ['component.paywall.comparison', 'btn.paywall.purchase', 'text.paywall.storeNotice', 'btn.paywall.termsOfUse'])
    await expectReadable(screen, browser, testId);
  await expectNoSidewaysScroll(app, browser, 'offer-de-320');
  await screen.getByTestId('btn.paywall.close').tap();

  // Signed in, Settings ends with the legal rows and the account deletion App Review asks for.
  await openSettings(screen);
  await screen.getByTestId('settings-account-open-signin').tap();
  await screen.getByTestId('btn.mockProfile.existing').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  await openSettings(screen);
  await expect(screen.getByTestId('settings-delete-account')).toContainText('Konto löschen');
  await expect(screen.getByTestId('settings-legal-terms-of-use')).toContainText('Nutzungsbedingungen');
  for (const testId of ['settings-legal-privacy-policy', 'settings-legal-terms-of-use', 'settings-legal-account-deletion', 'settings-legal-contact', 'settings-delete-account'])
    await expectReadable(screen, browser, testId);
  await expectNoSidewaysScroll(app, browser, 'settings-de-320');
});
