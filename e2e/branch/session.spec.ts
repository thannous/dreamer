import { expect, test, type TestAccount } from './fixtures';

// Proves the saved session is picked up: the app opens signed in as the test
// account, without the login screen.
for (const account of ['free', 'premium'] as TestAccount[]) {
  test.describe(`${account} account`, () => {
    test.use({ account });

    test('opens signed in from the saved session', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const intro = page.getByTestId('btn.onboarding.intro.next');
      if (await intro.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await intro.click();
        await page.getByTestId('btn.onboarding.skip').click();
      }
      await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
      await page.getByTestId('btn.header.home.settings').click();
      await page.getByTestId('quick-settings.all').click();
      await expect(page.getByTestId('text.auth.email')).toContainText(`e2e+${account}@`);
    });
  });
}
