import { test, type Device } from '@e2e-dev/mobile';
import { expect, type TestFixtures } from 'e2e';
// The persistent mock profile seeds this entry. Explicit expectations keep
// Node collection independent of the app's React Native/media imports.
const SEEDED_OTHER_DREAM = {
  title: 'The Infinite Library',
  transcript: 'I found myself in an enormous library with endless shelves reaching up into darkness. Books were floating around me, their pages turning on their own. I picked up a golden book that seemed to glow, and when I opened it, I could see memories from my childhood playing out on the pages like a movie.',
};

type NativeBackgroundFixtures = TestFixtures & { device: Device };

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

async function prepareBackgrounds({ app, screen }: NativeBackgroundFixtures, mode: 'light' | 'dark') {
  await app.open();
  await acceptDreamerLink({ screen });
  // The guarded runner owns a disposable simulator and this synthetic profile.
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next', { visible: true }).tap();
  await screen.getByTestId('btn.onboarding.skip', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  const settings = screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first();
  await screen.scrollUntilVisible(settings, { direction: 'up' });
  await settings.tap();
  await screen.getByTestId('quick-settings.language', { visible: true }).tap();
  await screen.getByTestId('quick-settings.language.fr', { visible: true }).tap();
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
    await expect(screen.getByTestId('trends.week.count.value', { visible: true })).toBeVisible();
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
    const consent = screen.getByRole('button', 'Accepter et continuer', { visible: true });
    await consent.tap();
    await expect(consent).toHaveCount(0);
    // Native first-use consent precedes the composer. An initial conversation
    // has no synthesis yet; that action is outside this background inspection.
    await expect(screen.getByTestId('chat.input.message', { visible: true })).toBeEnabled();
    await expect(screen.getByTestId('quick-category-symbols', { visible: true })).toBeEnabled();
    await app.screenshot(`native-dialogue-${mode}`);
  });
}

for (const editor of ['metadata', 'transcript'] as const) {
  test(`Dreamer release background categorization preserves the ${editor} draft and isolates another entry`, {
    tags: ['journal-concurrency'],
    skip: process.env.E2E_NATIVE_MOCK_MODE !== 'true' || Number(process.env.E2E_NATIVE_MOCK_CATEGORIZATION_MS) < 20000
      ? 'Requires an identified persistent mock Release with the bounded categorization QA opt-in.' : false,
  }, async ({ app, screen, device, platform }) => {
    await app.open();
    await app.clearState();
    await screen.getByTestId('btn.onboarding.intro.next', { visible: true }).tap();
    await screen.getByTestId('btn.onboarding.skip', { visible: true }).tap();
    const settings = screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first();
    await screen.scrollUntilVisible(settings, { direction: 'up' });
    await settings.tap();
    const all = screen.getByTestId('quick-settings.all', { visible: true });
    await screen.scrollUntilVisible(all); await all.tap();
    const signin = screen.getByTestId('settings-account-open-signin', { visible: true });
    await screen.scrollUntilVisible(signin); await signin.tap();
    await screen.getByTestId('btn.mockProfile.existing', { visible: true }).tap();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
    const story = 'E2E sapphire lighthouse above the quiet ocean.';
    await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
    await device.dismissKeyboard();
    await screen.getByTestId('btn.saveDream', { visible: true }).tap();
    // The real loading indicator witnesses that the response is still pending.
    // No device clock/evaluation API, fixed sleep or injected UI control is used.
    const pending = screen.getByTestId('text.dreamMetadata.pending');
    await expect(pending).toBeVisible();
    await expect(pending).toHaveCount(1);
    const button = screen.getByTestId(editor === 'metadata' ? 'btn.editMetadata' : 'btn.editTranscript', { visible: true });
    await screen.scrollUntilVisible(button); await button.tap();
    const input = screen.getByTestId(editor === 'metadata' ? 'input.dreamTitle' : 'input.dreamTranscript');
    const draft = editor === 'metadata' ? 'E2E personal lighthouse title' : 'E2E revised story: the lighthouse has a blue door. I climb three quiet staircases, count the windows, and see a yellow boat passing the harbour. The lamp turns slowly above me while I write down every detail before waking.';
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
    await screen.scrollUntilVisible(button); await button.tap();
    await expect(input).toHaveCount(0);
    const back = screen.getByTestId('btn.navigateJournal', { visible: true });
    await screen.scrollUntilVisible(back, { direction: 'up' }); await back.tap();
    await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
    const search = screen.getByTestId('input.searchDreams', { visible: true });
    const title = editor === 'metadata' ? draft : 'E2E sapphire lighthouse above the quiet ocean';
    await search.fill(title);
    if (platform === 'ios') await search.press('Enter');
    else await device.dismissKeyboard();
    await expect(search).toHaveValue(title);
    await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
    const card = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: title });
    await expect(card).toHaveCount(1); await card.tap();
    if (editor === 'metadata') await expect(screen.getByText(draft, { visible: true })).toBeVisible();
    else {
      if (platform === 'ios') {
        // Scope the exact story to the single active detail, excluding AX echoes
        // outside that scene. The scoped result must contain exactly one text.
        const detail = screen.getByTestId('screen.dreamDetail', { visible: true });
        await expect(detail).toHaveCount(1);
        await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toHaveCount(1);
        await expect(detail.getByText(draft, { visible: true })).toHaveText([draft]);
      } else {
        const transcript = screen.getByText(draft, { visible: true });
        await screen.scrollUntilVisible(transcript); await expect(transcript).toHaveText(draft);
      }
    }
    await screen.scrollUntilVisible(button); await button.tap();
    if (platform === 'ios' && editor === 'transcript') {
      // Use the observed UIKit selection menu for the long multiline value.
      // The preserved fill failure retained a suffix of the previous value.
      await input.longPress();
      await input.tap();
      const selectAll = screen.getByText(/^(Select All|Tout sélectionner)$/, { visible: true });
      if (await selectAll.count() === 0) {
        // UIKit may paginate Select All when Paste occupies the first page.
        const nextPage = screen.getByRole('button', /^(Next page|Page suivante)$/, { visible: true });
        await expect(nextPage).toHaveCount(1);
        await nextPage.tap();
      }
      await expect(selectAll).toHaveCount(1);
      await selectAll.tap();
      const cut = screen.getByText(/^(Cut|Couper)$/, { visible: true });
      await expect(cut).toHaveCount(1);
      await cut.tap();
      await expect(input).toHaveValue('');
    }
    await input.fill('E2E abandoned local draft');
    if (platform === 'ios') await screen.getByTestId('btn.journal.dismissKeyboard', { visible: true }).tap();
    else await device.dismissKeyboard();
    await expect(input).toHaveValue('E2E abandoned local draft');
    await screen.scrollUntilVisible(back, { direction: 'up' }); await back.tap();
    await search.fill('The Infinite Library');
    if (platform === 'ios') await search.press('Enter');
    else await device.dismissKeyboard();
    await expect(search).toHaveValue('The Infinite Library');
    await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
    const other = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: 'The Infinite Library' });
    await expect(other).toHaveCount(1); await other.tap();
    await expect(input).toHaveCount(0);
    await screen.scrollUntilVisible(button); await button.tap();
    await expect(input).toHaveValue(editor === 'metadata' ? SEEDED_OTHER_DREAM.title : SEEDED_OTHER_DREAM.transcript);
    await app.screenshot(`release-${editor}-other-entry-isolated`);
  });
}

test('Dreamer release onboarding reaches capture and rejects an empty save', async ({ app, screen, device }) => {
  await app.open();
  await app.clearState();
  await expect(screen.getByTestId('screen.onboarding')).toBeVisible();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  await expect(screen.getByTestId('btn.saveDream')).toBeDisabled();
  await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
  const draft = 'Release fixture: a blue lighthouse above a quiet sea.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(draft);
  await device.dismissKeyboard();
  await screen.scrollUntilVisible(screen.getByTestId('btn.recording.inputMode.voice', { visible: true }), { direction: 'up' });
  await screen.getByTestId('btn.recording.inputMode.voice', { visible: true }).tap();
  await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
  await expect(screen.getByTestId('input.dreamTranscript', { visible: true })).toHaveValue(draft);
  await expect(screen.getByTestId('btn.saveDream')).toBeEnabled();
  await app.screenshot('release-capture');
});

test('Dreamer release Quick Settings persists French and theme choices while preserving a draft', async ({ app, screen, device, platform }) => {
  await app.open();
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await screen.getByTestId('btn.onboarding.skip').tap();
  await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
  const draft = 'Fixture de qualification : un phare bleu sur une mer calme.';
  const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
  await editor.fill(draft);
  await device.dismissKeyboard();
  // The real header precedes the extra navigation rail in mock Release builds.
  const settings = screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first();
  await screen.scrollUntilVisible(settings, { direction: 'up' });
  await settings.tap();
  await expect(screen.getByTestId('quick-settings.close', { visible: true })).toBeEnabled();
  await screen.getByTestId('quick-settings.language', { visible: true }).tap();
  const english = screen.getByTestId('quick-settings.language.en', { visible: true });
  await english.tap();
  // A fresh Android target can lack the English pack as well as the French one.
  if (platform === 'android' && await screen.getByText('Language Pack for Voice Recording', { visible: true }).count() > 0) {
    await screen.getByRole('button', 'Cancel', { visible: true }).tap();
  }
  await expect(screen.getByRole('radio', 'English', { visible: true })).toBeChecked();
  const french = screen.getByTestId('quick-settings.language.fr', { visible: true });
  await french.tap();
  // Android offers a speech pack independently of the saved UI language.
  if (platform === 'android') {
    await expect(screen.getByText('Pack de langue pour la reconnaissance vocale', { visible: true })).toBeVisible();
    await screen.getByRole('button', 'Annuler', { visible: true }).tap();
  }
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


test('Dreamer release opt-in feature story bridges capture to exploration', {
  skip: process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true'
    ? 'Requires an identified Release built with feature sheets enabled.' : false,
}, async ({ app, screen }) => {
  await app.open();
  await app.clearState();
  await screen.getByTestId('btn.onboarding.feature.capture', { visible: true }).tap();
  await screen.getByTestId('btn.onboarding.story.skip', { visible: true }).tap();
  await expect(screen.getByTestId('component.onboarding.story.capture.3', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.onboarding.globeCard.1', { visible: true }).tap();
  await expect(screen.getByTestId('component.onboarding.dreamEntry', { visible: true })).toBeVisible();
  await expect(screen.getByText(/^(Flying over the harbour|Voler au-dessus du port)$/, { visible: true })).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.continue', { visible: true }).tap();
  await expect(screen.getByText(/^(Once your dream is saved…|Une fois ton rêve enregistré…)$/, { visible: true })).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.next', { visible: true }).tap();
  await expect(screen.getByText(/^(you can find the details that return…|tu peux retrouver les détails qui reviennent…)$/, { visible: true })).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.next', { visible: true }).tap();
  await expect(screen.getByText(/^(and discover what connects your nights\.|et découvrir ce qui relie tes nuits\.)$/, { visible: true })).toBeVisible();
  await app.screenshot('release-story-capture-bridge');
  await screen.getByTestId('btn.onboarding.story.continue', { visible: true }).tap();
  await expect(screen.getByTestId('component.onboarding.story.connect.0', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.skip', { visible: true }).tap();
  await screen.getByTestId('btn.onboarding.story.continue', { visible: true }).tap();
  await expect(screen.getByTestId('component.onboarding.story.explore.0', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.skip', { visible: true }).tap();
  await screen.getByTestId('btn.onboarding.story.continue', { visible: true }).tap();
  await expect(screen.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
  await expect(screen.getByTestId('component.onboarding.intro', { visible: true })).toBeVisible();
  await app.screenshot('release-story-complete');
});

test('Dreamer release drawer Plus opens its offer and closes back to Capture', async ({ app, screen, platform }) => {
  await app.open();
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
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
