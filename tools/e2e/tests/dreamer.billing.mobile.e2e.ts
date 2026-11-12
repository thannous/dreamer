import { test } from '@e2e-dev/mobile';
import { expect, type TestFixtures } from 'e2e';
import { tapWhenStill } from '../native-settle';
import { type NativeBackgroundFixtures, billingTap, billingHome, billingSettings, settingsScrollUp, billingGuest } from '../dreamer-native-fixtures';

// e2e 0.23 throws ACTION_FAILED when a button exposes no value; read that as collapsed.
const collapsedWithoutValue = (error: unknown) => {
  if ((error as { code?: string } | undefined)?.code === 'ACTION_FAILED') return '';
  throw error;
};

// Billing uses only the runner's identified, disposable mock Release. Store
// operations and entitlement convergence are simulated; no Store account is used.
const nativeBillingOptions = {
  platforms: ['ios', 'android'],
  tags: ['native-billing'], timeout: 300_000,
  skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true'
    ? 'Requires the owned mock-persistent Release; never run against real payments.' : false,
};

/**
 * Settings reopen where they were left, sometimes at their very end. The quota card comes
 * after the notifications and before its QA lab, the Plus row and the legal section, so the
 * scroll goes up from any of those and down otherwise.
 */
async function billingQuota(fixtures: Pick<NativeBackgroundFixtures, 'screen' | 'platform'>) {
  const { screen } = fixtures;
  const quota = screen.getByTestId('quota.analysisValue', { visible: true });
  // The screen matches while it is still sliding over Home: read the direction from its sections.
  await expect(screen.getByTestId(/^settings-section-/, { visible: true }).first()).toBeVisible();
  const below = screen.getByTestId(/^(screen\.subscription\.qaLab|settings-section-subscription|settings-section-legal|settings-ai-consent|settings-analytics-preference|settings-stability-reports|settings-legal-contact|settings-delete-account)$/, { visible: true });
  if (await below.count()) await settingsScrollUp(fixtures, quota);
  else await screen.scrollUntilVisible(quota, { direction: 'down' });
  return quota;
}

async function billingFree(fixtures: NativeBackgroundFixtures) {
  const { screen } = fixtures;
  await billingGuest(fixtures);
  await billingSettings(screen);
  await billingTap(screen, 'settings-account-open-signin', 'up');
  await screen.getByTestId('btn.mockProfile.existing', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await billingSettings(screen);
  const quota = await billingQuota(fixtures);
  // The fixture holds five analyses; since #429 the card caps the count at its limit.
  await expect(quota).toHaveText(/^(?:Included analyses: )?3 \/ 3$/);
  const lab = screen.getByTestId('screen.subscription.qaLab.toggle', { visible: true });
  await screen.scrollUntilVisible(lab);
  // Android omits off-screen rows from its tree. Open once, then scroll to the
  // mode; waiting for attachment here would toggle an already-open panel shut.
  await tapWhenStill(lab);
  const mode = screen.getByTestId('text.subscription.qa.mode', { visible: true });
  await screen.scrollUntilVisible(mode);
  await expect(mode).toHaveText('Mock services');
}

async function billingOffer(screen: TestFixtures['screen']) {
  await billingTap(screen, 'settings-section-subscription');
  await expect(screen.getByTestId('screen.paywall', { visible: true })).toBeVisible();
  await billingTap(screen, 'btn.paywall.selectMonthly');
}

async function billingClose(screen: TestFixtures['screen'], useFreeFooter = false) {
  // The Free offer's header can be clipped beneath Android's status bar.
  // Continue free is the visible exit and uses the same handleClose.
  if (useFreeFooter) {
    const exit = screen.getByRole('button', 'Continue free', { visible: true });
    await screen.scrollUntilVisible(exit);
    await exit.tap();
  } else await billingTap(screen, 'btn.paywall.close', 'up');
  await expect(screen.getByTestId('screen.paywall', { visible: true })).toHaveCount(0);
}

async function billingCounts({ screen, platform }: NativeBackgroundFixtures, purchases: string, restores: string) {
  // Android's UIAutomator tree does not expose RN's expanded state to this SDK.
  // Reopen Settings so the embedded QA panel starts in its known collapsed state.
  if (platform === 'android') await billingSettings(screen);
  const toggle = screen.getByTestId('screen.subscription.qaLab.toggle', { visible: true });
  await screen.scrollUntilVisible(toggle);
  // UIKit exposes this button's expansion as its accessibility value. A
  // clipped status cell being absent does not mean the panel is collapsed.
  if (platform === 'android' || await toggle.inputValue().catch(collapsedWithoutValue) !== 'expanded') await toggle.tap();
  for (const [id, count] of [['purchaseCalls', purchases], ['restoreCalls', restores]]) {
    const value = screen.getByTestId(`text.subscription.qa.${id}`, { visible: true });
    await screen.scrollUntilVisible(value);
    await expect(value).toHaveText(count);
  }
}

async function billingPlus({ app, screen }: NativeBackgroundFixtures, label: string) {
  await expect(screen.getByTestId('toast.paywall.success', { visible: true })).toBeVisible();
  await app.screenshot(`${label}-confirmed`);
  await billingClose(screen);
  const quota = screen.getByTestId('quota.analysisValue', { visible: true });
  await screen.scrollUntilVisible(quota, { direction: 'up' });
  await expect(quota).toHaveText(/^(?:Included analyses: )?Unlimited$/);
}

test('Dreamer native billing purchase activates Plus', nativeBillingOptions, async (fixtures) => {
  await billingFree(fixtures);
  await billingOffer(fixtures.screen);
  await billingTap(fixtures.screen, 'btn.paywall.purchase');
  await billingPlus(fixtures, 'native-purchase');
  await billingCounts(fixtures, '1', '0');
});

test('Dreamer native billing restore activates an existing receipt without purchase', nativeBillingOptions, async (fixtures) => {
  await billingFree(fixtures);
  await billingTap(fixtures.screen, 'btn.subscription.qa.scenario.restore_available');
  await billingOffer(fixtures.screen);
  await billingTap(fixtures.screen, 'btn.paywall.restore');
  await billingPlus(fixtures, 'native-restore');
  await billingCounts(fixtures, '0', '1');
});

test('Dreamer native billing empty restore keeps Free and reports no subscription', nativeBillingOptions, async (fixtures) => {
  const { app, screen } = fixtures;
  await billingFree(fixtures);
  await billingOffer(screen);
  await billingTap(screen, 'btn.paywall.restore');
  const info = screen.getByTestId('toast.paywall.info', { visible: true });
  await expect(info).toBeVisible();
  await expect(info.getByText(/No active subscription/, { visible: true })).toBeVisible();
  await expect(screen.getByTestId('toast.paywall.success')).toHaveCount(0);
  await app.screenshot('native-restore-empty');
  await billingClose(screen, fixtures.platform === 'android');
  const quota = screen.getByTestId('quota.analysisValue', { visible: true });
  await screen.scrollUntilVisible(quota, { direction: 'up' });
  await expect(quota).toHaveText(/^(?:Included analyses: )?3 \/ 3$/);
  await billingCounts(fixtures, '0', '1');
});

for (const action of ['purchase', 'restore'] as const) {
  test(`Dreamer native billing delayed ${action} is confirmed without a retry or a second Store operation`, nativeBillingOptions, async (fixtures) => {
    const { app, screen } = fixtures;
    await billingFree(fixtures);
    if (action === 'restore') await billingTap(screen, 'btn.subscription.qa.scenario.restore_available');
    await billingTap(screen, 'btn.subscription.qa.delayActivation');
    await billingOffer(screen);
    await billingTap(screen, `btn.paywall.${action}`);
    // The app confirms a paid receipt by itself, 5 s then 15 s after the Store answered and on each
    // return to the foreground. On a device the pending notice is gone before a reader could leave
    // and come back, so the proof here is the outcome; the web journey holds the notice and the retry.
    const active = screen.getByText('Noctalia Plus is active', { visible: true });
    await expect.poll(async () => {
      // The offer's title sits above the button just tapped, and an iPhone lists only what is on screen.
      await screen.scrollUntilVisible(active, { direction: 'up' }).catch(() => {});
      return active.count();
    }, { timeout: 120_000, message: 'the paid receipt was never confirmed without the reader retrying' }).toBeGreaterThan(0);
    await app.screenshot(`native-${action}-confirmed-unattended`);
    await billingClose(screen);
    await billingSettings(screen);
    const quota = await billingQuota(fixtures);
    await expect(quota).toHaveText(/^(?:Included analyses: )?Unlimited$/);
    await billingCounts(fixtures, action === 'purchase' ? '1' : '0', action === 'restore' ? '1' : '0');
  });
}

for (const profile of ['existing', 'new'] as const) {
  test(`Dreamer native billing guest returns after ${profile} sign in and foreground does not reopen the offer`, nativeBillingOptions, async (fixtures) => {
    const { app, screen, device } = fixtures;
    await billingGuest(fixtures);
    await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
    await billingTap(screen, 'quick-settings.plus');
    await expect(screen.getByTestId('screen.paywall', { visible: true })).toBeVisible();
    await screen.scrollUntilVisible(screen.getByTestId('btn.paywall.purchase', { visible: true }));
    await expect(screen.getByTestId('btn.paywall.purchase', { visible: true })).toHaveText('Sign in to subscribe');
    await billingTap(screen, 'btn.paywall.purchase');
    await billingTap(screen, 'settings-account-open-signin', 'up');
    await screen.getByTestId(`btn.mockProfile.${profile}`, { visible: true }).tap();
    await expect(screen.getByTestId('screen.paywall', { visible: true })).toBeVisible();
    await screen.scrollUntilVisible(screen.getByTestId('btn.paywall.purchase', { visible: true }));
    await expect(screen.getByTestId('btn.paywall.purchase', { visible: true })).toBeEnabled();
    await expect(screen.getByTestId('btn.paywall.purchase', { visible: true })).toHaveText('Unlock unlimited');
    await screen.scrollUntilVisible(screen.getByTestId('btn.paywall.restore', { visible: true }));
    await expect(screen.getByTestId('btn.paywall.restore', { visible: true })).toBeVisible();
    await app.screenshot(`native-${profile}-offer-after-signin`);
    // This visible footer uses the same dismissal handler as Close. XCTest can
    // report an offscreen header visible and only scroll to it on the first tap.
    await screen.getByRole('button', 'Continue free', { visible: true }).tap();
    await expect(screen.getByTestId('screen.paywall', { visible: true })).toHaveCount(0);
    await billingHome(screen);
    await device.home();
    await device.openApp('com.tanuki75.noctalia');
    // RootLayoutNav's default foreground destination is Capture. Android
    // dispatches that lifecycle transition; iOS stayed Home until iOS 27.2 dispatched it too.
    const resumedScreen = fixtures.platform === 'android' ? 'screen.recording' : /^screen\.(home|recording)$/;
    await expect(screen.getByTestId(resumedScreen, { visible: true })).toBeVisible();
    await expect(screen.getByTestId('screen.paywall', { visible: true })).toHaveCount(0);
    await app.screenshot(`native-${profile}-foreground-${fixtures.platform === 'android' ? 'capture' : 'home'}`);
    await billingSettings(screen);
    const quota = await billingQuota(fixtures);
    await expect(quota).toHaveText(profile === 'existing'
      ? /^(?:Included analyses: )?3 \/ 3$/ : /^(?:Included analyses: )?0 \/ 3$/);
    await billingCounts(fixtures, '0', '0');
  });
}

// Guidelines 3.1.1 and 3.1.2: price and period, renewal terms, Terms and Privacy, and Restore.
test('Dreamer native offer shows renewal terms, legal links and restore before purchase', {
  ...nativeBillingOptions, tags: [...nativeBillingOptions.tags, 'native-paywall-compliance'],
}, async (fixtures) => {
  const { app, screen, device, platform } = fixtures;
  await billingFree(fixtures);
  await billingOffer(screen);
  // Mock Store prices (services/mocks/subscriptionServiceMock.ts). On iOS the billed amount is
  // the card's largest price; Android leads the annual card with its monthly equivalent.
  await expect(screen.getByTestId('btn.paywall.selectMonthly.price', { visible: true })).toContainText('4,99');
  await expect(screen.getByTestId('btn.paywall.selectMonthly.detail', { visible: true })).toHaveText('Billed monthly');
  const annualDetail = screen.getByTestId('btn.paywall.selectAnnual.detail', { visible: true });
  if (platform === 'ios') {
    await expect(screen.getByTestId('btn.paywall.selectAnnual.price', { visible: true })).toContainText('29,99');
    await expect(annualDetail).toContainText('per month');
  } else await expect(annualDetail).toHaveText(/^Billed 29,99.* yearly$/);
  const notice = screen.getByTestId('text.paywall.storeNotice', { visible: true });
  await screen.scrollUntilVisible(notice);
  await expect(notice).toContainText('renews automatically');
  for (const id of ['btn.paywall.restore', 'btn.paywall.termsOfUse', 'btn.paywall.privacyPolicy']) {
    const control = screen.getByTestId(id, { visible: true });
    await screen.scrollUntilVisible(control);
    await expect(control).toBeEnabled();
    // iOS frames are in points, where Apple asks for 44; Android's are pixels, a looser bound.
    expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await app.screenshot('native-paywall-compliance');
  for (const id of ['btn.paywall.termsOfUse', 'btn.paywall.privacyPolicy']) {
    await billingTap(screen, id);
    // The page opens in the browser. Android names the app in front; iOS only its own session.
    if (platform === 'android') await expect.poll(async () => (await device.foregroundApp()).name).not.toBe('com.tanuki75.noctalia');
    await device.openApp('com.tanuki75.noctalia');
    // Coming back keeps the offer: the foreground return to Capture leaves /paywall alone.
    await expect(screen.getByTestId('screen.paywall', { visible: true })).toBeVisible();
    const purchase = screen.getByTestId('btn.paywall.purchase', { visible: true });
    await screen.scrollUntilVisible(purchase, { direction: 'up' });
    await expect(purchase).toBeEnabled();
  }
  await app.screenshot('native-paywall-after-legal-links');
});
