// Historical exact UI assertions executed under the guarded TesterArmy engine.
import path from 'node:path';
import type { Page } from 'playwright/test';
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';

const artwork = path.resolve(process.cwd(), '../../e2e/fixtures/home-dream.png');

async function enter(page: Page, profile: 'plus' | 'new') {
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.profile').click();
  await page.getByTestId(`btn.mockProfile.${profile}`).click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

const test = createParityTest({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

for (const mode of ['light', 'dark'] as const) {
  test(`dream opens with title and metadata before adaptive artwork and complete analysis in ${mode}`, async ({ page }, info) => {
    await page.route('https://picsum.photos/**', route => route.fulfill({ path: artwork }));
    await page.emulateMedia({ colorScheme: mode === 'light' ? 'dark' : 'light' });
    await enter(page, 'plus');
    await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
    await page.getByTestId('btn.header.home.settings').click();
    await page.getByTestId(`quick-settings.theme.${mode}`).click();
    await page.getByTestId('quick-settings.language').click();
    await page.getByTestId('quick-settings.language.fr').click();
    await page.getByTestId('quick-settings.close').click();
    await page.getByTestId('tab.addDream').filter({ visible: true }).click();
    await page.getByTestId('input.dreamTranscript').fill('J’étais sur une grande roue, bloqué en haut, quand un éléphant volant est venu se poser à côté de moi.\n\nPeur et incompréhension.');
    await page.getByTestId('btn.saveDream').click();
    await page.getByTestId('btn.dream.primaryCta').click();
    await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
    await page.getByTestId('btn.editMetadata').click();
    await page.getByTestId('input.dreamTitle').fill('L’éléphant au sommet de la grande roue');
    await page.getByTestId('btn.editMetadata').click();
    await page.getByTestId('btn.journal.illustrate').click();
    await expect(page.getByTestId('journal.detail.image.generation_dots')).toHaveCount(0);
    await page.getByTestId('btn.journal.illustration.expand').scrollIntoViewIfNeeded();
    const image = page.getByTestId('btn.journal.illustration.expand');
    // Expo retains the previous blob image during a crossfade. Check the actual
    // fixture URI rather than requiring the image wrapper to contain one img.
    const renderedImage = image.locator('img[src^="https://picsum.photos/"]');
    await expect(renderedImage).toBeVisible();
    await expect.poll(() => renderedImage.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(renderedImage).toHaveCSS('opacity', '1');
    // Reopen from the list so this proves arrival, rather than a scrolled state
    // left over from editing or generating an illustration.
    await page.getByTestId('btn.navigateJournal').click();
    await page.getByRole('button', { name: /L’éléphant au sommet de la grande roue/ }).click();
    const heading = page.getByRole('heading', { name: 'L’éléphant au sommet de la grande roue', exact: true });
    const metadata = page.getByTestId('component.metadataCard');
    for (const viewport of [{ width: 393, height: 852 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await expect(heading).toBeInViewport({ ratio: 1 });
      await expect(metadata).toBeInViewport({ ratio: 1 });
      await expect(metadata).toContainText(/\d{4}/);
      await expect.poll(async () => (await image.boundingBox())?.height ?? 0).toBeLessThan(viewport.height);
      await page.screenshot({ path: info.outputPath(`dream-${mode}-arrival-${viewport.width}x${viewport.height}.png`) });
    }
    await page.setViewportSize({ width: 320, height: 568 });
    const enlargedText = await page.addStyleTag({ content: '[data-testid="component.metadataCard"] [role="heading"] { font-size: 42px !important; line-height: 54px !important; }' });
    await expect(heading).toBeInViewport({ ratio: 1 });
    await expect(metadata).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: info.outputPath(`dream-${mode}-arrival-large-title.png`) });
    await enlargedText.evaluate(node => node.parentNode?.removeChild(node));
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('component.dreamDetail.actionCard')).toBeHidden();
    // Chrome over artwork stays transparent; reading text gets an opaque
    // navigation background so its letters cannot show through the back control.
    // Disable browser scroll anchoring to exercise native-style rotation where
    // geometry changes without preserving the position of a reading paragraph.
    await page.addStyleTag({ content: '[data-testid="screen.dreamDetail"] * { overflow-anchor: none; }' });
    await image.hover();
    await page.mouse.wheel(0, 400);
    await expect(page.getByTestId('journal.detail.navigation')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(image).not.toBeInViewport();
    await expect(page.getByTestId('journal.detail.navigation')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
    await expect(page.getByTestId('component.dreamDetail.actionDock')).toBeVisible();
    await page.screenshot({ path: info.outputPath(`dream-${mode}-rotation-reading-header.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('btn.navigateJournal').click();
    await page.getByRole('button', { name: /L’éléphant au sommet de la grande roue/ }).click();
    const originalSource = await renderedImage.getAttribute('src');
    await page.emulateMedia({ colorScheme: mode });
    await expect(page.getByTestId('screen.dreamDetail')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
    await expect(renderedImage).toHaveAttribute('src', originalSource!);
    await page.screenshot({ path: info.outputPath(`dream-${mode}-hero.png`) });
    await page.getByTestId('component.transcriptCard').scrollIntoViewIfNeeded();
    const action = page.getByTestId('component.dreamDetail.actionCard');
    await expect(action).toBeInViewport();
    await expect(action).toContainText('Commencer');
    await page.screenshot({ path: info.outputPath(`dream-${mode}-story.png`) });
    const analysis = page.getByTestId('component.dreamDetail.readingZone');
    await expect(analysis).toContainText('Une porte peut suggérer un passage ou une possibilité.');
    await expect(analysis).toContainText('Un lien possible avec un souvenir encore présent.');
    await expect(analysis).toContainText('Retrouves-tu une sensation de ce rêve dans ta journée ?');
    await expect(page.getByTestId('analysis.reading.modal')).toHaveCount(0);
    await expect(page.getByTestId('btn.editTranscript')).toBeEnabled();
    await expect(page.getByTestId('btn.editTranscript')).toContainText('Modifier');
    await analysis.scrollIntoViewIfNeeded();
    await expect(page.getByTestId('journal.detail.navigation')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
    await expect(action).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`dream-${mode}-reading.png`) });
    await action.click();
    await expect(page.getByTestId('btn.dreamCategory.symbols')).toBeVisible();
  });
}

test('a dream without an image analyzes inline and keeps editing and stale-analysis recovery', async ({ page }, info) => {
  await enter(page, 'new');
  const story = 'E2E continuous reading: a lighthouse above a quiet turquoise ocean.';
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  await expect(page.getByTestId('btn.journal.illustration.expand')).toHaveCount(0);
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await page.getByTestId('btn.dream.primaryCta').click();
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await expect(page.getByTestId('analysis.reading.modal')).toHaveCount(0);
  await page.getByTestId('btn.editTranscript').click();
  await expect(page.getByTestId('component.dreamDetail.actionCard')).toBeHidden();
  await page.getByTestId('input.dreamTranscript').fill(story + ' I found a silver door.');
  await page.getByTestId('btn.editTranscript').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText('silver door');
  await expect(page.getByTestId('component.dreamDetail.staleBanner')).toBeVisible();
  await expect(page.getByTestId('btn.dream.staleCta')).toBeEnabled();
  await page.screenshot({ path: info.outputPath('dream-stale-analysis.png') });
});
