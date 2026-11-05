import { afterEach, test, type Device } from '@e2e-dev/mobile';
import { expect, type TestFixtures } from 'e2e';
import { tapUntilShown, tapWhenStill, waitUntilStill } from '../native-settle';
// The persistent mock profile seeds this entry. Explicit expectations keep
// Node collection independent of the app's React Native/media imports.
const SEEDED_OTHER_DREAM = {
  title: 'The Infinite Library',
  transcript: 'I found myself in an enormous library with endless shelves reaching up into darkness. Books were floating around me, their pages turning on their own. I picked up a golden book that seemed to glow, and when I opened it, I could see memories from my childhood playing out on the pages like a movie.',
};

// e2e 0.23 throws ACTION_FAILED when a button exposes no value; read that as collapsed.
const collapsedWithoutValue = (error: unknown) => {
  if ((error as { code?: string } | undefined)?.code === 'ACTION_FAILED') return '';
  throw error;
};

type NativeBackgroundFixtures = TestFixtures & { device: Device };

// A failed or timed-out journey must not hand the next one a rotated or offline device. A
// finally block cannot promise that: a timed-out body's device calls are cancelled, while
// afterEach runs with its own budget. A journey sets its flag before it changes the state.
const restore = { portrait: false, airplane: false, appearance: false };
afterEach(async ({ device }) => {
  if (restore.appearance) {
    restore.appearance = false;
    await device.setAppearance('light');
  }
  if (restore.portrait) {
    restore.portrait = false;
    await device.setOrientation('portrait');
  }
  if (restore.airplane) {
    restore.airplane = false;
    await device.setAirplaneMode(false);
  }
});

// Billing uses only the runner's identified, disposable mock Release. Store
// operations and entitlement convergence are simulated; no Store account is used.
const nativeBillingOptions = {
  platforms: ['ios', 'android'],
  tags: ['native-billing'], timeout: 300_000,
  skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true'
    ? 'Requires the owned mock-persistent Release; never run against real payments.' : false,
};

async function billingTap(screen: TestFixtures['screen'], id: string, direction: 'up' | 'down' = 'down') {
  const target = screen.getByTestId(id, { visible: true });
  await screen.scrollUntilVisible(target, { direction });
  // The page can still glide when the target comes into view.
  await tapWhenStill(target);
}

async function billingHome(screen: TestFixtures['screen']) {
  const recordingHome = screen.getByTestId('btn.recording.home', { visible: true });
  const home = screen.getByTestId('tab.home', { visible: true });
  if (await recordingHome.count()) await recordingHome.tap();
  else if (await home.count()) await home.tap();
  else {
    await billingTap(screen, 'settings.back', 'up');
    if (await recordingHome.count()) await recordingHome.tap();
    else await home.tap();
  }
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
}

async function billingSettings(screen: TestFixtures['screen']) {
  await billingHome(screen);
  await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
  await billingTap(screen, 'quick-settings.all');
  await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
}

type Control = ReturnType<TestFixtures['screen']['getByTestId']>;

/**
 * The keyboard's own Search key submits; a synthesized Enter can leave the driver waiting.
 * Once the simulator has seen a hardware key, iOS shows only its minimized bar, which has no
 * Search key and covers no result: the list already filters as the words are typed.
 */
async function submitIosSearch(screen: TestFixtures['screen']) {
  const key = screen.getByTestId('Search', { visible: true });
  if (await key.count()) await key.tap();
}

/**
 * On iOS a synthesized scroll up in Settings can move nothing at all: just after the AI sheet
 * fades, and from the end of the page. A drag that starts just under the header, as a finger
 * does, moves the list every time. Android scrolls as asked.
 */
async function settingsScrollUp({ screen, platform }: Pick<NativeBackgroundFixtures, 'screen' | 'platform'>, target: Control) {
  if (platform !== 'ios') {
    await screen.scrollUntilVisible(target, { direction: 'up' });
    return;
  }
  const page = await screen.getByTestId('screen.settings', { visible: true }).boundingBox();
  const header = await screen.getByTestId('settings.back', { visible: true }).boundingBox();
  if (!page || !header) throw new Error('Settings or their header have no geometry.');
  const x = page.x + page.width / 2;
  const from = header.y + header.height + 24;
  const to = from + Math.round(page.height * 0.35);
  for (let drag = 0; drag < 12 && await target.count() === 0; drag += 1) {
    await screen.swipe({ from: { x, y: from }, to: { x, y: to }, duration: 700 });
  }
  await expect(target).toBeVisible();
  // What just came in can still sit under the header: bring it fully below.
  const box = await target.boundingBox();
  if (box && box.y < from) await screen.swipe({ from: { x, y: from }, to: { x, y: 2 * from - box.y + 8 }, duration: 500 });
}

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

async function billingGuest({ app, screen, platform }: NativeBackgroundFixtures) {
  await app.open();
  // The profile and device are owned synthetic QA data, checked by run.mjs.
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next', { visible: true }).tap();
  await leaveGuidedStories(screen);
  await screen.getByTestId('btn.onboarding.skip', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await billingHome(screen);
  await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
  await billingTap(screen, 'quick-settings.language');
  await billingTap(screen, 'quick-settings.language.en');
  // A freshly reset Simlock emulator offers the English voice pack over the drawer.
  await declineVoicePack(screen, platform);
  await expect(screen.getByRole('radio', 'English', { visible: true })).toBeChecked();
  const close = screen.getByTestId('quick-settings.close', { visible: true });
  // Scrolled down to English, the drawer's own close sits under the iOS status bar, where a
  // tap only scrolls back up; the backdrop beside the drawer closes it the same way.
  if (platform === 'ios') await screen.getByRole('button', 'Close quick settings', { visible: true }).first().tap();
  else if (await close.count() === 1) await close.tap();
  else await screen.getByRole('button', 'Close quick settings', { visible: true }).tap();
  await expect(screen.getByTestId('quick-settings.drawer', { visible: true })).toHaveCount(0);
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
  // The lab's rows exist only while it is open; Android can swallow the first taps.
  await tapUntilShown(lab, screen.getByTestId('text.subscription.qa.mode'));
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
  test(`Dreamer native billing delayed ${action} recovers after reentry without a second Store operation`, nativeBillingOptions, async (fixtures) => {
    const { app, screen } = fixtures;
    await billingFree(fixtures);
    if (action === 'restore') await billingTap(screen, 'btn.subscription.qa.scenario.restore_available');
    await billingTap(screen, 'btn.subscription.qa.delayActivation');
    await billingOffer(screen);
    await billingTap(screen, `btn.paywall.${action}`);
    const pending = screen.getByText('Your subscription is recognized. Access activation is still pending. You can retry without purchasing again.', { visible: true });
    await expect(pending).toBeVisible();
    await expect(screen.getByTestId('toast.paywall.success')).toHaveCount(0);
    await app.screenshot(`native-${action}-activation-pending`);
    await billingClose(screen);
    await billingHome(screen);
    await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
    await billingTap(screen, 'quick-settings.plus');
    await expect(pending).toBeVisible();
    await expect(screen.getByTestId('toast.paywall.success')).toHaveCount(0);
    await billingTap(screen, 'btn.paywall.purchase');
    await expect(screen.getByTestId('toast.paywall.success', { visible: true })).toBeVisible();
    await app.screenshot(`native-${action}-retry-confirmed`);
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

async function leaveGuidedStories(screen: TestFixtures['screen']) {
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true') return;
  await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap();
  await screen.getByRole('button', /^(Quitter|Leave|Sair|Salir|Esci|Verlassen)$/i, { visible: true }).tap();
}

/**
 * Dreamer's root layout mounts the Noctalia consent host, so this is `modal.aiConsent`, not `Alert.alert`.
 * Android asks nothing since 2026-10-29: the AI action itself records the grant.
 */
async function acceptAiConsent(screen: TestFixtures['screen'], platform: TestFixtures['platform']) {
  if (platform === 'android') {
    await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toHaveCount(0);
    return;
  }
  await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toBeVisible();
  // The card slides in: a tap while it moves is lost (2026-11-05, iOS core loop).
  await tapWhenStill(screen.getByTestId('btn.aiConsent.accept', { visible: true }));
  await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toHaveCount(0);
}

/** iOS only: Android has no consent to decline. */
async function declineAiConsent(screen: TestFixtures['screen'], platform: TestFixtures['platform']) {
  if (platform === 'android') {
    await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toHaveCount(0);
    return;
  }
  await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.aiConsent.decline', { visible: true }).tap();
  // Native dismissal can outlive its accessibility node. Require stable absence
  // before tapping the capture controls behind the fading modal.
  await expect(screen.getByTestId('modal.aiConsent')).not.toBeVisible();
}

/**
 * A fresh Android target offers the voice pack of a newly chosen language. The sheet opens
 * just after the tap, so it is awaited briefly rather than counted at once; iOS never shows it.
 * Counts, not waitFor: a waitFor that times out stays a failed step, which disqualifies the run.
 */
async function declineVoicePack(screen: TestFixtures['screen'], platform: TestFixtures['platform']) {
  if (platform !== 'android') return;
  const cancel = screen.getByTestId('btn.offline-model.cancel', { visible: true });
  for (let wait = 0; wait < 10 && await cancel.count() === 0; wait += 1) await new Promise(resolve => setTimeout(resolve, 300));
  if (await cancel.count() === 0) return;
  await cancel.tap();
  await expect(cancel).toHaveCount(0);
}

async function acceptDreamerLink({ screen }: Pick<TestFixtures, 'screen'>) {
  // iOS asks before handing a custom URL back from Safari to the installed app.
  const prompt = screen.getByText(/^(Ouvrir dans|Open in).*Noctalia/, { visible: true });
  if (await prompt.count() > 0) {
    await screen.getByRole('button', /^(Ouvrir|Open)$/, { visible: true }).tap();
  }
}

async function openBackgroundRoute(fixtures: NativeBackgroundFixtures, route: string) {
  await fixtures.device.openLink(`noctalia:///${route}`);
  await acceptDreamerLink(fixtures);
}

async function prepareBackgrounds({ app, screen, platform }: NativeBackgroundFixtures, mode: 'light' | 'dark') {
  await app.open();
  await acceptDreamerLink({ screen });
  // The guarded runner owns a disposable simulator and this synthetic profile.
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next', { visible: true }).tap();
  await leaveGuidedStories(screen);
  await screen.getByTestId('btn.onboarding.skip', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  const settings = screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first();
  await screen.scrollUntilVisible(settings, { direction: 'up' });
  await settings.tap();
  await screen.getByTestId('quick-settings.language', { visible: true }).tap();
  await screen.getByTestId('quick-settings.language.fr', { visible: true }).tap();
  // Declining the voice pack preserves the selected UI language and the measured fixture.
  await declineVoicePack(screen, platform);
  await expect(screen.getByRole('radio', 'Français', { visible: true })).toBeChecked();
  await screen.getByTestId('quick-settings.close', { visible: true }).tap();
  await settings.tap();
  await screen.getByTestId(`quick-settings.theme.${mode}`, { visible: true }).tap();
  await expect(screen.getByRole('radio', mode === 'dark' ? 'Sombre' : 'Clair', { visible: true })).toBeChecked();
  await screen.getByTestId('quick-settings.close', { visible: true }).tap();
}

test('Dreamer native contextual backgrounds pilot captures both appearances', {
  tags: ['contextual-backgrounds'], timeout: 240_000,
  skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true' ? 'Requires the owned synthetic Release profile.' : false,
}, async (fixtures) => {
  for (const mode of ['light', 'dark'] as const) {
    await prepareBackgrounds(fixtures, mode);
    await fixtures.screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
    await expect(fixtures.screen.getByTestId('input.dreamTranscript', { visible: true })).toBeVisible();
    await fixtures.app.screenshot(`native-pilot-capture-${mode}`);
    await fixtures.screen.getByTestId('tab.home', { visible: true }).tap();
    await expect(fixtures.screen.getByTestId('screen.home', { visible: true })).toBeVisible();
    await fixtures.app.screenshot(`native-pilot-home-${mode}`);
  }
});

for (const mode of ['light', 'dark'] as const) {
  test(`Dreamer native contextual backgrounds matrix in ${mode}`, {
    tags: ['contextual-backgrounds'], timeout: 600_000,
    skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true' ? 'Requires the owned synthetic Release profile.' : false,
  }, async (fixtures) => {
    const { app, screen } = fixtures;
    await prepareBackgrounds(fixtures, mode);
    await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
    await expect(screen.getByTestId('input.dreamTranscript', { visible: true })).toBeVisible();
    await app.screenshot(`native-capture-${mode}`);
    for (const [tab, root, label] of [
      ['home', 'screen.home', 'home'],
      ['explore', 'screen.explore', 'explorer'],
    ]) {
      await screen.getByTestId(`tab.${tab}`, { visible: true }).tap();
      await expect(screen.getByTestId(root, { visible: true })).toBeVisible();
      await app.screenshot(`native-${label}-${mode}`);
    }
    await screen.getByTestId('tab.stats', { visible: true }).tap();
    await expect(screen.getByTestId('screen.trends', { visible: true })).toBeVisible();
    await app.screenshot(`native-trends-${mode}`);
    // These are the installed app's supported routes, including the notification
    // entry and native-only audio screen. No private data or injected UI is used.
    for (const [route, root, label] of [
      ['dream-guides', 'screen.dreamGuides', 'guides'],
      ['symbol-dictionary', 'screen.symbolDictionary', 'symbols'],
      ['sleep-sounds', 'screen.sleepSounds', 'sleep'],
      ['weekly-recap', 'screen.weeklyRecap', 'weekly-recap'],
      ['auth/reset-password', 'screen.auth.resetPassword', 'reset-password'],
      ['settings', 'screen.settings', 'settings'],
    ]) {
      await openBackgroundRoute(fixtures, route);
      await expect(screen.getByTestId(root, { visible: true })).toBeVisible();
      await app.screenshot(`native-${label}-${mode}`);
    }
    const subscription = screen.getByTestId('settings-section-subscription', { visible: true });
    await screen.scrollUntilVisible(subscription); await subscription.tap();
    await expect(screen.getByTestId('screen.paywall', { visible: true })).toBeVisible();
    await app.screenshot(`native-paywall-${mode}`);
    await screen.getByTestId('btn.paywall.close', { visible: true }).tap();
    for (const [id, label] of [['starter', 'Rêver'], ['memory', 'Se souvenir'], ['lucid', 'Rêve lucide']]) {
      await openBackgroundRoute(fixtures, `ritual/${id}`);
      await expect(screen.getByText(label, { visible: true }).first()).toBeVisible();
      await app.screenshot(`native-ritual-${id}-${mode}`);
    }
    await openBackgroundRoute(fixtures, 'settings');
    await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
    const signin = screen.getByTestId('settings-account-open-signin', { visible: true });
    await screen.scrollUntilVisible(signin, { direction: 'up' }); await signin.tap();
    await screen.getByTestId('btn.mockProfile.plus', { visible: true }).tap();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await screen.getByTestId('tab.journal', { visible: true }).tap();
    await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
    await app.screenshot(`native-journal-${mode}`);
    // The first French showcase entry already has exchanges and resumes Chat
    // directly. Pick an analysed entry without exchanges to exercise Reflection.
    const frenchShowcase = await screen.getByTestId(/^dream\.item\./, { visible: true })
      .filter({ hasText: 'La maison aux pièces inconnues' }).count() > 0;
    const title = frenchShowcase ? 'Je volais au-dessus des nuages' : 'The Infinite Library';
    const search = screen.getByTestId('input.searchDreams', { visible: true });
    await search.fill(title);
    if (fixtures.platform === 'ios') await search.press('Enter');
    else await fixtures.device.dismissKeyboard();
    await expect(search).toHaveValue(title);
    const library = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({
      hasText: title,
    });
    await expect(library).toHaveCount(1); await library.tap();
    const reflection = screen.getByTestId('component.dreamDetail.actionCard', { visible: true });
    await screen.scrollUntilVisible(reflection); await reflection.tap();
    await expect(screen.getByTestId('screen.dreamCategories', { visible: true })).toBeVisible();
    await app.screenshot(`native-reflection-${mode}`);
    await screen.getByTestId('btn.dreamCategory.symbols', { visible: true }).tap();
    await acceptAiConsent(screen, fixtures.platform);
    // Native first-use consent (iOS) precedes the composer. An initial conversation
    // has no synthesis yet; that action is outside this background inspection.
    await expect(screen.getByTestId('chat.input.message', { visible: true })).toBeEnabled();
    await expect(screen.getByTestId('quick-category-symbols', { visible: true })).toBeEnabled();
    await app.screenshot(`native-dialogue-${mode}`);
  });
}

/**
 * Native visibility does not prove the dream page's fixed action dock leaves a control
 * uncovered: XCTest and UIAutomator both call a covered control visible, and a tap there
 * lands on the dock. When the dock overlaps it, drag the reading up by the overlap, then tap.
 */
async function tapClearOfActionDock(screen: TestFixtures['screen'], control: ReturnType<TestFixtures['screen']['getByTestId']>) {
  await screen.scrollUntilVisible(control);
  const dock = screen.getByTestId('component.dreamDetail.actionDock', { visible: true });
  const overlap = async () => {
    const box = await control.boundingBox();
    const overlay = await dock.count() ? await dock.boundingBox() : null;
    if (!box) throw new Error('The control has no geometry.');
    const covered = !!overlay && box.x < overlay.x + overlay.width && box.x + box.width > overlay.x
      && box.y < overlay.y + overlay.height && box.y + box.height > overlay.y;
    return covered && overlay ? { box, top: overlay.y } : null;
  };
  for (let drag = 0; drag < 2; drag += 1) {
    const hidden = await overlap();
    if (!hidden) break;
    // A tall dock (a next step) can cover the middle of the screen, where a viewport swipe
    // starts and moves nothing: the finger goes down on the reading just above the dock.
    const x = hidden.box.x + hidden.box.width / 2;
    const from = hidden.top - 24;
    const to = Math.max(64, from - (hidden.box.y + hidden.box.height - hidden.top) - 48);
    await screen.swipe({ from: { x, y: from }, to: { x, y: to }, duration: 900 });
  }
  if (await overlap()) throw new Error('The fixed action dock still covers the control after scrolling the reading.');
  await control.tap();
}

for (const editor of ['metadata', 'transcript'] as const) {
  test(`Dreamer release background categorization preserves the ${editor} draft and isolates another entry`, {
    // The 30 s categorization, two edits and two searches take 91-161 s on the iOS Simulator:
    // its switch back to the full keyboard after a fill once held the field for 23 s.
    tags: ['journal-concurrency'], timeout: 180_000,
    skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true' || Number(process.env.E2E_NATIVE_MOCK_CATEGORIZATION_MS) < 20000
      ? 'Requires an identified persistent mock Release with the bounded categorization QA opt-in.' : false,
  }, async ({ app, screen, device, platform }) => {
    await app.open();
    await app.clearState();
    await screen.getByTestId('btn.onboarding.intro.next', { visible: true }).tap();
    // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
    await leaveGuidedStories(screen);
    await screen.getByTestId('btn.onboarding.skip', { visible: true }).tap();
    const settings = screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first();
    await screen.scrollUntilVisible(settings, { direction: 'up' });
    await settings.tap();
    const all = screen.getByTestId('quick-settings.all', { visible: true });
    await screen.scrollUntilVisible(all); await all.tap();
    // Categorization after a save never asks: it runs only once AI is allowed, here in Settings.
    // On iOS the whole permission row is the switch, as VoiceOver activates it: its inner
    // Switch is no longer an element of its own there.
    const ai = screen.getByTestId(platform === 'ios' ? 'settings-ai-consent' : 'btn.settings.aiConsent', { visible: true });
    await screen.scrollUntilVisible(ai);
    // One tap only: a second one turns AI off again. iOS asks in a sheet, Android allows at once.
    await tapWhenStill(ai);
    await acceptAiConsent(screen, platform);
    await expect(ai).toBeChecked();
    const signin = screen.getByTestId('settings-account-open-signin', { visible: true });
    await settingsScrollUp({ screen, platform }, signin);
    // The page still glides after the drags that brought the row in.
    await tapWhenStill(signin);
    await screen.getByTestId('btn.mockProfile.existing', { visible: true }).tap();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
    const story = 'E2E sapphire lighthouse above the quiet ocean.';
    await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
    await dismissCaptureKeyboard({ screen, device, platform });
    await screen.getByTestId('btn.saveDream', { visible: true }).tap();
    // The real loading indicator witnesses that the response is still pending.
    // No device clock/evaluation API, fixed sleep or injected UI control is used.
    const pending = screen.getByTestId('text.dreamMetadata.pending');
    await expect(pending).toBeVisible();
    await expect(pending).toHaveCount(1);
    // One edit control opens the name and the story together; the sheet saves them.
    const button = screen.getByTestId('btn.editDream', { visible: true });
    await tapClearOfActionDock(screen, button);
    const input = screen.getByTestId(editor === 'metadata' ? 'input.dreamTitle' : 'input.dreamTranscript');
    const draft = editor === 'metadata' ? 'E2E personal lighthouse title' : 'E2E revised story: the lighthouse has a blue door. I climb three quiet staircases, count the windows, and see a yellow boat passing the harbour. The lamp turns slowly above me while I write down every detail before waking.';
    // The sheet is still rising after the edit tap, and a tap then can miss the field: its
    // text stays and the typing goes nowhere. Focus the field first, as a person would.
    await input.tap(); await expect(input).toBeFocused();
    await input.fill(draft);
    await expect(input).toBeVisible();
    await app.screenshot(`release-${editor}-keyboard-focus`);
    if (platform === 'ios') await screen.getByTestId('btn.journal.dismissKeyboard', { visible: true }).tap();
    else await device.dismissKeyboard();
    await expect(input).toHaveValue(draft);
    await expect(pending).toBeVisible();
    // Absence from the complete tree, not just offscreen, witnesses the real
    // categorization update while this same editor remains open.
    await expect(pending).toHaveCount(0);
    await expect(input).toBeVisible();
    await expect(input).toHaveValue(draft);
    await app.screenshot(`release-${editor}-draft-after-categorization`);
    const save = screen.getByTestId('btn.saveDreamEdit', { visible: true });
    await screen.scrollUntilVisible(save); await save.tap();
    await expect(input).toHaveCount(0);
    const back = screen.getByTestId('btn.navigateJournal', { visible: true });
    await screen.scrollUntilVisible(back, { direction: 'up' }); await back.tap();
    await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
    const search = screen.getByTestId('input.searchDreams', { visible: true });
    const title = editor === 'metadata' ? draft : 'E2E sapphire lighthouse above the quiet ocean';
    await search.fill(title);
    if (platform === 'ios') await submitIosSearch(screen);
    else await device.dismissKeyboard();
    await expect(search).toHaveValue(title);
    await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
    const card = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: title });
    await expect(card).toHaveCount(1);
    // The results are still settling after Search, and a tap then can miss the card: the page
    // itself, not the card's own title, proves it opened.
    const detail = screen.getByTestId('screen.dreamDetail', { visible: true });
    await tapWhenStill(card);
    await expect(detail).toBeVisible();
    // The new name shows as the page title and in the page's header.
    if (editor === 'metadata') await expect(screen.getByText(draft, { visible: true }).first()).toBeVisible();
    else {
      if (platform === 'ios') {
        // One active detail and one story card: no AX echo of another scene answers for it.
        await expect(screen.getByTestId('screen.dreamDetail', { visible: true })).toHaveCount(1);
        await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toHaveCount(1);
      }
      // iOS and Android expose the drop cap's inline object after the initial, so the exact
      // story text matches nothing: read the prose by its ID, past its first letter.
      const transcript = screen.getByTestId('text.dreamDetail.transcript', { visible: true });
      await screen.scrollUntilVisible(transcript); await expect(transcript).toContainText(draft.slice(1));
    }
    await tapClearOfActionDock(screen, button);
    await input.tap(); await expect(input).toBeFocused();
    if (platform === 'ios' && editor === 'transcript') {
      // A fill once kept a suffix of the long multiline story: empty it first and check.
      // UIKit's menu is no way there: on a French simulator a tap on an English word opens
      // the spelling suggestions, not Select All.
      await input.clear();
      await expect(input).toHaveValue('');
    }
    await input.fill('E2E abandoned local draft');
    if (platform === 'ios') await screen.getByTestId('btn.journal.dismissKeyboard', { visible: true }).tap();
    else await device.dismissKeyboard();
    await expect(input).toHaveValue('E2E abandoned local draft');
    // The editor's veil covers the page's Back: the draft is left by the sheet's own Cancel.
    const cancel = screen.getByTestId('btn.cancelDreamEdit', { visible: true });
    await screen.scrollUntilVisible(cancel); await cancel.tap();
    await expect(input).toHaveCount(0);
    await screen.scrollUntilVisible(back, { direction: 'up' }); await back.tap();
    await search.fill('The Infinite Library');
    if (platform === 'ios') await submitIosSearch(screen);
    else await device.dismissKeyboard();
    await expect(search).toHaveValue('The Infinite Library');
    await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
    const other = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: 'The Infinite Library' });
    await expect(other).toHaveCount(1);
    await tapWhenStill(other);
    await expect(detail).toBeVisible();
    await expect(input).toHaveCount(0);
    await tapClearOfActionDock(screen, button);
    await expect(input).toHaveValue(editor === 'metadata' ? SEEDED_OTHER_DREAM.title : SEEDED_OTHER_DREAM.transcript);
    await app.screenshot(`release-${editor}-other-entry-isolated`);
  });
}

test('Dreamer release onboarding reaches capture and rejects an empty save', async ({ app, screen, device, platform }) => {
  await app.open();
  await app.clearState();
  await expect(screen.getByTestId('screen.onboarding')).toBeVisible();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  await leaveGuidedStories(screen);
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  await expect(screen.getByTestId('btn.saveDream')).toBeDisabled();
  await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
  const draft = 'Release fixture: a blue lighthouse above a quiet sea.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(draft);
  await dismissCaptureKeyboard({ screen, device, platform });
  await expect(screen.getByTestId('input.dreamTranscript', { visible: true })).toHaveValue(draft);
  await screen.scrollUntilVisible(screen.getByTestId('btn.recording.inputMode.voice', { visible: true }), { direction: 'up' });
  await screen.getByTestId('btn.recording.inputMode.voice', { visible: true }).tap();
  // Speech with a draft owes its first question: iOS asks before any provider call, and
  // declining keeps that question local. Either way the draft itself is not rewritten.
  await declineAiConsent(screen, platform);
  // The declined sheet is still fading out when it leaves the tree, and a tap then lands on it:
  // declineAiConsent waits for its stable absence, and this tap for a still page.
  const transcript = screen.getByTestId('input.dreamTranscript', { visible: true });
  await tapWhenStill(screen.getByTestId('btn.recording.inputMode.text', { visible: true }));
  await expect(transcript).toHaveValue(draft);
  await expect(screen.getByTestId('btn.saveDream')).toBeEnabled();
  await app.screenshot('release-capture');
});

test('Dreamer release Quick Settings persists French and theme choices while preserving a draft', async ({ app, screen, device, platform }) => {
  await app.open();
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  await leaveGuidedStories(screen);
  await screen.getByTestId('btn.onboarding.skip').tap();
  await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
  const draft = 'Fixture de qualification : un phare bleu sur une mer calme.';
  const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
  await editor.fill(draft);
  await dismissCaptureKeyboard({ screen, device, platform });
  // The real header precedes the extra navigation rail in mock Release builds.
  const settings = screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first();
  await screen.scrollUntilVisible(settings, { direction: 'up' });
  await settings.tap();
  await expect(screen.getByTestId('quick-settings.close', { visible: true })).toBeEnabled();
  await screen.getByTestId('quick-settings.language', { visible: true }).tap();
  const english = screen.getByTestId('quick-settings.language.en', { visible: true });
  await english.tap();
  // A fresh Android target can lack the English pack as well as the French one.
  await declineVoicePack(screen, platform);
  await expect(screen.getByRole('radio', 'English', { visible: true })).toBeChecked();
  const french = screen.getByTestId('quick-settings.language.fr', { visible: true });
  await french.tap();
  // Android offers a speech pack independently of the saved UI language.
  await declineVoicePack(screen, platform);
  await expect(screen.getByRole('radio', 'Français', { visible: true })).toBeChecked();
  await screen.getByTestId('quick-settings.close', { visible: true }).tap();
  await expect(screen.getByTestId('quick-settings.language.fr')).toHaveCount(0);
  await expect(editor).toHaveValue(draft);
  for (const theme of ['dark', 'light']) {
    if (platform === 'android') {
      await expect(screen.getByTestId('quick-settings.drawer', { visible: true })).toHaveCount(0);
    }
    await settings.tap();
    const choice = screen.getByTestId(`quick-settings.theme.${theme}`, { visible: true });
    if (platform === 'android') {
      await screen.scrollUntilVisible(choice);
      await expect(choice).toBeEnabled();
    }
    await choice.tap();
    await expect(screen.getByRole('radio', theme === 'dark' ? 'Sombre' : 'Clair', { visible: true })).toBeChecked();
    await app.screenshot(`release-quick-settings-${theme}`);
    await screen.getByTestId('quick-settings.close', { visible: true }).tap();
    await expect(editor).toHaveValue(draft);
  }
  await app.restart();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await expect(editor).toHaveValue(draft);
  await settings.tap();
  await expect(screen.getByRole('radio', 'Clair', { visible: true })).toBeChecked();
  await screen.getByTestId('quick-settings.language', { visible: true }).tap();
  await expect(screen.getByRole('radio', 'Français', { visible: true })).toBeChecked();
  await app.screenshot('release-quick-settings-persistence');
});

test('Dreamer release opens the language choices from the Quick Settings row', async ({ app, screen }) => {
  await app.open();
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  await leaveGuidedStories(screen);
  await screen.getByTestId('btn.onboarding.skip').tap();
  await screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first().tap();
  const language = screen.getByTestId('quick-settings.language', { visible: true });
  await expect(language).toBeVisible();
  await language.tap();
  await expect(screen.getByTestId('quick-settings.language.en', { visible: true })).toBeVisible();
  await app.screenshot('release-language-choices-open');
});


test('Dreamer release drawer layout, backdrop and full settings actions remain usable', async ({ app, screen }) => {
  await app.open();
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  await leaveGuidedStories(screen);
  await screen.getByTestId('btn.onboarding.skip').tap();
  const settings = screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first();
  await settings.tap();
  for (const [layout, label] of [['compact', /^Compact$/], ['cards', /^(Cards|Cartes)$/]] as const) {
    const choice = screen.getByTestId(`quick-settings.journal.${layout}`, { visible: true });
    await screen.scrollUntilVisible(choice);
    await choice.tap();
    await expect(screen.getByRole('radio', label, { visible: true })).toBeChecked();
  }
  const drawer = await screen.getByTestId('quick-settings.drawer', { visible: true }).boundingBox();
  if (!drawer || drawer.x <= 0) throw new Error('Drawer must leave a tappable backdrop.');
  await screen.tapAt({ x: drawer.x / 2, y: drawer.y + drawer.height / 2 });
  await expect(screen.getByRole('radio', /^Compact$/)).toHaveCount(0);
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await settings.tap();
  const all = screen.getByTestId('quick-settings.all', { visible: true });
  await screen.scrollUntilVisible(all);
  await all.tap();
  await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
  await app.screenshot('release-drawer-settings-destination');
});

test('Dreamer release drawer sign-in opens its account destination', async ({ app, screen, platform }) => {
  await app.open();
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  await leaveGuidedStories(screen);
  await screen.getByTestId('btn.onboarding.skip').tap();
  await screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first().tap();
  const signin = screen.getByTestId('quick-settings.signin', { visible: true });
  if (platform === 'android') {
    await screen.scrollUntilVisible(signin);
    await expect(signin).toBeEnabled();
  }
  await signin.tap();
  await expect(screen.getByTestId('screen.account', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('input.auth.email', { visible: true })).toBeVisible();
  await app.screenshot('release-drawer-account-destination');
});


/**
 * A story button rises into place once its scene has played; Android reports it in flight, and
 * agent-device refuses a tap on it there as covered. Tap it once it is ready and still.
 */
async function storyStep(screen: TestFixtures['screen'], id: string) {
  const button = screen.getByTestId(id, { visible: true });
  await expect(button).toBeEnabled();
  await tapWhenStill(button);
}

test('Dreamer release opt-in feature story bridges capture to exploration', {
  skip: process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true'
    ? 'Requires an identified Release built with feature sheets enabled.' : false,
}, async ({ app, screen }) => {
  await app.open();
  await app.clearState();
  await screen.getByTestId('btn.onboarding.feature.capture', { visible: true }).tap();
  await storyStep(screen, 'btn.onboarding.story.next');
  await storyStep(screen, 'btn.onboarding.story.next');
  await storyStep(screen, 'btn.onboarding.story.next');
  await expect(screen.getByTestId('component.onboarding.story.capture.3', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.onboarding.globeCard.1', { visible: true }).tap();
  await expect(screen.getByTestId('component.onboarding.dreamEntry', { visible: true })).toBeVisible();
  await expect(screen.getByText(/^(Flying over the harbour|Voler au-dessus du port)$/, { visible: true })).toBeVisible();
  await storyStep(screen, 'btn.onboarding.story.continue');
  await expect(screen.getByTestId('component.onboarding.story.connect.0', { visible: true })).toBeVisible();
  await storyStep(screen, 'btn.onboarding.story.next');
  await storyStep(screen, 'btn.onboarding.story.next');
  await storyStep(screen, 'btn.onboarding.story.next');
  await storyStep(screen, 'btn.onboarding.story.continue');
  await expect(screen.getByTestId('component.onboarding.story.explore.0', { visible: true })).toBeVisible();
  await storyStep(screen, 'btn.onboarding.story.next');
  await storyStep(screen, 'btn.onboarding.story.next');
  await storyStep(screen, 'btn.onboarding.story.next');
  await expect(screen.getByTestId('component.onboarding.story.explore.3', { visible: true })).toBeVisible();
  // Nothing is chosen ahead of time. Skip is the way on until the reader answers;
  // the door button arrives only after Noctalia's closing line.
  await expect(screen.getByTestId('text.onboarding.dialogue.question', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('btn.onboarding.story.skip', { visible: true })).toBeEnabled();
  await screen.getByTestId('btn.onboarding.dialogue.home', { visible: true }).tap();
  await expect(screen.getByTestId('component.onboarding.dialogue.followup', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('text.onboarding.dialogue.closing', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('btn.onboarding.story.skip')).toHaveCount(0);
  await storyStep(screen, 'btn.onboarding.story.continue');
  await expect(screen.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
  // The last story ends through the blue door, which opens on the path step.
  await expect(screen.getByTestId('component.onboarding.path', { visible: true })).toBeVisible();
  await app.screenshot('release-story-complete');
});

test('Dreamer release drawer Plus opens its offer and closes back to Capture', async ({ app, screen, platform }) => {
  await app.open();
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  await leaveGuidedStories(screen);
  await screen.getByTestId('btn.onboarding.skip').tap();
  await screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first().tap();
  const plus = screen.getByTestId('quick-settings.plus', { visible: true });
  if (platform === 'android') {
    await screen.scrollUntilVisible(plus);
    await expect(plus).toBeEnabled();
  }
  await plus.tap();
  // The production emulator has no Store account; offering fetch errors surface a modal.
  const unavailable = screen.getByTestId('bottomSheet.paywall.error', { visible: true });
  if (platform === 'android' && process.env.E2E_NATIVE_MOCK_MODE !== 'true') {
    await expect(unavailable).toBeVisible();
    await screen.getByRole('button', 'OK', { visible: true }).tap();
  }
  await expect(screen.getByTestId('screen.paywall', { visible: true })).toBeVisible();
  await app.screenshot('release-drawer-plus-destination');
  await screen.getByTestId('btn.paywall.close', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await app.screenshot('release-offer-return');
});

// This journey retains the existing owned synthetic SQLite fixture. It never seeds,
// clears an account, starts audio, submits an analysis or opens a Store operation.
test('Dreamer Release scroll dogfood preserves its journal and painted resource screens', {
  tags: ['framerate'], timeout: 600_000,
  skip: process.env.E2E_SCROLL_DOGFOOD !== 'synthetic200'
    ? 'Requires the work package’s owned 200-dream Release fixture.' : false,
}, async (fixtures) => {
  const { app, screen, device } = fixtures;
  await app.open();
  await screen.getByTestId('tab.journal', { visible: true }).tap();
  const card = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: 'Noctalia performance 001' });
  await expect(card).toHaveCount(1);
  await app.screenshot('scroll-dogfood-journal');
  await card.tap();
  await expect(screen.getByTestId('screen.dreamDetail', { visible: true })).toBeVisible();
  await expect(screen.getByRole('heading', 'Noctalia performance 001', { visible: true })).toBeVisible();
  await app.screenshot('scroll-dogfood-detail');
  await screen.swipe({ direction: 'up', momentum: 'slow' });
  await screen.swipe({ direction: 'down', momentum: 'slow' });
  await device.back();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
  await screen.scrollUntilVisible(card, { direction: 'up' });
  await expect(card).toHaveCount(1);
  for (const [tab, root, label] of [
    ['tab.home', 'screen.home', 'home'], ['tab.stats', 'screen.trends', 'trends'],
    ['tab.explore', 'screen.explore', 'explore'],
  ]) {
    await screen.getByTestId(tab, { visible: true }).tap();
    await expect(screen.getByTestId(root, { visible: true })).toBeVisible();
    await app.screenshot(`scroll-dogfood-${label}-top`);
    await screen.swipe({ direction: 'up', momentum: 'slow' });
    await screen.swipe({ direction: 'down', momentum: 'slow' });
    await expect(screen.getByTestId(root, { visible: true })).toBeVisible();
    if (label === 'trends') {
      const all = screen.getByTestId('trends.period.all');
      await screen.scrollUntilVisible(all, { direction: 'up' });
      await all.tap();
      await expect(screen.getByTestId('trends.figure.dreams.value')).toHaveText('200');
    }
    await app.screenshot(`scroll-dogfood-${label}-return`);
  }
  for (const [route, root] of [
    ['dream-guides', 'screen.dreamGuides'], ['symbol-dictionary', 'screen.symbolDictionary'],
  ]) {
    await openBackgroundRoute(fixtures, route);
    await expect(screen.getByTestId(root, { visible: true })).toBeVisible();
    await app.screenshot(`scroll-dogfood-${route}`);
  }
  // This production-apk profile leaves the audio feature disabled. Its direct
  // link must retain the existing safe return to Today, without starting audio.
  await openBackgroundRoute(fixtures, 'sleep-sounds');
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  await app.open();
  await screen.getByTestId('tab.home', { visible: true }).tap();
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  restore.portrait = true;
  await device.setOrientation('landscape-left');
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  await app.screenshot('scroll-dogfood-landscape');
  await device.setOrientation('portrait');
  restore.portrait = false;
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
});

/**
 * `app.open()` relaunches the app. A link sent while it is still starting can reach it before
 * it listens for links: it then stays on Capture. A person opens the link from a started app.
 */
async function openStartedApp({ app, screen }: Pick<NativeBackgroundFixtures, 'app' | 'screen'>) {
  await app.open();
  await expect(screen.getByTestId(/^screen\.(onboarding|recording|home|settings)$/, { visible: true }).first()).toBeVisible();
}

// Recovered from the isolated security QA run. Use the canonical owned-device
// profile and supported scheme instead of a physical-phone-only local config.
const nativeRecoveryOptions = {
  tags: ['native-security-recovery'],
  skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true'
    ? 'Requires the owned synthetic Release profile.' : false,
};

test('Dreamer native security recovery rejects a bearer-shaped reset link', nativeRecoveryOptions, async (fixtures) => {
  const { screen } = fixtures;
  await openStartedApp(fixtures);
  await openBackgroundRoute(fixtures, 'auth/reset-password?type=recovery&access_token=qa-synthetic&refresh_token=qa-synthetic');
  await expect(screen.getByTestId('screen.auth.resetPassword')).toBeVisible();
  await expect(screen.getByText(/Ce lien n.est plus valide|This link is no longer valid/)).toBeVisible();
  await expect(screen.getByTestId('btn.auth.resetBackToSignIn')).toBeEnabled();
  await expect(screen.getByTestId('input.auth.recoveryEmail')).toBeHidden();
});

test('Dreamer native security recovery keeps a synthetic token-hash form inert', nativeRecoveryOptions, async (fixtures) => {
  const { screen } = fixtures;
  await openStartedApp(fixtures);
  await openBackgroundRoute(fixtures, 'auth/reset-password?type=recovery&token_hash=qa-synthetic-invalid');
  await expect(screen.getByTestId('screen.auth.resetPassword')).toBeVisible();
  await expect(screen.getByTestId('input.auth.recoveryEmail')).toBeVisible();
  await expect(screen.getByTestId('input.auth.newPassword')).toBeVisible();
  await expect(screen.getByTestId('btn.auth.updatePassword')).toBeDisabled();
});

// The home screen widgets open Capture with the link they carry. It must land there from
// another screen, keeping the draft left in it, and from a closed app.
const CAPTURE_WIDGET_LINK = 'noctalia://recording';

async function onboardToCapture({ app, screen }: Pick<NativeBackgroundFixtures, 'app' | 'screen'>) {
  await app.open();
  await acceptDreamerLink({ screen });
  // The guarded runner owns a disposable simulator and this synthetic profile.
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next', { visible: true }).tap();
  await leaveGuidedStories(screen);
  await screen.getByTestId('btn.onboarding.skip', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
}

// The iOS keyboard has no key that hides it, so a person taps Capture's title instead.
async function dismissCaptureKeyboard({ screen, device, platform }: Pick<NativeBackgroundFixtures, 'screen' | 'device' | 'platform'>) {
  if (platform !== 'ios') {
    await device.dismissKeyboard();
    return;
  }
  const input = screen.getByTestId('input.dreamTranscript', { visible: true });
  const keyboardReturn = screen.getByTestId('Return', { visible: true });
  const title = screen.getByText(/^(Capture|Capturer|Capturar|Cattura|Aufnehmen|Registrar)$/, { visible: true }).first();
  // Once the simulator has seen a hardware key (the driver clears a field with Command-A), iOS
  // shows only its minimized bar, without Return: the focused story is what both states share.
  await expect(input).toBeFocused();
  const softKeyboard = await keyboardReturn.count() > 0;
  // Just after typing, the editor can still be scrolling into view, and a tap then only stops it.
  await title.tap();
  for (let tap = 1; tap < 3 && await keyboardReturn.count() > 0; tap += 1) await title.tap();
  await expect(keyboardReturn).toBeHidden();
  // React Native's scroll view ends editing on a touch outside only once a soft keyboard has
  // shown; with the minimized bar, as with any hardware keyboard, the story keeps its focus
  // and no keyboard covers the page.
  if (softKeyboard) await expect(input).not.toBeFocused();
}

test('Dreamer release capture widget link opens Capture from Today and keeps the draft', { tags: ['widget-links'] }, async ({ app, screen, device, platform }) => {
  await onboardToCapture({ app, screen });
  await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
  const draft = 'Widget fixture: a paper boat crossing a dark pond.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(draft);
  await dismissCaptureKeyboard({ screen, device, platform });
  await billingHome(screen);
  await device.openLink(CAPTURE_WIDGET_LINK);
  await acceptDreamerLink({ screen });
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('input.dreamTranscript', { visible: true })).toHaveValue(draft);
  await app.screenshot('widget-link-from-today');
});

test('Dreamer release capture widget link starts a closed app on Capture', { tags: ['widget-links'] }, async ({ app, screen, device }) => {
  await onboardToCapture({ app, screen });
  await billingHome(screen);
  // iOS asks once before handing the link over. A closed app has no screen to answer it on,
  // so it is answered while the app runs; the closed app then starts straight on the link.
  await device.openLink(CAPTURE_WIDGET_LINK);
  await acceptDreamerLink({ screen });
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await billingHome(screen);
  await device.closeApp();
  await device.openLink(CAPTURE_WIDGET_LINK);
  await acceptDreamerLink({ screen });
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('screen.onboarding')).toHaveCount(0);
  await app.screenshot('widget-link-cold-start');
});


// PR #633: actual native collection UI and the Android cold/offline fallback.
// Accessible image assertions alone do not prove artwork pixels: qualification also
// requires inspection of these captures and the exact CDN image in the native cache.
// The guarded runner permits this synthetic profile only on owned QA targets.
async function collection633Start(fixtures: NativeBackgroundFixtures) {
  const { screen } = fixtures;
  await billingGuest(fixtures);
  await billingSettings(screen);
  await billingTap(screen, 'settings-account-open-signin', 'up');
  await screen.getByTestId('btn.mockProfile.new', { visible: true }).tap();
  const story = 'PR633 native: a glass beach under an enormous moon.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  await screen.getByTestId('btn.dreamCaptureSeal.readLater', { visible: true }).tap();
  await expect(screen.getByTestId('screen.dreamDetail', { visible: true })).toBeVisible();
  // iOS exposes a separate drop cap and an object-replacement marker in the transcript.
  await expect(screen.getByTestId('text.dreamDetail.transcript')).toContainText(story.slice(1));
  await screen.getByTestId('btn.savedDream.returnToJournal', { visible: true }).tap();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
}

async function collection633Open(screen: TestFixtures['screen']) {
  await screen.getByTestId('tab.explore', { visible: true }).tap();
  await screen.getByTestId('btn.explore.collection', { visible: true }).tap();
  await expect(screen.getByTestId('screen.collection', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('collection.summary.count')).toHaveText('1 card of 43');
  const bounds = await screen.getByTestId('screen.collection', { visible: true }).boundingBox();
  if (!bounds) throw new Error('Native collection frame is missing');
  return bounds;
}

for (const offline of [false, true]) {
  test(`PR633 native collection: grid, reveal and retained detail ${offline ? 'offline with cold cache' : 'online'}`, {
    tags: ['pr633-collection'], timeout: 240_000,
    platforms: offline ? ['android'] : ['ios', 'android'],
    skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true' ? 'Requires owned mock-persistent Release.' : false,
  }, async (fixtures) => {
    const { app, screen, device } = fixtures;
    // collection633Start begins with app.open() through billingGuest.
    await collection633Start(fixtures);
    if (offline) {
      restore.airplane = true;
      await device.setAirplaneMode(true);
    }
    const collectionFrame = await collection633Open(screen);
    await expect(screen.getByRole('button', 'New Bronze card: Night Journal. Ready to reveal.', { visible: true })).toBeVisible();
    await app.screenshot(`pr633-${offline ? 'offline' : 'online'}-grid`);
    await screen.getByTestId('collection.summary.new', { visible: true }).tap();
    await screen.getByTestId('collection.detail.reveal', { visible: true }).tap();
    await expect(screen.getByTestId('collection.detail.tier.bronze', { visible: true })).toBeVisible();
    await expect(screen.getByRole('image', 'Night Journal, Bronze', { visible: true })).toBeVisible();
    await app.screenshot(`pr633-${offline ? 'offline' : 'online'}-revealed`);
    const close = screen.getByTestId('collection.detail.close', { visible: true });
    const closeFrame = await close.boundingBox();
    if (!closeFrame) throw new Error('Card close control frame is missing');
    expect(closeFrame.x).toBeGreaterThanOrEqual(collectionFrame.x);
    expect(closeFrame.x + closeFrame.width).toBeLessThanOrEqual(collectionFrame.x + collectionFrame.width);
    await close.tap();
    await expect(screen.getByTestId('collection.detail', { visible: true })).toHaveCount(0);
    await expect(screen.getByTestId('collection.summary.new')).toHaveCount(0);
    await screen.scrollUntilVisible(screen.getByTestId('collection.card.night-journal', { visible: true }));
    await screen.getByTestId('collection.card.night-journal', { visible: true }).tap();
    await expect(screen.getByRole('image', 'Night Journal, Bronze', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('collection.detail.reveal')).toHaveCount(0);
    await app.screenshot(`pr633-${offline ? 'offline' : 'online'}-reopened`);
  });
}

// Release journeys App Review goes through on a first session (2026-11-05). They run in the
// default campaign: release-simulators leaves out only the contextual-backgrounds captures.

/** The mock chat's replies (mock-data/generators.ts), English in every UI language. */
const MOCK_CHAT_REPLY = /^(That's an interesting question|Based on your dream,|Dreams like yours often|The elements you mentioned|I sense that this dream)/;

/** The dream page's header scrolls with it; its return tab stays inside the usable screen. */
async function releaseJournalFromDream(screen: TestFixtures['screen']) {
  const back = screen.getByTestId('btn.navigateJournal', { visible: true });
  await screen.scrollUntilVisible(back, { direction: 'up' });
  const returnTab = screen.getByTestId('journal.detail.returnTab', { visible: true });
  if (await returnTab.count()) await returnTab.tap();
  else await back.tap();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
}

test('Dreamer release guest reads its first dream and asks one question that survives a restart', {
  platforms: ['ios', 'android'], tags: ['native-core-loop'], timeout: 300_000,
  // The reading and the chat come from the mock services; any other build would call the real AI.
  skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true' ? 'Requires the owned mock Release: its AI is simulated.' : false,
}, async (fixtures) => {
  const { app, screen, device, platform } = fixtures;
  await onboardToCapture(fixtures);
  await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
  const story = 'Core loop fixture: a silver train crossing a frozen lake at dawn.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await dismissCaptureKeyboard(fixtures);
  await billingTap(screen, 'btn.saveDream');
  // A guest's first dream is read at once, unasked; iOS first asks to share it with the AI.
  await acceptAiConsent(screen, platform);
  const reading = screen.getByTestId('component.dreamDetail.interpretation', { visible: true });
  await expect(reading).toBeVisible();
  // The reading moves the page as it arrives.
  await waitUntilStill(reading);
  // Android lists only nodes on screen, and the reading pushed the story up.
  const transcript = screen.getByTestId('text.dreamDetail.transcript', { visible: true });
  if (platform === 'android') await screen.scrollUntilVisible(transcript, { direction: 'up' });
  // iOS exposes a separate drop cap and an object-replacement marker in the transcript.
  await expect(transcript).toContainText(story.slice(1));
  await app.screenshot('release-core-loop-reading');
  await billingTap(screen, 'component.dreamDetail.actionCard');
  await expect(screen.getByTestId('screen.dreamCategories', { visible: true })).toBeVisible();
  await billingTap(screen, 'btn.dreamCategory.freeChat');
  const input = screen.getByTestId('chat.input.message', { visible: true });
  await expect(input).toBeEnabled();
  const question = 'Why did the silver train never stop at a station?';
  await input.fill(question);
  // The iPhone composer keeps its keyboard open with Send reachable; Android's covers it.
  if (platform === 'android') await device.dismissKeyboard();
  await billingTap(screen, 'chat.button.send');
  const latest = screen.getByRole('button', /^(Jump to latest|Aller au dernier message)$/, { visible: true });
  if (await latest.count()) await latest.tap();
  await expect(screen.getByText(MOCK_CHAT_REPLY, { visible: true })).toBeVisible();
  await expect(screen.getByTestId('chat.loading')).toBeHidden();
  // A reply can quote the question in lower case; only the question matches it exactly.
  const asked = screen.getByText(question, { exact: true });
  await expect(asked).toHaveCount(1);
  await app.screenshot('release-core-loop-chat');
  const back = screen.getByRole('button', /^(Back|Retour)$/, { visible: true });
  await back.tap();
  await expect(screen.getByTestId('screen.dreamCategories', { visible: true })).toBeVisible();
  await back.tap();
  await expect(screen.getByTestId('screen.dreamDetail', { visible: true })).toBeVisible();
  await releaseJournalFromDream(screen);
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(1);
  await app.restart();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await billingHome(screen);
  await screen.getByTestId('tab.journal', { visible: true }).tap();
  const entry = screen.getByTestId(/^dream\.item\./, { visible: true });
  await expect(entry).toHaveCount(1);
  await entry.tap();
  await expect(screen.getByTestId('screen.dreamDetail', { visible: true })).toBeVisible();
  await screen.scrollUntilVisible(reading);
  await expect(reading).toBeVisible();
  await billingTap(screen, 'component.dreamDetail.actionCard');
  // A dream with an exchange resumes its conversation; Reflection comes first otherwise.
  const categories = screen.getByTestId('screen.dreamCategories', { visible: true });
  await expect.poll(async () => (await input.count()) + (await categories.count())).toBeGreaterThan(0);
  if (await categories.count()) await billingTap(screen, 'btn.dreamCategory.freeChat');
  await expect(input).toBeVisible();
  await expect(asked).toHaveCount(1);
  await app.screenshot('release-core-loop-after-restart');
});

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

test('Dreamer release every destination opens in system dark mode', {
  platforms: ['ios', 'android'], tags: ['native-release-tour'], timeout: 360_000,
  skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true' ? 'Requires the owned mock Release and its seeded test profile.' : false,
}, async (fixtures) => {
  const { app, screen, device, platform } = fixtures;
  // Each destination shows its own screen, never the error card a throwing screen leaves.
  const shown = async (id: string, label: string) => {
    await expect(screen.getByTestId(id, { visible: true })).toBeVisible();
    await expect(screen.getByTestId('screen.errorBoundary')).toHaveCount(0);
    await app.screenshot(`release-tour-${label}`);
  };
  restore.appearance = true;
  await device.setAppearance('dark');
  await billingGuest(fixtures);
  // The seeded profile fills the Journal, Trends and the weekly recap.
  await billingSettings(screen);
  await billingTap(screen, 'settings-account-open-signin', 'up');
  await screen.getByTestId('btn.mockProfile.existing', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  // Automatic follows the system appearance; the default Dynamic theme follows the clock.
  const settings = screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first();
  await screen.scrollUntilVisible(settings, { direction: 'up' });
  await settings.tap();
  const auto = screen.getByTestId('quick-settings.theme.auto', { visible: true });
  if (platform === 'android') await screen.scrollUntilVisible(auto);
  await auto.tap();
  // The option's container carries the testID; its radio carries the checked state.
  await expect(screen.getByRole('radio', /^(Automatic|Automatique)$/, { visible: true })).toBeChecked();
  // As in billingGuest: on iOS the backdrop closes the drawer wherever it is scrolled.
  const close = screen.getByTestId('quick-settings.close', { visible: true });
  if (platform === 'ios') await screen.getByRole('button', 'Close quick settings', { visible: true }).first().tap();
  else if (await close.count() === 1) await close.tap();
  else await screen.getByRole('button', 'Close quick settings', { visible: true }).tap();
  await expect(screen.getByTestId('quick-settings.drawer', { visible: true })).toHaveCount(0);
  await shown('screen.recording', 'capture-dark');
  await billingHome(screen);
  await shown('screen.home', 'home-dark');
  await screen.getByTestId('tab.journal', { visible: true }).tap();
  await shown('screen.journal', 'journal-dark');
  const search = screen.getByTestId('input.searchDreams', { visible: true });
  await search.fill('zzqx');
  if (platform === 'ios') await submitIosSearch(screen);
  else await device.dismissKeyboard();
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
  await billingTap(screen, 'btn.empty.clearFilters');
  await expect(search).toHaveValue('');
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true }).first()).toBeVisible();
  await screen.getByTestId('tab.stats', { visible: true }).tap();
  await shown('screen.trends', 'trends-dark');
  await screen.getByTestId('tab.explore', { visible: true }).tap();
  await shown('screen.explore', 'explore-dark');
  await billingTap(screen, 'btn.explorer.symbols');
  await shown('screen.symbolDictionary', 'symbols-dark');
  const symbol = screen.getByTestId(/^symbol\.item\./, { visible: true }).first();
  await screen.scrollUntilVisible(symbol);
  await symbol.tap();
  await shown('screen.symbolDetail', 'symbol-detail-dark');
  await device.back();
  await expect(screen.getByTestId('screen.symbolDictionary', { visible: true })).toBeVisible();
  await billingTap(screen, 'symbol-dictionary-back', 'up');
  await expect(screen.getByTestId('screen.explore', { visible: true })).toBeVisible();
  await billingTap(screen, 'btn.explorer.guides');
  await shown('screen.dreamGuides', 'guides-dark');
  const guide = screen.getByTestId(/^dream-guide-/, { visible: true }).first();
  await screen.scrollUntilVisible(guide);
  await guide.tap();
  await shown('screen.dreamGuideDetail', 'guide-detail-dark');
  await device.back();
  await expect(screen.getByTestId('screen.dreamGuides', { visible: true })).toBeVisible();
  for (const [route, id] of [['weekly-recap', 'screen.weeklyRecap'], ['moon-letter', 'screen.moonLetter']]) {
    await openBackgroundRoute(fixtures, route);
    await shown(id, `${route}-dark`);
  }
  // The system turns light while the app runs: the open screen follows, without a restart.
  await device.setAppearance('light');
  await shown('screen.moonLetter', 'moon-letter-light');
});

// Guideline 2.5.4: the audio background mode is used. The countdown runs only while the player
// plays, so a count 15 s lower after 20 s in the background means it played meanwhile.
test('Dreamer release sleep sound keeps its timer running in the background', {
  platforms: ['ios', 'android'], tags: ['native-sleep-sounds'], timeout: 240_000,
}, async ({ app, screen, device }) => {
  await onboardToCapture({ app, screen });
  await billingHome(screen);
  await screen.getByTestId('tab.explore', { visible: true }).tap();
  await expect(screen.getByTestId('screen.explore', { visible: true })).toBeVisible();
  await billingTap(screen, 'btn.explorer.sleepSounds');
  await expect(screen.getByTestId('screen.sleepSounds', { visible: true })).toBeVisible();
  const rain = screen.getByTestId('sleep-sound-rain', { visible: true });
  await rain.tap();
  await expect(rain).toBeChecked();
  const fifteen = screen.getByTestId('sleep-duration-15', { visible: true });
  await screen.scrollUntilVisible(fifteen);
  await fifteen.tap();
  await expect(fifteen).toBeChecked();
  const remaining = screen.getByTestId('sleep-remaining-time', { visible: true });
  const seconds = async () => {
    const [minutes, rest] = ((await remaining.textContent()) ?? '').split(':').map(Number);
    return minutes * 60 + rest;
  };
  await billingTap(screen, 'sleep-playback-toggle');
  // The sound downloads once, then plays and the countdown starts. While it plays the app hides
  // the choices from accessibility, so the countdown is the proof, in any language.
  await expect.poll(seconds, { timeout: 60_000 }).toBeLessThan(15 * 60);
  await expect(screen.getByTestId('sleep-sound-error')).toHaveCount(0);
  const before = await seconds();
  await device.home();
  await new Promise(resolve => setTimeout(resolve, 20_000));
  await device.openApp('com.tanuki75.noctalia');
  await expect(screen.getByTestId('screen.sleepSounds', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('sleep-sound-error')).toHaveCount(0);
  // The count shows on its next tick; a short wait cannot make up for 20 s that did not run.
  await expect.poll(async () => before - await seconds(), { timeout: 5_000 }).toBeGreaterThanOrEqual(15);
  await app.screenshot('release-sleep-sound-after-background');
  await billingTap(screen, 'sleep-playback-toggle');
  await expect(rain).toBeEnabled();
  await billingTap(screen, 'sleep-sounds-back', 'up');
  await expect(screen.getByTestId('screen.explore', { visible: true })).toBeVisible();
});

// Guideline 4.8: Google sign-in is offered, so Sign in with Apple must be too. Mock builds swap
// both for test profiles; this runs in the production layer. Without an Apple Account the
// simulator may show its own sheet, or the app may say it could not sign in: both are accepted.
test('Dreamer release iOS account offers Sign in with Apple and a cancelled Apple sheet keeps the guest', {
  platforms: ['ios'], tags: ['native-apple-sign-in'],
  skip: process.env.E2E_NATIVE_MOCK_MODE !== 'false' ? 'Requires a Release built without mock services.' : false,
}, async ({ app, screen, device }) => {
  await onboardToCapture({ app, screen });
  await screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first().tap();
  await screen.getByTestId('quick-settings.signin', { visible: true }).tap();
  await expect(screen.getByTestId('screen.account', { visible: true })).toBeVisible();
  const apple = screen.getByTestId('btn.auth.apple', { visible: true });
  await screen.scrollUntilVisible(apple);
  await expect(apple).toBeEnabled();
  const appleBox = await apple.boundingBox();
  const googleBox = await screen.getByTestId('btn.auth.google', { visible: true }).boundingBox();
  if (!appleBox || !googleBox) throw new Error('The sign-in buttons have no geometry.');
  expect(appleBox.height).toBeGreaterThanOrEqual(googleBox.height);
  await app.screenshot('release-account-apple-offered');
  await apple.tap();
  const failed = screen.getByText(/^(Couldn.t sign in|Connexion impossible|Sign in with Apple Unavailable|Connexion Apple indisponible)$/, { visible: true });
  const sheet = screen.getByText(/Apple Account|Apple ID|compte Apple|identifiant Apple/i, { visible: true });
  // Counts, not waitFor: neither outcome is required, and a timed-out wait stays a failed step.
  for (let wait = 0; wait < 20 && (await failed.count()) + (await sheet.count()) === 0; wait += 1) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  await app.screenshot('release-account-apple-requested');
  if (await failed.count()) await screen.getByRole('button', /^OK$/i, { visible: true }).tap();
  else if (await sheet.count()) {
    const cancel = screen.getByRole('button', /^(Cancel|Annuler|Close|Fermer)$/i, { visible: true });
    if (await cancel.count()) await cancel.first().tap();
    else await device.alert('dismiss');
  }
  // The request is over (the button no longer spins) and nobody is signed in.
  await expect(apple).toBeEnabled();
  await expect(screen.getByTestId('screen.account', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('input.auth.email', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('text.auth.email')).toHaveCount(0);
  await expect(screen.getByTestId('btn.auth.signOut')).toHaveCount(0);
});
