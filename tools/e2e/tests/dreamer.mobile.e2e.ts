import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';
import { PREDEFINED_DREAMS } from '../../../mock-data/predefinedDreams';

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
    await expect(input).toHaveValue(editor === 'metadata' ? PREDEFINED_DREAMS[0].title : PREDEFINED_DREAMS[0].transcript);
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

test('Dreamer release drawer sign-in opens its account destination', async ({ app, screen }) => {
  await app.open();
  await app.clearState();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await screen.getByTestId('btn.onboarding.skip').tap();
  await screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).first().tap();
  await screen.getByTestId('quick-settings.signin', { visible: true }).tap();
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
