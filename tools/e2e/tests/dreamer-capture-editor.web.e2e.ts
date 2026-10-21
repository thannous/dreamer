import { byId, expectCSS, expectInViewport, createExactWebTest, expect, expectCaptureDraftSaved, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.
const test = createExactWebTest({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

const story = 'Je marchais au bord d’un lac. Une maison éclairée apparaissait entre les arbres.\n\nJe reconnaissais cet endroit, sans savoir pourquoi. Tout semblait calme, comme si le temps s’était arrêté.\n\nJe me souviens surtout de la lumière et de cette sensation de douceur.';

async function openSettings(ui: ExactWebUI) {
  const { screen } = ui;
  await screen.getByRole('button', { name: /^(Settings|Paramètres)$/, visible: true }).click();
}

async function startFrenchCapture(ui: ExactWebUI) {
  const { app, screen, browser } = ui;
  await app.open('/');
  await screen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => screen.getByTestId('btn.onboarding.feature.close').click());
  }
  await screen.getByTestId('btn.onboarding.skip').click();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  await openSettings(ui);
  await screen.getByTestId('quick-settings.language').click();
  await screen.getByTestId('quick-settings.language.fr').click();
  await screen.getByTestId('quick-settings.close').click();
  await expect(screen.getByTestId('btn.recording.inputMode.text')).toContainText('Écrire');
}

async function theme(ui: ExactWebUI, value: 'light' | 'dark' | 'auto') {
  const { screen, browser } = ui;
  await openSettings(ui);
  await screen.getByTestId(`quick-settings.theme.${value}`).click();
  await screen.getByTestId('quick-settings.close').click();
  await expectInViewport(screen.getByTestId('quick-settings.drawer'), browser, 0, false);
}

test('capture gives the story room, respects explicit and automatic themes, and saves the exact draft', async (ui) => {
  const { app, screen, browser } = ui;
  await startFrenchCapture(ui);
  const editor = screen.getByTestId('input.dreamTranscript');
  const save = screen.getByTestId('btn.saveDream');
  const count = screen.getByTestId('component.recording.draftProgress.count');
  await expect(save).toBeDisabled();
  // The writing area is its own invitation: no heading above it, only its placeholder.
  await expect(screen.getByText('Décris ton rêve', { exact: true })).toHaveCount(0);
  await expect(editor).toHaveAttribute('placeholder', 'Parle-moi de ton rêve…');
  await expect(screen.getByTestId('recording-guest-remaining')).toHaveCount(0);
  await editor.fill(story);
  await expectCaptureDraftSaved(browser, story);
  await expect(count).toHaveText(`${story.length} caractères`);
  await expect(save).toBeEnabled();

  const editorBox = await editor.boundingBox();
  const countBox = await count.boundingBox();
  const saveBox = await save.boundingBox();
  expect(editorBox).not.toBeNull();
  expect(countBox).not.toBeNull();
  expect(saveBox).not.toBeNull();
  expect(editorBox!.height, 'The story has a substantial writing area').toBeGreaterThanOrEqual(260);
  expect(countBox!.y - (editorBox!.y + editorBox!.height), 'The counter stays attached to its editor').toBeLessThanOrEqual(20);
  expect(saveBox!.width, 'The main action spans the reading width').toBeGreaterThanOrEqual(340);

  for (const mode of ['light', 'dark'] as const) {
    await browser.emulateMedia({ colorScheme: mode === 'light' ? 'dark' : 'light' });
    await theme(ui, mode);
    // Capture cards now let the painting show through; opacity must follow the selected theme too.
    await expectCSS(browser, byId('input.dreamTranscript'), 'background-color', mode === 'light' ? 'rgba(245, 234, 219, 0.88)' : 'rgba(20, 19, 26, 0.84)');
    await expectCSS(browser, byId('input.dreamTranscript'), 'color', mode === 'light' ? 'rgb(56, 45, 53)' : 'rgb(255, 249, 239)');
    await expect(editor).toHaveValue(story);
    await expectInViewport(save, browser);
    await expectInViewport(screen.getByTestId('tab.addDream', { visible: true }), browser);
    await app.screenshot(`capture-${mode}.png`);
  }

  await theme(ui, 'auto');
  for (const mode of ['light', 'dark'] as const) {
    await browser.emulateMedia({ colorScheme: mode });
    await expectCSS(browser, byId('input.dreamTranscript'), 'background-color', mode === 'light' ? 'rgba(245, 234, 219, 0.88)' : 'rgba(20, 19, 26, 0.84)');
    await expect(editor).toHaveValue(story);
  }
  await save.click();
  for (const paragraph of story.split('\n\n')) {
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(paragraph);
  }
  await expect(screen.getByTestId('component.dreamDetail.readingZone')).toBeVisible();
  await expect(screen.getByTestId('analysis.reading.modal')).toHaveCount(0);
  await screen.getByTestId('btn.editDream').click();
  await expect(screen.getByTestId('input.dreamTranscript')).toHaveValue(story);
  await screen.getByTestId('btn.saveDreamEdit').click();
  await app.screenshot('capture-saved.png');
});

test('capture keeps long and fragmentary stories editable with a reachable save action in short windows', async (ui) => {
  const { app, screen, browser } = ui;
  await startFrenchCapture(ui);
  const editor = screen.getByTestId('input.dreamTranscript');
  const save = screen.getByTestId('btn.saveDream');
  await editor.fill('Une lumière');
  await expect(save).toBeEnabled();
  await editor.fill(story.repeat(5));
  for (const viewport of [{ width: 320, height: 640 }, { width: 640, height: 390 }]) {
    await browser.setViewport(viewport);
    await expect(editor).toHaveValue(story.repeat(5));
    await expect.poll(async () => {
      await save.scrollIntoView();
      const box = await save.boundingBox();
      return Boolean(box && box.y >= 0 && box.y + box.height <= viewport.height);
    }, { timeout: 15_000 }).toBe(true);
    const box = await save.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    await app.screenshot(`capture-${viewport.width}x${viewport.height}.png`);
  }
  await editor.fill('   ');
  await expect(save).toBeDisabled();
});
