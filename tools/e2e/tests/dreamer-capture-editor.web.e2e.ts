// Historical UI assertions, run on the public TesterArmy web surface.
import type { Page } from 'playwright/test';
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest();

const story = 'Je marchais au bord d’un lac. Une maison éclairée apparaissait entre les arbres.\n\nJe reconnaissais cet endroit, sans savoir pourquoi. Tout semblait calme, comme si le temps s’était arrêté.\n\nJe me souviens surtout de la lumière et de cette sensation de douceur.';

async function openSettings(page: Page) {
  await page.getByRole('button', { name: /^(Settings|Paramètres)$/ }).filter({ visible: true }).click();
}

async function startFrenchCapture(page: Page) {
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await openSettings(page);
  await page.getByTestId('quick-settings.language').click();
  await page.getByTestId('quick-settings.language.fr').click();
  await page.getByTestId('quick-settings.close').click();
  await expect(page.getByTestId('btn.recording.inputMode.text')).toContainText('Écrire');
}

async function theme(page: Page, value: 'light' | 'dark' | 'auto') {
  await openSettings(page);
  await page.getByTestId(`quick-settings.theme.${value}`).click();
  await page.getByTestId('quick-settings.close').click();
  await expect(page.getByTestId('quick-settings.drawer')).not.toBeInViewport();
}

test.use({ viewport: { width: 390, height: 844 }, contextOptions: { reducedMotion: 'reduce' } });

test('capture gives the story room, respects explicit and automatic themes, and saves the exact draft', async ({ page }, info) => {
  await startFrenchCapture(page);
  const editor = page.getByTestId('input.dreamTranscript');
  const save = page.getByTestId('btn.saveDream');
  const count = page.getByTestId('component.recording.draftProgress.count');
  await expect(save).toBeDisabled();
  await expect(page.getByText('Décris ton rêve', { exact: true })).toBeVisible();
  await expect(page.getByTestId('recording-guest-remaining')).toHaveCount(0);
  await editor.fill(story);
  await expect(page.getByText('Brouillon conservé sur cet appareil', { exact: true })).toBeVisible();
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
    await page.emulateMedia({ colorScheme: mode === 'light' ? 'dark' : 'light' });
    await theme(page, mode);
    await expect(editor).toHaveCSS('background-color', mode === 'light' ? 'rgb(245, 234, 219)' : 'rgb(20, 19, 26)');
    await expect(editor).toHaveCSS('color', mode === 'light' ? 'rgb(56, 45, 53)' : 'rgb(255, 249, 239)');
    await expect(editor).toHaveValue(story);
    await expect(save).toBeInViewport();
    await expect(page.getByTestId('tab.addDream').filter({ visible: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`capture-${mode}.png`) });
  }

  await theme(page, 'auto');
  for (const mode of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: mode });
    await expect(editor).toHaveCSS('background-color', mode === 'light' ? 'rgb(245, 234, 219)' : 'rgb(20, 19, 26)');
    await expect(editor).toHaveValue(story);
  }
  await save.click();
  for (const paragraph of story.split('\n\n')) {
    await expect(page.getByTestId('component.transcriptCard')).toContainText(paragraph);
  }
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toBeVisible();
  await expect(page.getByTestId('analysis.reading.modal')).toHaveCount(0);
  await page.getByTestId('btn.editTranscript').click();
  await expect(page.getByTestId('input.dreamTranscript')).toHaveValue(story);
  await page.getByTestId('btn.editTranscript').click();
  await page.screenshot({ path: info.outputPath('capture-saved.png') });
});

test('capture keeps long and fragmentary stories editable with a reachable save action in short windows', async ({ page }, info) => {
  await startFrenchCapture(page);
  const editor = page.getByTestId('input.dreamTranscript');
  const save = page.getByTestId('btn.saveDream');
  await editor.fill('Une lumière');
  await expect(save).toBeEnabled();
  await editor.fill(story.repeat(5));
  for (const viewport of [{ width: 320, height: 640 }, { width: 640, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect(editor).toHaveValue(story.repeat(5));
    await expect(async () => {
      await save.scrollIntoViewIfNeeded();
      await expect(save).toBeInViewport();
    }).toPass();
    const box = await save.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: info.outputPath(`capture-${viewport.width}x${viewport.height}.png`) });
  }
  await editor.fill('   ');
  await expect(save).toBeDisabled();
});
