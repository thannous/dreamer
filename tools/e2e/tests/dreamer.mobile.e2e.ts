import { afterEach, test } from '@e2e-dev/mobile';
import { expect, type TestFixtures } from 'e2e';
import { tapWhenStill, waitUntilStill } from '../native-settle';
import { firstTextAndroid } from '../test-support/first-text-android';
import { openApp } from '../test-support/open-app';
import { type NativeBackgroundFixtures, FLEET_PHONE, PHONE_SETTINGS_SKIP, restore, billingTap, billingHome, billingSettings, submitIosSearch, billingGuest, leaveGuidedStories, acceptAiConsent, declineVoicePack, acceptDreamerLink, openBackgroundRoute, tapClearOfActionDock, dismissCaptureKeyboard, restoreDeviceSettings } from '../dreamer-native-fixtures';

afterEach(restoreDeviceSettings);

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

test('Dreamer release onboarding reaches capture and rejects an empty save', async ({ app, screen, device, platform }) => {
  await openApp(app);
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
  await openApp(app);
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
  await openApp(app);
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
  await openApp(app);
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
  await openApp(app);
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
  await openApp(app);
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
  await openApp(app);
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
  } else if (platform === 'ios' && process.env.E2E_NATIVE_MOCK_MODE !== 'true') {
    // A locally built iPhone Release has no store key either (e373cab6, iPhone 17 simulator): the
    // same sheet covers the offer. A Store build has the key, so the sheet is closed only if shown.
    // Either the offers load (their first card shows) or the sheet comes up: wait for one of the two.
    const monthly = screen.getByTestId('btn.paywall.selectMonthly', { visible: true });
    // iOS presents this sheet natively and drops its testID from the tree (0aae30b4, iPhone 17
    // simulator): only its title, its text and its OK button are exposed, so find it by its title.
    const unavailableTitle = screen.getByText(/^(Purchase not completed|Achat non finalisé)$/, { visible: true });
    // The cards may sit below the fold, so running out of time here is not a failure: the offer is checked next.
    for (const end = Date.now() + 30_000; Date.now() < end && await unavailableTitle.count() + await monthly.count() === 0;) await new Promise(resolve => setTimeout(resolve, 300));
    if (await unavailableTitle.count()) {
      await screen.getByRole('button', 'OK', { visible: true }).tap();
      await expect(unavailableTitle).toHaveCount(0);
    }
  }
  await expect(screen.getByTestId('screen.paywall', { visible: true })).toBeVisible();
  await app.screenshot('release-drawer-plus-destination');
  await screen.getByTestId('btn.paywall.close', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await app.screenshot('release-offer-return');
});

// The home screen widgets open Capture with the link they carry. It must land there from
// another screen, keeping the draft left in it, and from a closed app.
const CAPTURE_WIDGET_LINK = 'noctalia://recording';

async function onboardToCapture({ app, screen }: Pick<NativeBackgroundFixtures, 'app' | 'screen'>) {
  await openApp(app);
  await acceptDreamerLink({ screen });
  // The guarded runner owns a disposable simulator and this synthetic profile.
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next', { visible: true }).tap();
  await leaveGuidedStories(screen);
  await screen.getByTestId('btn.onboarding.skip', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
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

// Release journeys App Review goes through on a first session (2026-11-05). They run in the
// default campaign: release-simulators leaves out only the contextual-backgrounds captures.

/** The mock chat's replies (mock-data/generators.ts), English in every UI language. */
const MOCK_CHAT_REPLY = /^(That's an interesting question|Based on your dream,|Dreams like yours often|The elements you mentioned|I sense that this dream)/;

/** The dream page's header scrolls with it; its return tab stays inside the usable screen. */
async function releaseJournalFromDream(screen: TestFixtures['screen'], platform: TestFixtures['platform']) {
  const back = screen.getByTestId('btn.navigateJournal', { visible: true });
  await screen.scrollUntilVisible(back, { direction: 'up' });
  if (platform === 'ios') {
    // The first dream's illustration lands about half a minute after its reading, around the end
    // of the conversation. Its plate mounts above the reading and carries the header off the
    // screen: on 7b6237516 a tap sent 69 ms after the scroll opened the picture instead of going
    // back. The journey waits for the plate, then reaches Back again. Android never showed it.
    // Only the plate's picture carries this id; the page's illustration id is shared with the
    // painting wait and the failure card lower in the reading.
    await expect.poll(() => screen.getByTestId('btn.journal.illustration.expand', { visible: true }).count(),
      { timeout: 45_000, message: 'the first dream never received its illustration plate' }).toBeGreaterThan(0);
    await screen.scrollUntilVisible(back, { direction: 'up' });
  }
  const returnTab = screen.getByTestId('journal.detail.returnTab', { visible: true });
  if (await returnTab.count()) await returnTab.tap();
  else await tapWhenStill(back);
  await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
}

firstTextAndroid('Dreamer first French guest saves two paragraphs on one tap with the Android keyboard open', {
  platforms: ['android'], tags: ['native-first-text-capture'], timeout: 240_000,
  skip: process.env.E2E_FIRST_TEXT_ANDROID !== '1' || process.env.E2E_NATIVE_MOCK_MODE !== 'true' || FLEET_PHONE
    ? 'Requires a fresh owned French Android emulator with the persistent mock profile and software keyboard.' : false,
}, async ({ app, screen, keyboardShown }) => {
  await openApp(app);
  const first = 'Une porte bleue donnait sur le lac.';
  const second = 'J’avais la clé dans ma poche.';
  const story = [first, second].join('\n\n');
  const pass = screen.getByTestId('btn.onboarding.skip', { visible: true });
  await expect(screen.getByText('Passer', { visible: true, exact: true })).toBeVisible();
  await pass.tap();
  const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
  await expect(editor).toHaveValue('');
  await expect.poll(keyboardShown).toBe(false);
  await editor.tap();
  await expect.poll(keyboardShown).toBe(true);
  await editor.fill(story);
  await expect(editor).toHaveValue(story);
  await expect.poll(keyboardShown).toBe(true);
  const save = screen.getByTestId('btn.saveDream', { visible: true });
  await expect(save).toBeEnabled();
  await app.screenshot('french-first-text-ime-open');
  await save.tap();
  const detail = screen.getByTestId('screen.dreamDetail', { visible: true });
  await expect(detail).toBeVisible();
  const prose = screen.getByTestId('text.dreamDetail.transcript', { visible: true });
  // On a tall-text phone the saved page starts at the seal, above the story.
  await screen.scrollUntilVisible(prose, { direction: 'down' });
  // The raised initial can be a separate inline object in Android's accessible text.
  await expect(prose).toContainText(first.slice(1));
  await expect(prose).toContainText(second);
  await app.screenshot('french-first-text-readable');
  await app.restart();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await screen.getByTestId('tab.journal', { visible: true }).tap();
  const entries = screen.getByTestId(/^dream\.item\./, { visible: true });
  await expect(entries).toHaveCount(1);
  await entries.tap();
  await expect(detail).toBeVisible();
  const edit = screen.getByTestId('btn.editDream', { visible: true });
  await tapClearOfActionDock(screen, edit);
  const restored = screen.getByTestId('input.dreamTranscript', { visible: true });
  await screen.scrollUntilVisible(restored);
  await expect(restored).toHaveValue(story);
  await app.screenshot('french-first-text-exact-after-restart');

  // Android only presents this disclosure after an explicit withdrawal.
  await app.restart();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await billingSettings(screen);
  const toggle = screen.getByTestId('btn.settings.aiConsent', { visible: true });
  await screen.scrollUntilVisible(toggle);
  if (!(await toggle.isChecked())) await toggle.tap();
  await expect(toggle).toBeChecked();
  await toggle.tap();
  await expect(toggle).not.toBeChecked();
  await toggle.tap();
  const consent = screen.getByTestId('modal.aiConsent', { visible: true });
  await expect(consent).toBeVisible();
  const accept = screen.getByTestId('btn.aiConsent.accept', { visible: true });
  const decline = screen.getByTestId('btn.aiConsent.decline', { visible: true });
  await expect(accept).toBeVisible();
  await expect(decline).toBeVisible();
  await app.screenshot('french-android-consent-choices');
  await decline.tap();
  await expect(consent).toHaveCount(0);
  await expect(toggle).not.toBeChecked();
});

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
  // The full transcript follows the analysis and symbols in the journal detail.
  const transcript = screen.getByTestId('text.dreamDetail.transcript', { visible: true });
  await screen.scrollUntilVisible(transcript, { direction: 'down' });
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
  await releaseJournalFromDream(screen, platform);
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

test('Dreamer release every destination opens in system dark mode', {
  platforms: ['ios', 'android'], tags: ['native-release-tour'], timeout: 360_000,
  skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true' ? 'Requires the owned mock Release and its seeded test profile.'
    : FLEET_PHONE ? PHONE_SETTINGS_SKIP : false,
}, async (fixtures) => {
  const { app, screen, device, platform } = fixtures;
  // Each destination shows its own screen, never the error card a throwing screen leaves.
  const shown = async (id: string, label: string) => {
    await expect(screen.getByTestId(id, { visible: true })).toBeVisible();
    await expect(screen.getByTestId('screen.errorBoundary')).toHaveCount(0);
    await app.screenshot(`release-tour-${label}`);
  };
  // A native proof starts by opening the app (qualification.mjs); the reset below reopens it in dark.
  await openApp(app);
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
  // The guide's Back button sits under its artwork, not in a top bar where device.back looks on iOS.
  // Android does not nest that button under the screen's testID; its system Back is the reader's way out.
  if (platform === 'android') await device.back();
  else await screen.getByTestId('screen.dreamGuideDetail', { visible: true }).getByRole('button', 'Back', { visible: true }).tap();
  await expect(screen.getByTestId('screen.dreamGuides', { visible: true })).toBeVisible();
  for (const [route, id] of [['weekly-recap', 'screen.weeklyRecap'], ['moon-letter', 'screen.moonLetter']]) {
    await openBackgroundRoute(fixtures, route);
    if (route === 'moon-letter' && platform === 'ios') {
      // From the morning after a full moon the screen asks for the letter of the cycle under way,
      // which is written on request: an iPhone asks the AI consent first. Before that morning it
      // shows the previous letter, which is only read (lib/moonLetter.ts, moonLetterTarget).
      const consent = screen.getByTestId('modal.aiConsent', { visible: true });
      const letter = screen.getByTestId(id, { visible: true });
      const loading = screen.getByTestId('text.moonLetter.loading', { visible: true });
      // The screen mounts, loading, before it asks: it has settled once the consent is up or the loading line is gone.
      await expect.poll(async () => await consent.count() > 0 || (await letter.count() > 0 && await loading.count() === 0),
        { timeout: 30_000, message: 'the moon letter neither asked its AI consent nor finished loading' }).toBe(true);
      if (await consent.count()) await acceptAiConsent(screen, platform);
    }
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
