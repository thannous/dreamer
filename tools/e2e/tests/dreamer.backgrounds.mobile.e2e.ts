import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';
import { openApp } from '../test-support/open-app';
import { type NativeBackgroundFixtures, leaveGuidedStories, acceptAiConsent, declineVoicePack, acceptDreamerLink, openBackgroundRoute } from '../dreamer-native-fixtures';

async function prepareBackgrounds({ app, screen, platform }: NativeBackgroundFixtures, mode: 'light' | 'dark') {
  await openApp(app);
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
    // Enter through the visible app action: an external URL can engage the
    // first-capture onboarding intent, which this synthetic guest has not completed.
    const sleepEntry = fixtures.screen.getByTestId('btn.home.sleepSounds', { visible: true });
    await fixtures.screen.scrollUntilVisible(sleepEntry);
    await sleepEntry.tap();
    await expect(fixtures.screen.getByTestId('screen.sleepSounds', { visible: true })).toBeVisible();
    await fixtures.app.screenshot(`native-pilot-sleep-${mode}`);
    await fixtures.screen.getByTestId('sleep-sounds-back', { visible: true }).tap();
    await expect(fixtures.screen.getByTestId('screen.home', { visible: true })).toBeVisible();
    await fixtures.app.screenshot(`native-pilot-restored-bars-${mode}`);
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
