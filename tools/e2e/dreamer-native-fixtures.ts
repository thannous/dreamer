import { type Device } from '@e2e-dev/mobile';
import { expect, type TestFixtures } from 'e2e';
import { tapWhenStill } from './native-settle';
import { openApp } from './test-support/open-app';

export type NativeBackgroundFixtures = TestFixtures & { device: Device };

// A fleet phone is someone's device and its release only uninstalls apps: a journey that
// changes a device-wide setting (airplane mode, appearance, orientation) runs on emulators and
// simulators only, so a lost lease cannot leave the phone changed.
export const FLEET_PHONE = process.env.E2E_SIMLOCK_PHYSICAL_GRANT === '1';

export const PHONE_SETTINGS_SKIP = 'Changes a device-wide setting; not on a fleet phone.';

// A failed or timed-out journey must not hand the next one a rotated or offline device. A
// finally block cannot promise that: a timed-out body's device calls are cancelled, while
// afterEach runs with its own budget. A journey sets its flag before it changes the state.
export const restore = { portrait: false, airplane: false, appearance: false };
export async function restoreDeviceSettings({ device }: { device: Device }) {
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
}

export async function billingTap(screen: TestFixtures['screen'], id: string, direction: 'up' | 'down' = 'down') {
  const target = screen.getByTestId(id, { visible: true });
  await screen.scrollUntilVisible(target, { direction });
  // The page can still glide when the target comes into view.
  await tapWhenStill(target);
}

export async function billingHome(screen: TestFixtures['screen']) {
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

export async function billingSettings(screen: TestFixtures['screen']) {
  await billingHome(screen);
  await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
  await billingTap(screen, 'quick-settings.all');
  await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
}

export type Control = ReturnType<TestFixtures['screen']['getByTestId']>;

/**
 * The keyboard's own Search key submits; a synthesized Enter can leave the driver waiting.
 * Once the simulator has seen a hardware key, iOS shows only its minimized bar, which has no
 * Search key and covers no result: the list already filters as the words are typed.
 */
export async function submitIosSearch(screen: TestFixtures['screen']) {
  const key = screen.getByTestId('Search', { visible: true });
  if (await key.count()) await key.tap();
}

/**
 * On iOS a synthesized scroll up in Settings can move nothing at all: just after the AI sheet
 * fades, and from the end of the page. A drag that starts just under the header, as a finger
 * does, moves the list every time. Android scrolls as asked.
 */
export async function settingsScrollUp({ screen, platform }: Pick<NativeBackgroundFixtures, 'screen' | 'platform'>, target: Control) {
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

export async function billingGuest({ app, screen, platform }: NativeBackgroundFixtures) {
  await openApp(app);
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

export async function leaveGuidedStories(screen: TestFixtures['screen']) {
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true') return;
  await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap();
  await screen.getByRole('button', /^(Quitter|Leave|Sair|Salir|Esci|Verlassen)$/i, { visible: true }).tap();
}

/**
 * Dreamer's root layout mounts the Noctalia consent host, so this is `modal.aiConsent`, not `Alert.alert`.
 * Android asks nothing since 2026-10-29: the AI action itself records the grant.
 */
export async function acceptAiConsent(screen: TestFixtures['screen'], platform: TestFixtures['platform']) {
  if (platform === 'android') {
    await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toHaveCount(0);
    return;
  }
  await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toBeVisible();
  // The card slides in: a tap while it moves is lost (2026-11-05, iOS core loop).
  await tapWhenStill(screen.getByTestId('btn.aiConsent.accept', { visible: true }));
  await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toHaveCount(0);
}

/**
 * A fresh Android target offers the voice pack of a newly chosen language. The sheet opens
 * just after the tap, so it is awaited briefly rather than counted at once; iOS never shows it.
 * Counts, not waitFor: a waitFor that times out stays a failed step, which disqualifies the run.
 */
export async function declineVoicePack(screen: TestFixtures['screen'], platform: TestFixtures['platform']) {
  if (platform !== 'android') return;
  const cancel = screen.getByTestId('btn.offline-model.cancel', { visible: true });
  for (let wait = 0; wait < 10 && await cancel.count() === 0; wait += 1) await new Promise(resolve => setTimeout(resolve, 300));
  if (await cancel.count() === 0) return;
  await cancel.tap();
  await expect(cancel).toHaveCount(0);
}

export async function acceptDreamerLink({ screen }: Pick<TestFixtures, 'screen'>) {
  // iOS asks before handing a custom URL back from Safari to the installed app.
  const prompt = screen.getByText(/^(Ouvrir dans|Open in).*Noctalia/, { visible: true });
  if (await prompt.count() > 0) {
    await screen.getByRole('button', /^(Ouvrir|Open)$/, { visible: true }).tap();
  }
}

export async function openBackgroundRoute(fixtures: NativeBackgroundFixtures, route: string) {
  await fixtures.device.openLink(`noctalia:///${route}`);
  await acceptDreamerLink(fixtures);
}

/**
 * Native visibility does not prove the dream page's fixed action dock leaves a control
 * uncovered: XCTest and UIAutomator both call a covered control visible, and a tap there
 * lands on the dock. When the dock overlaps it, drag the reading up by the overlap, then tap.
 */
export async function tapClearOfActionDock(screen: TestFixtures['screen'], control: ReturnType<TestFixtures['screen']['getByTestId']>) {
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

// The iOS keyboard has no key that hides it, so a person taps Capture's title instead.
export async function dismissCaptureKeyboard({ screen, device, platform }: Pick<NativeBackgroundFixtures, 'screen' | 'device' | 'platform'>) {
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
