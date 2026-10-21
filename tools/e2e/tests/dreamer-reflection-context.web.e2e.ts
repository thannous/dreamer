import { readDOM, byId, expectCSS, expectInViewport, createExactWebTest, expect, expectIllustrationOnPlate, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.
import path from 'node:path';

const artwork = path.resolve(process.cwd(), '../../e2e/fixtures/home-dream.png');
const dreamTitle = 'L’éléphant au sommet de la grande roue';
const story = 'An elephant lands on top of a Ferris wheel among turquoise and coral clouds.';

async function prepareReflection(ui: ExactWebUI, media: 'loaded' | 'failed' | 'absent' = 'loaded') {
  const { app, screen: uiScreen, browser } = ui;
  await browser.route('https://picsum.photos/**', route => media === 'failed' ? route.abort() : route.fulfill({ path: artwork }));
  // Generated mock illustrations are the bundled 9:16 dream art, not picsum.
  if (media === 'failed') await browser.route(/mock-data(?:%2F|\/)assets(?:%2F|\/)dreams(?:%2F|\/)/, route => route.abort());
  await app.open('/');
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  }
  await uiScreen.getByTestId('btn.onboarding.skip').click();
  await uiScreen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await uiScreen.getByTestId('btn.header.home.settings').click();
  await uiScreen.getByTestId('quick-settings.profile').click();
  await uiScreen.getByTestId('btn.mockProfile.plus').click();
  await uiScreen.getByTestId('input.dreamTranscript').fill(story);
  await uiScreen.getByTestId('btn.saveDream').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  await uiScreen.getByTestId('btn.dream.primaryCta').click();
  await expect(uiScreen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  if (media !== 'absent') {
    await uiScreen.getByTestId('btn.journal.illustrate').click();
    // Painted in the seal's window, the illustration leaves it for the plate at the top of the page.
    if (media !== 'failed') await expectIllustrationOnPlate(uiScreen);
    await expect(uiScreen.getByTestId('journal.detail.image.generation_dots')).toHaveCount(0);
    if (media === 'failed') {
      await uiScreen.getByTestId('component.metadataCard').scrollIntoView();
      await expect(uiScreen.getByTestId('journal.detail.image.unavailable')).toBeVisible();
    }
  }
  await uiScreen.getByTestId('btn.editDream').click();
  await uiScreen.getByTestId('input.dreamTitle').fill(dreamTitle);
  await uiScreen.getByTestId('btn.saveDreamEdit').click();
  await uiScreen.getByTestId('component.transcriptCard').scrollIntoView();
  await uiScreen.getByTestId('component.dreamDetail.actionCard').click();
  await expect(uiScreen.getByTestId('screen.dreamCategories')).toBeVisible();
}

async function appearance(ui: ExactWebUI, mode: 'dark' | 'light') {
  const { screen: uiScreen, browser } = ui;
  // Mock dreams are session-scoped: navigate through the UI without reloading.
  await browser.back();
  await browser.back();
  await uiScreen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await uiScreen.getByTestId('btn.header.home.settings').click();
  await uiScreen.getByTestId('quick-settings.language').click();
  await uiScreen.getByTestId('quick-settings.language.fr').click();
  await uiScreen.getByTestId(`quick-settings.theme.${mode}`).click();
  await uiScreen.getByTestId('quick-settings.close').click();
  await uiScreen.getByTestId('btn.home.today.cta').click();
  await uiScreen.getByTestId('component.transcriptCard').scrollIntoView();
  await uiScreen.getByTestId('component.dreamDetail.actionCard').click();
  await expectCSS(browser, byId('screen.dreamCategories'), 'background-color', mode === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
}

const test = createExactWebTest({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

test('reflection preserves the artwork across themes and offers a recap after one successful angle', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await prepareReflection(ui);
  const categories = uiScreen.getByTestId('screen.dreamCategories');
  const image = browser.locator(byId('image.reflection.dream') + ' img');
  await expect(image).toBeVisible();
  await expect.poll(() => readDOM(browser, byId('image.reflection.dream') + ' img', el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const originalSource = await image.getAttribute('src');
  await expect(uiScreen.getByTestId('text.reflection.exchangeSaved')).toHaveCount(0);
  await expect(uiScreen.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
  for (const mode of ['dark', 'light'] as const) {
    await browser.emulateMedia({ colorScheme: mode === 'dark' ? 'light' : 'dark' });
    await appearance(ui, mode);
    await expect(image).toHaveAttribute('src', originalSource!);
    await expect(uiScreen.getByTestId('text.reflection.exchangeSaved')).toHaveCount(0);
    for (const angle of ['symbols', 'emotions', 'growth']) {
      await expect(uiScreen.getByTestId(`btn.dreamCategory.${angle}`)).toHaveCount(1);
    }
    await expect(uiScreen.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
    await app.screenshot(`reflection-before-${mode}.png`);
  }
  await uiScreen.getByTestId('btn.dreamCategory.readAnalysis').click();
  await expect(uiScreen.getByTestId('analysis.reading.body')).toBeVisible();
  await uiScreen.getByTestId('analysis.reading.close').click();
  await uiScreen.getByTestId('btn.dreamCategory.symbols').click();
  await expect(uiScreen.getByTestId('btn.exploration360.synthesis', { visible: true })).toBeEnabled();
  await uiScreen.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(categories).toBeVisible();
  await expect(uiScreen.getByTestId('text.reflection.exchangeSaved')).toBeVisible();
  await expect(uiScreen.getByTestId('btn.dreamCategory.symbols')).toContainText('Reprendre');
  await expectInViewport(uiScreen.getByTestId('btn.exploration360.synthesis'), browser);
  await app.screenshot('reflection-light.png');
  await uiScreen.getByTestId('btn.exploration360.synthesis').click();
  await expect(uiScreen.getByTestId('text.reflection.recapCurrent', { visible: true })).toBeVisible();
  await uiScreen.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(categories).toBeVisible();
  await expect(uiScreen.getByTestId('btn.reflection.readRecap')).toBeVisible();
  await expect(uiScreen.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
});

test('reflection stays usable with failed artwork on a narrow screen', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await browser.setViewport({ width: 320, height: 640 });
  await prepareReflection(ui, 'failed');
  await expect(uiScreen.getByTestId('image.reflection.dream')).toHaveCount(0);
  for (const angle of ['symbols', 'emotions', 'growth']) {
    await uiScreen.getByTestId(`btn.dreamCategory.${angle}`).scrollIntoView();
    await expectInViewport(uiScreen.getByTestId(`btn.dreamCategory.${angle}`), browser);
  }
  await uiScreen.getByTestId('btn.dreamCategory.emotions').click();
  await expect(uiScreen.getByTestId('btn.exploration360.synthesis', { visible: true })).toBeEnabled();
  await uiScreen.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(uiScreen.getByTestId('text.reflection.exchangeSaved')).toBeVisible();
  await uiScreen.getByTestId('btn.exploration360.synthesis').scrollIntoView();
  await expectInViewport(uiScreen.getByTestId('btn.exploration360.synthesis'), browser);
  await app.screenshot('reflection-narrow.png');
});

test('reflection without an illustration keeps reading and all angles available before the first exchange', async (ui) => {
  const { app, screen: uiScreen } = ui;
  await prepareReflection(ui, 'absent');
  await expect(uiScreen.getByTestId('image.reflection.dream')).toHaveCount(0);
  await expect(uiScreen.getByTestId('screen.dreamCategories').getByRole('heading', { name: dreamTitle, exact: true })).toBeVisible();
  await expect(uiScreen.getByTestId('text.reflection.exchangeSaved')).toHaveCount(0);
  await expect(uiScreen.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
  await uiScreen.getByTestId('btn.dreamCategory.readAnalysis').click();
  await expect(uiScreen.getByTestId('analysis.reading.body')).toBeVisible();
  await uiScreen.getByTestId('analysis.reading.close').click();
  for (const angle of ['symbols', 'emotions', 'growth']) {
    await expect(uiScreen.getByTestId(`btn.dreamCategory.${angle}`)).toBeEnabled();
  }
  await app.screenshot('reflection-without-artwork.png');
});

// The completed-dream Home CTA opens Journal; its existing mobile FlashList
// CSSStyleDeclaration baseline is outside this surface. Capture the dark state
// independently instead of routing a completed dream through that broken list.
test('reflection shows the completed exchange and original artwork in explicit dark mode', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await prepareReflection(ui);
  await browser.emulateMedia({ colorScheme: 'light' });
  await appearance(ui, 'dark');
  await uiScreen.getByTestId('btn.dreamCategory.symbols').click();
  await expect(uiScreen.getByTestId('btn.exploration360.synthesis', { visible: true })).toBeEnabled();
  await uiScreen.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(uiScreen.getByTestId('text.reflection.exchangeSaved')).toBeVisible();
  await expect(uiScreen.getByTestId('btn.dreamCategory.symbols')).toContainText('Reprendre');
  await expect(browser.locator(byId('image.reflection.dream') + ' img')).toBeVisible();
  await expectInViewport(uiScreen.getByTestId('btn.exploration360.synthesis'), browser);
  await app.screenshot('reflection-dark.png');
});
