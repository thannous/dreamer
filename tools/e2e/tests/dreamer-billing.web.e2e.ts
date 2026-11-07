// Historical billing UI journeys on the SDK surface, with the mock-only service guard.
import type { Browser } from '@e2e-dev/web';
import type { Screen } from 'e2e';
import { expect } from 'e2e';
import { journeyTest } from '../traced-parity-test';
import { openHome, openSettings, searchField, selectProfile, startGuest } from '../web-journeys';
const test = journeyTest({ tags: ['zone-paiement'] });

const PENDING = 'Your subscription is recognized. Access activation is still pending. You can retry without purchasing again.';

async function setupFreeAccount(screen: Screen, browser: Browser) {
  await selectProfile(screen, browser, 'existing');
  await openSettings(screen);
  await screen.getByTestId('screen.subscription.qaLab.toggle').tap();
  await expect(screen.getByTestId('text.subscription.qa.mode')).toContainText('Mock services');
  // The quota card caps its displayed count at the limit (iPhone fix, 2026-10-18).
  // Historical usage stays above the free allowance; display capping grants no access.
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await expect(screen.getByText('0 analysis left')).toBeVisible();
}

// Settings keeps one way to Plus in the subscription card: its Noctalia Plus row.
async function offer(screen: Screen) {
  await screen.getByTestId('settings-section-subscription').tap();
  await expect(screen.getByTestId('screen.paywall')).toBeVisible();
  await screen.getByTestId('btn.paywall.selectMonthly').tap();
}

async function assertPlus(screen: Screen) {
  await expect(screen.getByTestId('toast.paywall.success')).toBeVisible();
  await screen.getByTestId('btn.paywall.close').tap();
  await expect(screen.getByTestId('quota.analysisValue')).toContainText('Unlimited');
  // A subscriber has nothing to wait for: no renewal date for included analyses.
  await expect(screen.getByText(/Your included analyses renew on/)).toHaveCount(0);
}

for (const interval of ['Monthly', 'Annual']) {
  test(`mock ${interval.toLowerCase()} purchase unlocks Plus through the paywall`, interval === 'Monthly' ? { tags: ['smoke'] } : {}, async ({ screen, browser }) => {
    await setupFreeAccount(screen, browser);
    await offer(screen);
    await screen.getByTestId(`btn.paywall.select${interval}`).tap();
    await screen.getByTestId('btn.paywall.purchase').tap();
    await assertPlus(screen);
  });
}

test('cancelled mock purchase keeps free access and a later purchase succeeds', async ({ screen, browser }) => {
  await setupFreeAccount(screen, browser);
  await screen.getByTestId('btn.subscription.qa.purchase.cancelled').tap();
  await expect(screen.getByTestId('text.subscription.qa.actionLabel')).toHaveText('Next mock purchase: cancelled');
  await offer(screen);
  await screen.getByTestId('btn.paywall.purchase').tap();
  await expect(screen.getByTestId('btn.paywall.purchase')).toBeEnabled();
  await expect(screen.getByTestId('bottomSheet.paywall.error')).toBeHidden();
  await expect(screen.getByTestId('toast.paywall.success')).toHaveCount(0);
  await screen.getByTestId('btn.paywall.close').tap();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await offer(screen);
  await screen.getByTestId('btn.paywall.purchase').tap();
  await assertPlus(screen);
});

test('mock purchase error is recoverable without granting Plus', async ({ screen, browser }) => {
  await setupFreeAccount(screen, browser);
  await screen.getByTestId('btn.subscription.qa.purchase.error').tap();
  await offer(screen);
  await screen.getByTestId('btn.paywall.purchase').tap();
  await expect(screen.getByTestId('bottomSheet.paywall.error')).toContainText('No connection right now');
  await screen.getByRole('button', 'OK').tap();
  await screen.getByTestId('btn.paywall.close').tap();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await offer(screen);
  await screen.getByTestId('btn.paywall.purchase').tap();
  await assertPlus(screen);
});

test('restore activates a previous mock purchase without buying again', async ({ screen, browser }) => {
  await setupFreeAccount(screen, browser);
  await screen.getByTestId('btn.subscription.qa.scenario.restore_available').tap();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await offer(screen);
  await screen.getByTestId('btn.paywall.restore').tap();
  await assertPlus(screen);
});

test('restore with no mock receipt keeps the account free', async ({ screen, browser }) => {
  await setupFreeAccount(screen, browser);
  await offer(screen);
  await screen.getByTestId('btn.paywall.restore').tap();
  await expect(screen.getByTestId('toast.paywall.info')).toContainText('No active subscription');
  await expect(screen.getByTestId('toast.paywall.success')).toHaveCount(0);
  await screen.getByTestId('btn.paywall.close').tap();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await expect(screen.getByText(/Your included analyses renew on [A-Z][a-z]+ \d{1,2}, \d{4}/)).toBeVisible();
  await expect(screen.getByTestId('settings-section-subscription')).toBeVisible();
});

test('cancelled renewal keeps Plus until expiry, then free limits return without losing dreams', async ({ screen, browser }) => {
  await setupFreeAccount(screen, browser);
  await screen.getByTestId('btn.subscription.qa.scenario.cancelled').tap();
  await expect(screen.getByTestId('quota.analysisValue')).toContainText('Unlimited');
  await screen.getByTestId('btn.subscription.qa.refresh').tap();
  await expect(screen.getByTestId('quota.analysisValue')).toContainText('Unlimited');
  await screen.getByTestId('btn.subscription.qa.scenario.expired').tap();
  await screen.getByTestId('btn.subscription.qa.refresh').tap();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await expect(screen.getByTestId('subscription-expired-notice')).toBeVisible();
  await offer(screen);
  await screen.getByTestId('btn.paywall.restore').tap();
  await expect(screen.getByTestId('toast.paywall.info')).toContainText('No active subscription');
  await screen.getByTestId('btn.paywall.close').tap();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await screen.getByTestId('settings.back').tap();
  await screen.getByTestId('tab.journal', { visible: true }).tap();
  await searchField(screen).fill('The Infinite Library');
  await screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: 'The Infinite Library' }).tap();
  await expect(screen.getByTestId('component.transcriptCard')).toBeVisible();
});

test('a mock receipt cannot unlock a different account', async ({ screen, browser }) => {
  await setupFreeAccount(screen, browser);
  await screen.getByTestId('btn.subscription.qa.scenario.restore_available').tap();
  await screen.getByTestId('btn.auth.signOut').tap();
  await openSettings(screen);
  await screen.getByTestId('settings-account-open-signin').tap();
  await screen.getByTestId('btn.mockProfile.new').tap();
  await openSettings(screen);
  await offer(screen);
  await screen.getByTestId('btn.paywall.restore').tap();
  await expect(screen.getByTestId('toast.paywall.info')).toContainText('No active subscription');
  await screen.getByTestId('btn.paywall.close').tap();
  await expect(screen.getByTestId('quota.analysisValue')).toHaveText('0 / 3');
});

for (const action of ['purchase', 'restore'] as const) {
  test(`mock ${action} waits for activation and recovers without a second store operation`, async ({ app, screen, browser }) => {
    await setupFreeAccount(screen, browser);
    if (action === 'restore') await screen.getByTestId('btn.subscription.qa.scenario.restore_available').tap();
    await screen.getByTestId('btn.subscription.qa.delayActivation').tap();
    await offer(screen);
    await screen.getByTestId(`btn.paywall.${action}`).tap();
    await expect(screen.getByText(PENDING, { exact: false })).toBeVisible();
    await expect(screen.getByTestId('toast.paywall.success')).toHaveCount(0);
    await app.screenshot(`${action}-activation-pending`);
    await screen.getByTestId('btn.paywall.close').tap();
    await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
    await openHome(screen);
    await screen.getByTestId('btn.header.home.settings').tap();
    await screen.getByTestId('quick-settings.plus').tap();
    await expect(screen.getByText(PENDING, { exact: false })).toBeVisible();
    await expect(screen.getByTestId('toast.paywall.success')).toHaveCount(0);
    await screen.getByTestId('btn.paywall.purchase').tap();
    await expect(screen.getByTestId('toast.paywall.success')).toBeVisible();
    await screen.getByTestId('btn.paywall.close').tap();
    await screen.getByTestId('btn.header.home.settings').tap();
    await screen.getByTestId('quick-settings.all').tap();
    await expect(screen.getByTestId('quota.analysisValue')).toContainText('Unlimited');
    if (!await screen.getByTestId('text.subscription.qa.mode').isVisible()) {
      await screen.getByTestId('screen.subscription.qaLab.toggle').tap();
    }
    await expect(screen.getByTestId('text.subscription.qa.purchaseCalls')).toHaveText(action === 'purchase' ? '1' : '0');
    await expect(screen.getByTestId('text.subscription.qa.restoreCalls')).toHaveText(action === 'restore' ? '1' : '0');
  });
}

async function openGuestOfferSignIn(screen: Screen, browser: Browser) {
  await startGuest(screen, browser);
  await openHome(screen);
  await screen.getByTestId('btn.header.home.settings').tap();
  await screen.getByTestId('quick-settings.plus').tap();
  await expect(screen.getByTestId('screen.paywall')).toBeVisible();
  await expect(screen.getByTestId('btn.paywall.purchase')).toContainText('Sign in');
  await screen.getByTestId('btn.paywall.purchase').tap();
  await screen.getByTestId('settings-account-open-signin').tap();
}

const returnToPaywall = (browser: Browser) => browser.evaluate(() => sessionStorage.getItem('dreamer:return_to_paywall'));

for (const profile of ['existing', 'new'] as const) {
  test(`guest returns to the Plus offer after signing into a ${profile} mock account`, async ({ app, screen, browser }) => {
    await openGuestOfferSignIn(screen, browser);
    await screen.getByTestId(`btn.mockProfile.${profile}`).tap();
    await expect(browser).toHaveURL(/\/paywall\?trigger=settings$/);
    await expect(screen.getByTestId('btn.paywall.purchase')).toBeEnabled();
    await expect(screen.getByTestId('btn.paywall.restore')).toBeVisible();
    // A system Back/gesture can bypass the paywall's explicit close handler.
    await expect.poll(() => returnToPaywall(browser)).toBeNull();
    await screen.getByTestId('btn.paywall.selectMonthly').tap();
    await app.screenshot(`${profile}-offer-after-signin`);
    await screen.getByTestId('btn.paywall.close').tap();
    await openHome(screen);
    await expect(screen.getByTestId('btn.header.home.settings')).toBeVisible();
    await expect(screen.getByTestId('screen.paywall')).toHaveCount(0);
  });
}

test('guest resumes a durable recording before the Plus offer after signing in', async ({ screen, browser }) => {
  await openGuestOfferSignIn(screen, browser);
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
  await screen.getByTestId('btn.mockProfile.existing').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  // Capture consumes its URL parameters after applying the entry; the durable
  // entry itself must remain owned and resumable until the user finishes it.
  await expect(browser).toHaveURL(/\/recording(?:\?|$)/);
  await expect.poll(() => browser.evaluate(() => {
    const prefix = 'noctalia_mock_dogfood_v1:gemini_dream_journal_onboarding_state_v2:user:';
    const key = Object.keys(localStorage).find(key => key.startsWith(prefix));
    return key ? JSON.parse(localStorage.getItem(key)!).pendingRecordingIntent?.entryId ?? null : null;
  })).toBe('billing-return-durable-capture');
  await expect.poll(() => returnToPaywall(browser)).toBeNull();
  await expect(screen.getByTestId('screen.paywall')).toHaveCount(0);
});
