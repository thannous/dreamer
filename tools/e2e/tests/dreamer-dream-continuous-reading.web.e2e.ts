import { readDOM, byId, expectCSS, expectInViewport, addCSS, createExactWebTest, expect, expectIllustrationOnPlate, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.
import path from 'node:path';

const artwork = path.resolve(process.cwd(), '../../e2e/fixtures/home-dream.png');

async function enter(ui: ExactWebUI, profile: 'plus' | 'new') {
  const { app, screen: uiScreen, browser } = ui;
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
  await uiScreen.getByTestId(`btn.mockProfile.${profile}`).click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
}

const test = createExactWebTest({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

for (const mode of ['light', 'dark'] as const) {
  test(`dream opens with title and metadata before adaptive artwork and complete analysis in ${mode}`, async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
    await browser.route('https://picsum.photos/**', route => route.fulfill({ path: artwork }));
    await browser.emulateMedia({ colorScheme: mode === 'light' ? 'dark' : 'light' });
    await enter(ui, 'plus');
    await uiScreen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
    await uiScreen.getByTestId('btn.header.home.settings').click();
    await uiScreen.getByTestId(`quick-settings.theme.${mode}`).click();
    await uiScreen.getByTestId('quick-settings.language').click();
    await uiScreen.getByTestId('quick-settings.language.fr').click();
    await uiScreen.getByTestId('quick-settings.close').click();
    await uiScreen.getByTestId('tab.addDream', { visible: true }).click();
    await uiScreen.getByTestId('input.dreamTranscript').fill('J’étais sur une grande roue, bloqué en haut, quand un éléphant volant est venu se poser à côté de moi.\n\nPeur et incompréhension.');
    await uiScreen.getByTestId('btn.saveDream').click();
    await uiScreen.getByTestId('btn.dream.primaryCta').click();
    await expect(uiScreen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
    await uiScreen.getByTestId('btn.editDream').click();
    await uiScreen.getByTestId('input.dreamTitle').fill('L’éléphant au sommet de la grande roue');
    await uiScreen.getByTestId('btn.saveDreamEdit').click();
    await uiScreen.getByTestId('btn.journal.illustrate').click();
    await expect(uiScreen.getByTestId('journal.detail.image.generation_dots')).toHaveCount(0);
    // Painted in the seal's window, the illustration leaves it for the plate at the top of the page.
    await expectIllustrationOnPlate(uiScreen);
    await uiScreen.getByTestId('btn.journal.illustration.expand').scrollIntoView();
    const image = uiScreen.getByTestId('btn.journal.illustration.expand');
    // Expo retains the previous blob image during a crossfade. Check the painted mock
    // art (a bundled 9:16 .webp) rather than requiring the wrapper to contain one img.
    const renderedImage = browser.locator(byId('btn.journal.illustration.expand') + ' img[src*="webp"]').last();
    await expect(renderedImage).toBeVisible();
    await expect.poll(() => readDOM(browser, byId('btn.journal.illustration.expand') + ' img[src*="webp"]', el => (el as HTMLImageElement).naturalWidth, null, 'last')).toBeGreaterThan(0);
    await expect.poll(() => readDOM(browser, byId('btn.journal.illustration.expand') + ' img[src*="webp"]', el => getComputedStyle(el).opacity, null, 'last')).toBe('1');
    // Reopen from the list so this proves arrival, rather than a scrolled state
    // left over from editing or generating an illustration.
    await uiScreen.getByTestId('btn.navigateJournal').click();
    await uiScreen.getByRole('button', { name: /L’éléphant au sommet de la grande roue/ }).click();
    const heading = uiScreen.getByRole('heading', { name: 'L’éléphant au sommet de la grande roue', exact: true });
    const metadata = uiScreen.getByTestId('component.metadataCard');
    for (const viewport of [{ width: 393, height: 852 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await browser.setViewport(viewport);
      await expectInViewport(heading, browser, 1, true, byId('component.metadataCard') + ' [role="heading"]');
      await expectInViewport(metadata, browser, 1);
      // The date is engraved on the rim of the seal at the head of the reading (PR #358).
      await expect(uiScreen.getByTestId('component.savedDream.sealDate')).toContainText(/\d{4}/);
      // The plate fills the screen, the dream's name set at its foot (PR #358); it never runs past it.
      await expect.poll(async () => (await image.boundingBox())?.height ?? 0).toBeLessThanOrEqual(viewport.height);
      await app.screenshot(`dream-${mode}-arrival-${viewport.width}x${viewport.height}.png`);
    }
    await browser.setViewport({ width: 320, height: 568 });
    await addCSS(browser, '[data-testid="component.metadataCard"] [role="heading"] { font-size: 42px !important; line-height: 54px !important; }');
    await expectInViewport(heading, browser, 1, true, byId('component.metadataCard') + ' [role="heading"]');
    await expectInViewport(metadata, browser, 1);
    await app.screenshot(`dream-${mode}-arrival-large-title.png`);
    await browser.evaluate(() => { document.getElementById('e2e-layout-stress')?.remove(); return null; });
    await browser.setViewport({ width: 390, height: 844 });
    await expect(uiScreen.getByTestId('component.dreamDetail.actionCard')).toBeHidden();
    // The way back is the page's running head, a round arrow on its own opaque disc that
    // scrolls away with the page (PR #358): no bar ever lies over the reading text.
    // Disable browser scroll anchoring to exercise native-style rotation where
    // geometry changes without preserving the position of a reading paragraph.
    await addCSS(browser, '[data-testid="screen.dreamDetail"] * { overflow-anchor: none; }');
    // The story now follows the seal and the reading below the plate (PR #358); its action
    // comes into the dock once the reader has scrolled the story onto the screen.
    await image.hover();
    const story = (await uiScreen.getByTestId('component.transcriptCard').boundingBox())!;
    await browser.mouse.wheel(0, story.y - 200);
    await expectCSS(browser, byId('journal.detail.navigation'), 'background-color', 'rgba(0, 0, 0, 0)');
    await browser.setViewport({ width: 844, height: 390 });
    await expectInViewport(image, browser, 0, false);
    await expectInViewport(uiScreen.getByTestId('journal.detail.navigation'), browser, 0, false);
    await expect(uiScreen.getByTestId('component.dreamDetail.actionDock')).toBeVisible();
    await app.screenshot(`dream-${mode}-rotation-reading-header.png`);
    await browser.setViewport({ width: 390, height: 844 });
    await uiScreen.getByTestId('btn.navigateJournal').click();
    await uiScreen.getByRole('button', { name: /L’éléphant au sommet de la grande roue/ }).click();
    const originalSource = await renderedImage.getAttribute('src');
    await browser.emulateMedia({ colorScheme: mode });
    await expectCSS(browser, byId('screen.dreamDetail'), 'background-color', mode === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
    await expect(renderedImage).toHaveAttribute('src', originalSource!);
    await app.screenshot(`dream-${mode}-hero.png`);
    await uiScreen.getByTestId('component.transcriptCard').scrollIntoView();
    const action = uiScreen.getByTestId('component.dreamDetail.actionCard');
    await expectInViewport(action, browser);
    await expect(action).toContainText('Commencer');
    await app.screenshot(`dream-${mode}-story.png`);
    const analysis = uiScreen.getByTestId('component.dreamDetail.readingZone');
    await expect(analysis).toContainText('Une porte peut suggérer un passage ou une possibilité.');
    await expect(analysis).toContainText('Un lien possible avec un souvenir encore présent.');
    await expect(analysis).toContainText('Retrouves-tu une sensation de ce rêve dans ta journée ?');
    await expect(uiScreen.getByTestId('analysis.reading.modal')).toHaveCount(0);
    await expect(uiScreen.getByTestId('btn.editDream')).toBeEnabled();
    await expect(uiScreen.getByTestId('btn.editDream')).toContainText('Éditer');
    await analysis.scrollIntoView();
    await expectInViewport(uiScreen.getByTestId('journal.detail.navigation'), browser, 0, false);
    await expectInViewport(action, browser);
    await app.screenshot(`dream-${mode}-reading.png`);
    await action.click();
    await expect(uiScreen.getByTestId('btn.dreamCategory.symbols')).toBeVisible();
  });
}

test('a dream without an image analyzes inline and keeps editing and stale-analysis recovery', async (ui) => {
  const { app, screen: uiScreen } = ui;
  await enter(ui, 'new');
  const story = 'E2E continuous reading: a lighthouse above a quiet turquoise ocean.';
  await uiScreen.getByTestId('input.dreamTranscript').fill(story);
  await uiScreen.getByTestId('btn.saveDream').click();
  await expect(uiScreen.getByTestId('btn.journal.illustration.expand')).toHaveCount(0);
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  await uiScreen.getByTestId('btn.dream.primaryCta').click();
  await expect(uiScreen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await expect(uiScreen.getByTestId('analysis.reading.modal')).toHaveCount(0);
  await uiScreen.getByTestId('btn.editDream').click();
  await expect(uiScreen.getByTestId('component.dreamDetail.actionCard')).toBeHidden();
  await uiScreen.getByTestId('input.dreamTranscript').fill(story + ' I found a silver door.');
  await uiScreen.getByTestId('btn.saveDreamEdit').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText('silver door');
  await expect(uiScreen.getByTestId('component.dreamDetail.staleBanner')).toBeVisible();
  await expect(uiScreen.getByTestId('btn.dream.staleCta')).toBeEnabled();
  await app.screenshot('dream-stale-analysis.png');
});
