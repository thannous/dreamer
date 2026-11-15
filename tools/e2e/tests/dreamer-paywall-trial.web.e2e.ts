// A store may open the annual plan with a free trial. The offer then says so on the plan and
// on its button, and states under it what is billed once the trial ends; the monthly plan,
// which has no trial, keeps its ordinary button. The QA lab gives the mock's annual plan a
// seven-day trial; offers are read when an account signs in, hence the profile change.
import type { Page } from 'playwright/test';
import { createParityTest, expect, leaveOnboarding, signInFromToday } from '../web-parity-fixtures';
const test = createParityTest({ tags: ['zone-paiement'] });

const purchase = (page: Page) => page.getByTestId('btn.paywall.purchase');
const footnote = (page: Page) => page.getByTestId('text.paywall.trialFootnote');

test('an annual plan with a free trial says what is free and what is billed after it', async ({ page }) => {
  await page.goto('/');
  await leaveOnboarding(page);
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await signInFromToday(page, 'new');
  await page.getByTestId('tab.settings').filter({ visible: true }).click();
  await page.getByTestId('screen.subscription.qaLab.toggle').click();
  await page.getByTestId('btn.subscription.qa.trialOffer').click();
  await page.getByTestId('btn.subscription.qa.profile.existing').click();
  await expect(page.getByTestId('screen.recording').filter({ visible: true })).toHaveCount(1);
  await page.getByTestId('tab.settings').filter({ visible: true }).click();
  await page.getByTestId('settings-section-subscription').click();
  await expect(page.getByTestId('screen.paywall')).toBeVisible();
  // The annual plan is selected on arrival.
  await expect(purchase(page)).toHaveText('Start 7 free days');
  await expect(footnote(page)).toHaveText('7 days free, then 29,99 € per year. Cancel anytime in your store settings.');
  await page.getByTestId('btn.paywall.selectMonthly').click();
  await expect(purchase(page)).toHaveText('Unlock unlimited');
  await expect(footnote(page)).toHaveCount(0);
  await page.getByTestId('btn.paywall.selectAnnual').click();
  await expect(purchase(page)).toHaveText('Start 7 free days');
  await expect(footnote(page)).toHaveCount(1);
});
