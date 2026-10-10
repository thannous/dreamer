// Historical billing UI assertions, executed by TesterArmy with mock-only service guard.
import type { Page } from 'playwright/test';
import { createParityTest, expect } from '../web-parity-fixtures';
const test = createParityTest();

async function setupFreeAccount(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('btn.onboarding.feature.close').click();
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId('btn.mockProfile.existing').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('screen.subscription.qaLab.toggle').click();
  await expect(page.getByTestId('text.subscription.qa.mode')).toContainText('Mock services');
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('5 / 3');
}

async function offer(page: Page) {
  await page.getByRole('button', { name: 'Upgrade to Noctalia Plus', exact: true }).click();
  await expect(page.getByTestId('screen.paywall')).toBeVisible();
  await page.getByTestId('btn.paywall.selectMonthly').click();
}

async function assertPlus(page: Page) {
  await expect(page.getByTestId('toast.paywall.success')).toBeVisible();
  await page.getByTestId('btn.paywall.close').click();
  await expect(page.getByTestId('quota.analysisValue')).toContainText('Unlimited');
  await expect(page.getByRole('button', { name: 'Upgrade to Noctalia Plus', exact: true })).toHaveCount(0);
}

for (const interval of ['Monthly', 'Annual']) {
  test(`mock ${interval.toLowerCase()} purchase unlocks Plus through the paywall`, async ({ page }) => {
    await setupFreeAccount(page);
    await offer(page);
    await page.getByTestId(`btn.paywall.select${interval}`).click();
    await page.getByTestId('btn.paywall.purchase').click();
    await assertPlus(page);
  });
}

test('cancelled mock purchase keeps free access and a later purchase succeeds', async ({ page }) => {
  await setupFreeAccount(page);
  await page.getByTestId('btn.subscription.qa.purchase.cancelled').click();
  await expect(page.getByTestId('text.subscription.qa.actionLabel')).toHaveText('Next mock purchase: cancelled');
  await offer(page);
  await page.getByTestId('btn.paywall.purchase').click();
  await expect(page.getByTestId('btn.paywall.purchase')).toBeEnabled();
  await expect(page.getByTestId('bottomSheet.paywall.error')).toBeHidden();
  await expect(page.getByTestId('toast.paywall.success')).toHaveCount(0);
  await page.getByTestId('btn.paywall.close').click();
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('5 / 3');
  await offer(page);
  await page.getByTestId('btn.paywall.purchase').click();
  await assertPlus(page);
});

test('mock purchase error is recoverable without granting Plus', async ({ page }) => {
  await setupFreeAccount(page);
  await page.getByTestId('btn.subscription.qa.purchase.error').click();
  await offer(page);
  await page.getByTestId('btn.paywall.purchase').click();
  const error = page.getByTestId('bottomSheet.paywall.error');
  await expect(error).toContainText('No connection right now');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByTestId('btn.paywall.close').click();
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('5 / 3');
  await offer(page);
  await page.getByTestId('btn.paywall.purchase').click();
  await assertPlus(page);
});

test('restore activates a previous mock purchase without buying again', async ({ page }) => {
  await setupFreeAccount(page);
  await page.getByTestId('btn.subscription.qa.scenario.restore_available').click();
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('5 / 3');
  await offer(page);
  await page.getByTestId('btn.paywall.restore').click();
  await assertPlus(page);
});

test('restore with no mock receipt keeps the account free', async ({ page }) => {
  await setupFreeAccount(page);
  await offer(page);
  await page.getByTestId('btn.paywall.restore').click();
  await expect(page.getByTestId('toast.paywall.success')).toBeVisible();
  await page.getByTestId('btn.paywall.close').click();
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('5 / 3');
  await expect(page.getByRole('button', { name: 'Upgrade to Noctalia Plus', exact: true })).toBeVisible();
});

test('cancelled renewal keeps Plus until expiry, then free limits return without losing dreams', async ({ page }) => {
  await setupFreeAccount(page);
  await page.getByTestId('btn.subscription.qa.scenario.cancelled').click();
  await expect(page.getByTestId('quota.analysisValue')).toContainText('Unlimited');
  await page.getByTestId('btn.subscription.qa.refresh').click();
  await expect(page.getByTestId('quota.analysisValue')).toContainText('Unlimited');
  await page.getByTestId('btn.subscription.qa.scenario.expired').click();
  await page.getByTestId('btn.subscription.qa.refresh').click();
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('5 / 3');
  await expect(page.getByTestId('subscription-expired-notice')).toBeVisible();
  await offer(page);
  await page.getByTestId('btn.paywall.restore').click();
  await expect(page.getByTestId('toast.paywall.success')).toBeVisible();
  await page.getByTestId('btn.paywall.close').click();
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('5 / 3');
  await page.getByTestId('settings.back').click();
  await page.getByTestId('tab.journal').filter({ visible: true }).click();
  await page.getByRole('textbox', { name: 'Search dreams…' }).fill('The Infinite Library');
  await page.getByTestId(/^dream\.item\./).filter({ hasText: 'The Infinite Library', visible: true }).click();
  await expect(page.getByTestId('component.transcriptCard')).toBeVisible();
});

test('a mock receipt cannot unlock a different account', async ({ page }) => {
  await setupFreeAccount(page);
  await page.getByTestId('btn.subscription.qa.scenario.restore_available').click();
  await page.getByTestId('btn.auth.signOut').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId('btn.mockProfile.new').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await offer(page);
  await page.getByTestId('btn.paywall.restore').click();
  await expect(page.getByTestId('toast.paywall.success')).toBeVisible();
  await page.getByTestId('btn.paywall.close').click();
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('0 / 3');
});
