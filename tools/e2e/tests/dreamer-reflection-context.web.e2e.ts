// Historical exact UI assertions executed under the guarded TesterArmy engine.
import path from 'node:path';
import type { Page } from 'playwright/test';
import { createParityTest, expect } from '../web-parity-fixtures';

const artwork = path.resolve(process.cwd(), '../../e2e/fixtures/home-dream.png');
const dreamTitle = 'L’éléphant au sommet de la grande roue';
const story = 'An elephant lands on top of a Ferris wheel among turquoise and coral clouds.';

async function prepareReflection(page: Page, media: 'loaded' | 'failed' | 'absent' = 'loaded') {
  await page.route('https://picsum.photos/**', route => media === 'failed' ? route.abort() : route.fulfill({ path: artwork }));
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') await page.getByTestId('btn.onboarding.feature.close').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.profile').click();
  await page.getByTestId('btn.mockProfile.plus').click();
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await page.getByTestId('btn.dream.primaryCta').click();
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  if (media !== 'absent') {
    await page.getByTestId('btn.journal.illustrate').click();
    if (media !== 'failed') await expect(page.getByTestId('btn.journal.illustration.expand')).toBeVisible();
    await expect(page.getByTestId('journal.detail.image.generation_dots')).toHaveCount(0);
    if (media === 'failed') {
      await page.getByTestId('component.metadataCard').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('journal.detail.image.unavailable')).toBeVisible();
    }
  }
  await page.getByTestId('btn.editMetadata').click();
  await page.getByTestId('input.dreamTitle').fill(dreamTitle);
  await page.getByTestId('btn.editMetadata').click();
  await page.getByTestId('component.transcriptCard').scrollIntoViewIfNeeded();
  await page.getByTestId('component.dreamDetail.actionCard').click();
  await expect(page.getByTestId('screen.dreamCategories')).toBeVisible();
}

async function appearance(page: Page, mode: 'dark' | 'light') {
  // Mock dreams are session-scoped: navigate through the UI without reloading.
  await page.goBack();
  await page.goBack();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.language').click();
  await page.getByTestId('quick-settings.language.fr').click();
  await page.getByTestId(`quick-settings.theme.${mode}`).click();
  await page.getByTestId('quick-settings.close').click();
  await page.getByTestId('btn.home.today.cta').click();
  await page.getByTestId('component.transcriptCard').scrollIntoViewIfNeeded();
  await page.getByTestId('component.dreamDetail.actionCard').click();
  await expect(page.getByTestId('screen.dreamCategories')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
}

const test = createParityTest({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

test('reflection preserves the artwork across themes and offers a recap after one successful angle', async ({ page }, info) => {
  await prepareReflection(page);
  const categories = page.getByTestId('screen.dreamCategories');
  const image = page.getByTestId('image.reflection.dream').locator('img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const originalSource = await image.getAttribute('src');
  await expect(page.getByTestId('text.reflection.exchangeSaved')).toHaveCount(0);
  await expect(page.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
  for (const mode of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: mode === 'dark' ? 'light' : 'dark' });
    await appearance(page, mode);
    await expect(image).toHaveAttribute('src', originalSource!);
    await expect(page.getByTestId('text.reflection.exchangeSaved')).toHaveCount(0);
    for (const angle of ['symbols', 'emotions', 'growth']) {
      await expect(page.getByTestId(`btn.dreamCategory.${angle}`)).toHaveCount(1);
    }
    await expect(page.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`reflection-before-${mode}.png`) });
  }
  await page.getByTestId('btn.dreamCategory.readAnalysis').click();
  await expect(page.getByTestId('analysis.reading.body')).toBeVisible();
  await page.getByTestId('analysis.reading.close').click();
  await page.getByTestId('btn.dreamCategory.symbols').click();
  await expect(page.getByTestId('btn.exploration360.synthesis').filter({ visible: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(categories).toBeVisible();
  await expect(page.getByTestId('text.reflection.exchangeSaved')).toBeVisible();
  await expect(page.getByTestId('btn.dreamCategory.symbols')).toContainText('Reprendre');
  await expect(page.getByTestId('btn.exploration360.synthesis')).toBeInViewport();
  await page.screenshot({ path: info.outputPath('reflection-light.png') });
  await page.getByTestId('btn.exploration360.synthesis').click();
  await expect(page.getByTestId('text.reflection.recapCurrent').filter({ visible: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(categories).toBeVisible();
  await expect(page.getByTestId('btn.reflection.readRecap')).toBeVisible();
  await expect(page.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
});

test('reflection stays usable with failed artwork on a narrow screen', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await prepareReflection(page, 'failed');
  await expect(page.getByTestId('image.reflection.dream')).toHaveCount(0);
  for (const angle of ['symbols', 'emotions', 'growth']) {
    await page.getByTestId(`btn.dreamCategory.${angle}`).scrollIntoViewIfNeeded();
    await expect(page.getByTestId(`btn.dreamCategory.${angle}`)).toBeInViewport();
  }
  await page.getByTestId('btn.dreamCategory.emotions').click();
  await expect(page.getByTestId('btn.exploration360.synthesis').filter({ visible: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByTestId('text.reflection.exchangeSaved')).toBeVisible();
  await page.getByTestId('btn.exploration360.synthesis').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('btn.exploration360.synthesis')).toBeInViewport();
  await page.screenshot({ path: info.outputPath('reflection-narrow.png') });
});

test('reflection without an illustration keeps reading and all angles available before the first exchange', async ({ page }, info) => {
  await prepareReflection(page, 'absent');
  await expect(page.getByTestId('image.reflection.dream')).toHaveCount(0);
  await expect(page.getByTestId('screen.dreamCategories').getByRole('heading', { name: dreamTitle, exact: true })).toBeVisible();
  await expect(page.getByTestId('text.reflection.exchangeSaved')).toHaveCount(0);
  await expect(page.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
  await page.getByTestId('btn.dreamCategory.readAnalysis').click();
  await expect(page.getByTestId('analysis.reading.body')).toBeVisible();
  await page.getByTestId('analysis.reading.close').click();
  for (const angle of ['symbols', 'emotions', 'growth']) {
    await expect(page.getByTestId(`btn.dreamCategory.${angle}`)).toBeEnabled();
  }
  await page.screenshot({ path: info.outputPath('reflection-without-artwork.png') });
});

// The completed-dream Home CTA opens Journal; its existing mobile FlashList
// CSSStyleDeclaration baseline is outside this surface. Capture the dark state
// independently instead of routing a completed dream through that broken list.
test('reflection shows the completed exchange and original artwork in explicit dark mode', async ({ page }, info) => {
  await prepareReflection(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await appearance(page, 'dark');
  await page.getByTestId('btn.dreamCategory.symbols').click();
  await expect(page.getByTestId('btn.exploration360.synthesis').filter({ visible: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(page.getByTestId('text.reflection.exchangeSaved')).toBeVisible();
  await expect(page.getByTestId('btn.dreamCategory.symbols')).toContainText('Reprendre');
  await expect(page.getByTestId('image.reflection.dream').locator('img')).toBeVisible();
  await expect(page.getByTestId('btn.exploration360.synthesis')).toBeInViewport();
  await page.screenshot({ path: info.outputPath('reflection-dark.png') });
});
