import { expect, test, type TestAccount } from './fixtures';

// Proves the saved session is picked up: the app opens signed in as the test
// account, without the login screen.
for (const account of ['free', 'premium'] as TestAccount[]) {
  test.describe(`${account} account`, () => {
    test.use({ account });

    test('opens signed in from the saved session', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const intro = page.getByTestId('btn.onboarding.intro.next');
      const home = page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true });
      // Wait until either onboarding or home has rendered (isVisible does not
      // wait), then branch on what is actually on screen.
      await expect(intro.or(home).first()).toBeVisible({ timeout: 30_000 });
      if (await intro.isVisible()) {
        await intro.click();
        await page.getByTestId('btn.onboarding.skip').click();
      }
      await home.first().click();
      await page.getByTestId('btn.header.home.settings').click();
      await page.getByTestId('quick-settings.all').click();
      await expect(page.getByTestId('text.auth.email')).toContainText(`e2e+${account}@`);
    });
  });
}
