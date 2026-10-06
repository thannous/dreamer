import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';

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
    await settings.tap();
    const choice = screen.getByTestId(`quick-settings.theme.${theme}`, { visible: true });
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
  await screen.getByTestId('quick-settings.plus', { visible: true }).tap();
  // The production emulator has no Store account; offering fetch errors surface a modal.
  const unavailable = screen.getByTestId('bottomSheet.paywall.error', { visible: true });
  if (platform === 'android') {
    await expect(unavailable).toBeVisible();
    await screen.getByRole('button', 'OK', { visible: true }).tap();
  }
  await expect(screen.getByTestId('screen.paywall', { visible: true })).toBeVisible();
  await app.screenshot('release-drawer-plus-destination');
  await screen.getByTestId('btn.paywall.close', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await app.screenshot('release-offer-return');
});
