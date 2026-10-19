// Historical billing UI assertions, executed by TesterArmy with mock-only service guard.
import type { Page } from 'playwright/test';
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest();

async function setupFreeAccount(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
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
  // The fixture holds five analyses; revised 2026-10-19 (was '5 / 3'): since #429 the card
  // caps the count at the limit.
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
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
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
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
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await offer(page);
  await page.getByTestId('btn.paywall.purchase').click();
  await assertPlus(page);
});

test('restore activates a previous mock purchase without buying again', async ({ page }) => {
  await setupFreeAccount(page);
  await page.getByTestId('btn.subscription.qa.scenario.restore_available').click();
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await offer(page);
  await page.getByTestId('btn.paywall.restore').click();
  await assertPlus(page);
});

test('restore with no mock receipt keeps the account free', async ({ page }) => {
  await setupFreeAccount(page);
  await offer(page);
  await page.getByTestId('btn.paywall.restore').click();
  await expect(page.getByTestId('toast.paywall.info')).toContainText('No active subscription');
  await expect(page.getByTestId('toast.paywall.success')).toHaveCount(0);
  await page.getByTestId('btn.paywall.close').click();
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
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
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await expect(page.getByTestId('subscription-expired-notice')).toBeVisible();
  await offer(page);
  await page.getByTestId('btn.paywall.restore').click();
  await expect(page.getByTestId('toast.paywall.info')).toContainText('No active subscription');
  await page.getByTestId('btn.paywall.close').click();
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
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
  await expect(page.getByTestId('toast.paywall.info')).toContainText('No active subscription');
  await page.getByTestId('btn.paywall.close').click();
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('0 / 3');
});

for (const action of ['purchase', 'restore'] as const) {
  test(`mock ${action} waits for activation and recovers without a second store operation`, async ({ page }, info) => {
    await setupFreeAccount(page);
    if (action === 'restore') await page.getByTestId('btn.subscription.qa.scenario.restore_available').click();
    await page.getByTestId('btn.subscription.qa.delayActivation').click();
    await offer(page);
    await page.getByTestId(`btn.paywall.${action}`).click();
    await expect(page.getByText('Your subscription is recognized. Access activation is still pending. You can retry without purchasing again.')).toBeVisible();
    await expect(page.getByTestId('toast.paywall.success')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`${action}-activation-pending.png`) });
    await page.getByTestId('btn.paywall.close').click();
    await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
    await page.getByTestId('btn.header.home.settings').click();
    await page.getByTestId('quick-settings.plus').click();
    await expect(page.getByText('Your subscription is recognized. Access activation is still pending. You can retry without purchasing again.')).toBeVisible();
    await expect(page.getByTestId('toast.paywall.success')).toHaveCount(0);
    await page.getByTestId('btn.paywall.purchase').click();
    await expect(page.getByTestId('toast.paywall.success')).toBeVisible();
    await page.getByTestId('btn.paywall.close').click();
    await page.getByTestId('btn.header.home.settings').click();
    await page.getByTestId('quick-settings.all').click();
    await expect(page.getByTestId('quota.analysisValue')).toContainText('Unlimited');
    if (!await page.getByTestId('text.subscription.qa.mode').isVisible()) {
      await page.getByTestId('screen.subscription.qaLab.toggle').click();
    }
    await expect(page.getByTestId('text.subscription.qa.purchaseCalls')).toHaveText(action === 'purchase' ? '1' : '0');
    await expect(page.getByTestId('text.subscription.qa.restoreCalls')).toHaveText(action === 'restore' ? '1' : '0');
  });
}

async function openGuestOfferSignIn(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.plus').click();
  await expect(page.getByTestId('screen.paywall')).toBeVisible();
  await expect(page.getByTestId('btn.paywall.purchase')).toContainText('Sign in');
  await page.getByTestId('btn.paywall.purchase').click();
  await page.getByTestId('settings-account-open-signin').click();
}

for (const profile of ['existing', 'new'] as const) {
  test(`guest returns to the Plus offer after signing into a ${profile} mock account`, async ({ page }, info) => {
    await openGuestOfferSignIn(page);
    await page.getByTestId(`btn.mockProfile.${profile}`).click();
    await expect(page).toHaveURL(/\/paywall\?trigger=settings$/);
    await expect(page.getByTestId('btn.paywall.purchase')).toBeEnabled();
    await expect(page.getByTestId('btn.paywall.restore')).toBeVisible();
    // A system Back/gesture can bypass the paywall's explicit close handler.
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('dreamer:return_to_paywall'))).toBeNull();
    await page.getByTestId('btn.paywall.selectMonthly').click();
    await page.screenshot({ path: info.outputPath(`${profile}-offer-after-signin.png`) });
    await page.getByTestId('btn.paywall.close').click();
    await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
    await expect(page.getByTestId('btn.header.home.settings')).toBeVisible();
    await expect(page.getByTestId('screen.paywall')).toHaveCount(0);
  });
}

test('guest resumes a durable recording before the Plus offer after signing in', async ({ page }) => {
  await openGuestOfferSignIn(page);
  // Restore an owned mock draft's durable intent while the auth screen is open.
  // This opt-in mock storage namespace never touches real account data.
  await page.evaluate(() => {
    const key = 'noctalia_mock_dogfood_v1:gemini_dream_journal_onboarding_state_v2:guest';
    const state = JSON.parse(localStorage.getItem(key)!);
    state.status = 'completed';
    state.selectedPath = 'analyze';
    state.completionReason = 'analyze';
    state.pendingRecordingIntent = {
      entryId: 'billing-return-durable-capture', intent: 'fresh', source: 'onboarding',
      postSave: 'confirm_analysis', phase: 'capture',
      createdAt: Date.now(), expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.getByTestId('btn.mockProfile.existing').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  // Capture consumes its URL parameters after applying the entry; the durable
  // entry itself must remain owned and resumable until the user finishes it.
  await expect(page).toHaveURL(/\/recording(?:\?|$)/);
  await expect.poll(() => page.evaluate(() => {
    const prefix = 'noctalia_mock_dogfood_v1:gemini_dream_journal_onboarding_state_v2:user:';
    const key = Object.keys(localStorage).find(key => key.startsWith(prefix));
    return key ? JSON.parse(localStorage.getItem(key)!).pendingRecordingIntent?.entryId : null;
  })).toBe('billing-return-durable-capture');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('dreamer:return_to_paywall'))).toBeNull();
  await expect(page.getByTestId('screen.paywall')).toHaveCount(0);
});
