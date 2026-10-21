// Billing journeys use public TesterArmy fixtures with mock-only service guards.
import type { ExactWebUI } from '../exact-web-fixtures';
import { createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
const test = createExactWebTest();

async function setupFreeAccount(ui: ExactWebUI) {
  const { app, screen, browser } = ui;
  await app.open('/');
  await screen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => screen.getByTestId('btn.onboarding.feature.close').click());
  }
  await screen.getByTestId('btn.onboarding.skip').click();
  await screen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await screen.getByTestId('btn.header.home.settings').click();
  await screen.getByTestId('quick-settings.all').click();
  await screen.getByTestId('settings-account-open-signin').click();
  await screen.getByTestId('btn.mockProfile.existing').click();
  await screen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await screen.getByTestId('btn.header.home.settings').click();
  await screen.getByTestId('quick-settings.all').click();
  await screen.getByTestId('screen.subscription.qaLab.toggle').click();
  await expect(screen.getByTestId('text.subscription.qa.mode')).toContainText('Mock services');
  // The quota card caps its displayed count at the limit (iPhone fix, 2026-10-18).
  // Historical usage stays above the free allowance; display capping grants no access.
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await expect(screen.getByText('0 analysis left', { exact: true })).toBeVisible();
}

async function offer(ui: ExactWebUI) {
  const { screen } = ui;
  // Settings keeps one way to Plus in the subscription card.
  await screen.getByTestId('settings-section-subscription').click();
  await expect(screen.getByTestId('screen.paywall')).toBeVisible();
  await screen.getByTestId('btn.paywall.selectMonthly').click();
}

async function assertPlus(ui: ExactWebUI) {
  const { screen } = ui;
  await expect(screen.getByTestId('toast.paywall.success')).toBeVisible();
  await screen.getByTestId('btn.paywall.close').click();
  await expect(screen.getByTestId('quota.analysisValue')).toContainText('Unlimited');
  // A subscriber has no renewal date for included analyses.
  await expect(screen.getByText(/Your included analyses renew on/)).toHaveCount(0);
}

for (const interval of ['Monthly', 'Annual']) {
  test(`mock ${interval.toLowerCase()} purchase unlocks Plus through the paywall`, async (ui) => {
  const { screen } = ui;
    await setupFreeAccount(ui);
    await offer(ui);
    await screen.getByTestId(`btn.paywall.select${interval}`).click();
    await screen.getByTestId('btn.paywall.purchase').click();
    await assertPlus(ui);
  });
}

test('cancelled mock purchase keeps free access and a later purchase succeeds', async (ui) => {
  const { screen } = ui;
  await setupFreeAccount(ui);
  await screen.getByTestId('btn.subscription.qa.purchase.cancelled').click();
  await expect(screen.getByTestId('text.subscription.qa.actionLabel')).toHaveText('Next mock purchase: cancelled');
  await offer(ui);
  await screen.getByTestId('btn.paywall.purchase').click();
  await expect(screen.getByTestId('btn.paywall.purchase')).toBeEnabled();
  await expect(screen.getByTestId('bottomSheet.paywall.error')).toBeHidden();
  await expect(screen.getByTestId('toast.paywall.success')).toHaveCount(0);
  await screen.getByTestId('btn.paywall.close').click();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await offer(ui);
  await screen.getByTestId('btn.paywall.purchase').click();
  await assertPlus(ui);
});

test('mock purchase error is recoverable without granting Plus', async (ui) => {
  const { screen } = ui;
  await setupFreeAccount(ui);
  await screen.getByTestId('btn.subscription.qa.purchase.error').click();
  await offer(ui);
  await screen.getByTestId('btn.paywall.purchase').click();
  const error = screen.getByTestId('bottomSheet.paywall.error');
  await expect(error).toContainText('No connection right now');
  await screen.getByRole('button', { name: 'OK', exact: true }).click();
  await screen.getByTestId('btn.paywall.close').click();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await offer(ui);
  await screen.getByTestId('btn.paywall.purchase').click();
  await assertPlus(ui);
});

test('restore activates a previous mock purchase without buying again', async (ui) => {
  const { screen } = ui;
  await setupFreeAccount(ui);
  await screen.getByTestId('btn.subscription.qa.scenario.restore_available').click();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await offer(ui);
  await screen.getByTestId('btn.paywall.restore').click();
  await assertPlus(ui);
});

test('restore with no mock receipt keeps the account free', async (ui) => {
  const { screen } = ui;
  await setupFreeAccount(ui);
  await offer(ui);
  await screen.getByTestId('btn.paywall.restore').click();
  await expect(screen.getByTestId('toast.paywall.info')).toContainText('No active subscription');
  await expect(screen.getByTestId('toast.paywall.success')).toHaveCount(0);
  await screen.getByTestId('btn.paywall.close').click();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await expect(screen.getByText(/Your included analyses renew on [A-Z][a-z]+ \d{1,2}, \d{4}/)).toBeVisible();
  await expect(screen.getByTestId('settings-section-subscription')).toBeVisible();
});

test('cancelled renewal keeps Plus until expiry, then free limits return without losing dreams', async (ui) => {
  const { screen } = ui;
  await setupFreeAccount(ui);
  await screen.getByTestId('btn.subscription.qa.scenario.cancelled').click();
  await expect(screen.getByTestId('quota.analysisValue')).toContainText('Unlimited');
  await screen.getByTestId('btn.subscription.qa.refresh').click();
  await expect(screen.getByTestId('quota.analysisValue')).toContainText('Unlimited');
  await screen.getByTestId('btn.subscription.qa.scenario.expired').click();
  await screen.getByTestId('btn.subscription.qa.refresh').click();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await expect(screen.getByTestId('subscription-expired-notice')).toBeVisible();
  await offer(ui);
  await screen.getByTestId('btn.paywall.restore').click();
  await expect(screen.getByTestId('toast.paywall.info')).toContainText('No active subscription');
  await screen.getByTestId('btn.paywall.close').click();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await screen.getByTestId('settings.back').click();
  await screen.getByTestId('tab.journal', { visible: true }).click();
  await screen.getByRole('textbox', { name: 'Search dreams…' }).fill('The Infinite Library');
  await screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: 'The Infinite Library' }).click();
  await expect(screen.getByTestId('component.transcriptCard')).toBeVisible();
});

test('a mock receipt cannot unlock a different account', async (ui) => {
  const { screen } = ui;
  await setupFreeAccount(ui);
  await screen.getByTestId('btn.subscription.qa.scenario.restore_available').click();
  await screen.getByTestId('btn.auth.signOut').click();
  await screen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await screen.getByTestId('btn.header.home.settings').click();
  await screen.getByTestId('quick-settings.all').click();
  await screen.getByTestId('settings-account-open-signin').click();
  await screen.getByTestId('btn.mockProfile.new').click();
  await screen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await screen.getByTestId('btn.header.home.settings').click();
  await screen.getByTestId('quick-settings.all').click();
  await offer(ui);
  await screen.getByTestId('btn.paywall.restore').click();
  await expect(screen.getByTestId('toast.paywall.info')).toContainText('No active subscription');
  await screen.getByTestId('btn.paywall.close').click();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('0 / 3');
});

for (const action of ['purchase', 'restore'] as const) {
  test(`mock ${action} waits for activation and recovers without a second store operation`, async (ui) => {
  const { app, screen } = ui;
    await setupFreeAccount(ui);
    if (action === 'restore') await screen.getByTestId('btn.subscription.qa.scenario.restore_available').click();
    await screen.getByTestId('btn.subscription.qa.delayActivation').click();
    await offer(ui);
    await screen.getByTestId(`btn.paywall.${action}`).click();
    await expect(screen.getByText('Your subscription is recognized. Access activation is still pending. You can retry without purchasing again.')).toBeVisible();
    await expect(screen.getByTestId('toast.paywall.success')).toHaveCount(0);
    await app.screenshot(`${action}-activation-pending.png`);
    await screen.getByTestId('btn.paywall.close').click();
    await screen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
    await screen.getByTestId('btn.header.home.settings').click();
    await screen.getByTestId('quick-settings.plus').click();
    await expect(screen.getByText('Your subscription is recognized. Access activation is still pending. You can retry without purchasing again.')).toBeVisible();
    await expect(screen.getByTestId('toast.paywall.success')).toHaveCount(0);
    await screen.getByTestId('btn.paywall.purchase').click();
    await expect(screen.getByTestId('toast.paywall.success')).toBeVisible();
    await screen.getByTestId('btn.paywall.close').click();
    await screen.getByTestId('btn.header.home.settings').click();
    await screen.getByTestId('quick-settings.all').click();
    await expect(screen.getByTestId('quota.analysisValue')).toContainText('Unlimited');
    if (!await screen.getByTestId('text.subscription.qa.mode').isVisible()) {
      await screen.getByTestId('screen.subscription.qaLab.toggle').click();
    }
    await expect(screen.getByTestId('text.subscription.qa.purchaseCalls')).toHaveText(action === 'purchase' ? '1' : '0');
    await expect(screen.getByTestId('text.subscription.qa.restoreCalls')).toHaveText(action === 'restore' ? '1' : '0');
  });
}

async function openGuestOfferSignIn(ui: ExactWebUI) {
  const { app, screen, browser } = ui;
  await app.open('/');
  await screen.getByTestId('btn.onboarding.intro.next').click();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => screen.getByTestId('btn.onboarding.feature.close').click());
  }
  await screen.getByTestId('btn.onboarding.skip').click();
  await screen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await screen.getByTestId('btn.header.home.settings').click();
  await screen.getByTestId('quick-settings.plus').click();
  await expect(screen.getByTestId('screen.paywall')).toBeVisible();
  await expect(screen.getByTestId('btn.paywall.purchase')).toContainText('Sign in');
  await screen.getByTestId('btn.paywall.purchase').click();
  await screen.getByTestId('settings-account-open-signin').click();
}

for (const profile of ['existing', 'new'] as const) {
  test(`guest returns to the Plus offer after signing into a ${profile} mock account`, async (ui) => {
  const { app, screen, browser } = ui;
    await openGuestOfferSignIn(ui);
    await screen.getByTestId(`btn.mockProfile.${profile}`).click();
    await expect(browser).toHaveURL(/\/paywall\?trigger=settings$/);
    await expect(screen.getByTestId('btn.paywall.purchase')).toBeEnabled();
    await expect(screen.getByTestId('btn.paywall.restore')).toBeVisible();
    // A system Back/gesture can bypass the paywall's explicit close handler.
    await expect.poll(() => browser.evaluate(() => sessionStorage.getItem('dreamer:return_to_paywall'))).toBeNull();
    await screen.getByTestId('btn.paywall.selectMonthly').click();
    await app.screenshot(`${profile}-offer-after-signin.png`);
    await screen.getByTestId('btn.paywall.close').click();
    await screen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
    await expect(screen.getByTestId('btn.header.home.settings')).toBeVisible();
    await expect(screen.getByTestId('screen.paywall')).toHaveCount(0);
  });
}

test('guest resumes a durable recording before the Plus offer after signing in', async (ui) => {
  const { screen, browser } = ui;
  await openGuestOfferSignIn(ui);
  // Restore an owned mock draft's durable intent while the auth screen is open.
  // This opt-in mock storage namespace never touches real account data.
  await browser.evaluate(() => {
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
    return null;
  });
  await screen.getByTestId('btn.mockProfile.existing').click();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  // Capture consumes its URL parameters after applying the entry; the durable
  // entry itself must remain owned and resumable until the user finishes it.
  await expect(browser).toHaveURL(/\/recording(?:\?|$)/);
  await expect.poll(() => browser.evaluate(() => {
    const prefix = 'noctalia_mock_dogfood_v1:gemini_dream_journal_onboarding_state_v2:user:';
    const key = Object.keys(localStorage).find(key => key.startsWith(prefix));
    return key ? JSON.parse(localStorage.getItem(key)!).pendingRecordingIntent?.entryId ?? null : null;
  })).toBe('billing-return-durable-capture');
  await expect.poll(() => browser.evaluate(() => sessionStorage.getItem('dreamer:return_to_paywall'))).toBeNull();
  await expect(screen.getByTestId('screen.paywall')).toHaveCount(0);
});
