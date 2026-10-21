import { readDOM, byId, expectCSS, expectInViewport, setTestDate, createExactWebTest, expect, expectCaptureDraftSaved, expectIllustrationOnPlate, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.
import path from 'node:path';

const artwork = path.resolve(process.cwd(), '../../e2e/fixtures/home-dream.png');
const dreamTitle = 'L’éléphant au sommet de la grande roue';
const story = 'An elephant lands on top of a Ferris wheel among turquoise and coral clouds.';

async function startGuest(ui: ExactWebUI) {
  const { app, screen: uiScreen, browser } = ui;
  await app.open('/');
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  }
  await uiScreen.getByTestId('btn.onboarding.skip').click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
}

async function home(ui: ExactWebUI) {
  const { screen: uiScreen } = ui;
  await uiScreen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await expect(uiScreen.getByTestId('btn.home.today.cta', { visible: true })).toHaveCount(1);
}

async function populatedHome(ui: ExactWebUI, failImage = false) {
  const { screen: uiScreen, browser } = ui;
  await setTestDate(browser, '2026-10-02T12:00:00Z', 'elapsed');
  await browser.route('https://picsum.photos/**', route => failImage ? route.abort() : route.fulfill({ path: artwork }));
  // Generated mock illustrations are the bundled 9:16 dream art, not picsum.
  if (failImage) await browser.route(/mock-data(?:%2F|\/)assets(?:%2F|\/)dreams(?:%2F|\/)/, route => route.abort());
  await startGuest(ui);
  await home(ui);
  await uiScreen.getByTestId('btn.header.home.settings').click();
  await uiScreen.getByTestId('quick-settings.profile').click();
  await uiScreen.getByTestId('btn.mockProfile.plus').click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
  await uiScreen.getByTestId('input.dreamTranscript').fill(story);
  await uiScreen.getByTestId('btn.saveDream').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  await uiScreen.getByTestId('btn.dream.primaryCta').click();
  await expect(uiScreen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await uiScreen.getByTestId('btn.journal.illustrate').click();
  await expect(uiScreen.getByTestId('btn.journal.illustrate')).toHaveCount(0);
  // Painted in the seal's window, the illustration leaves it for the plate at the top of the page.
  if (!failImage) await expectIllustrationOnPlate(uiScreen);
  await expect(uiScreen.getByTestId('journal.detail.image.generation_dots')).toHaveCount(0);
  if (failImage) {
    // Bring the lazy artwork into range before waiting for its failure state.
    await uiScreen.getByTestId('component.metadataCard').scrollIntoView();
    await expect(uiScreen.getByTestId('journal.detail.image.unavailable')).toBeVisible();
  }
  await uiScreen.getByTestId('btn.editDream').click();
  await uiScreen.getByTestId('input.dreamTitle').fill(dreamTitle);
  await uiScreen.getByTestId('btn.saveDreamEdit').click();
  await browser.back();
  await home(ui);
}

async function theme(ui: ExactWebUI, value: 'dark' | 'light') {
  const { screen: uiScreen, browser } = ui;
  await uiScreen.getByTestId('btn.header.home.settings').click();
  await uiScreen.getByTestId(`quick-settings.theme.${value}`).click();
  await uiScreen.getByTestId('quick-settings.close').click();
  await expectInViewport(uiScreen.getByTestId('quick-settings.profile'), browser, 0, false);
  await expectCSS(browser, byId('screen.home'), 'background-color', value === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
}

const test = createExactWebTest({ viewport: { width: 390, height: 867 }, reducedMotion: 'reduce' });

test('home prioritizes the saved draft and keeps capture available without artwork', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await startGuest(ui);
  await home(ui);
  await expect(uiScreen.getByTestId('text.home.today.state')).toHaveText('empty');
  await uiScreen.getByTestId('btn.home.today.cta').click();
  const transcript = uiScreen.getByTestId('input.dreamTranscript');
  await transcript.fill('A lighthouse over a turquoise ocean.');
  await expectCaptureDraftSaved(browser, 'A lighthouse over a turquoise ocean.');
  await home(ui);
  await expect(uiScreen.getByTestId('text.home.today.state')).toHaveText('draft_resume');
  await app.screenshot('home-draft.png');
  await uiScreen.getByTestId('btn.home.today.cta').click();
  await expect(transcript).toHaveValue('A lighthouse over a turquoise ocean.');
});

test('home keeps the dream image unchanged when explicit themes override the system and its actions work', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await populatedHome(ui);
  await expect(uiScreen.getByTestId('text.home.today.state')).toHaveText('optional_deepen');
  await expect(uiScreen.getByTestId('text.home.today.title')).toHaveText(dreamTitle);
  const image = browser.locator(byId('image.home.today') + ' img');
  await expect(image).toBeVisible();
  await expect.poll(() => readDOM(browser, byId('image.home.today') + ' img', el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  // Like the paintings since the top veil left (#394), the dream's image reaches the top edge.
  expect((await image.boundingBox())!.y, 'The dream image starts at the top of the screen').toBeLessThanOrEqual(0);
  const originalSource = await image.getAttribute('src');
  await uiScreen.getByTestId('btn.header.home.settings').click();
  await uiScreen.getByTestId('quick-settings.language').click();
  await uiScreen.getByTestId('quick-settings.language.fr').click();
  await uiScreen.getByTestId('quick-settings.close').click();
  // The tab bar says Today; the page's headline is the dream, whose action now reads in French.
  await expect(uiScreen.getByTestId('btn.home.today.cta')).toContainText('Relire mon rêve');
  await expectInViewport(uiScreen.getByTestId('quick-settings.profile'), browser, 0, false);
  await expect(uiScreen.getByText('Rêve analysé · Touchez pour ouvrir', { exact: true })).toBeHidden();

  for (const value of ['dark', 'light'] as const) {
    await browser.emulateMedia({ colorScheme: value === 'dark' ? 'light' : 'dark' });
    await theme(ui, value);
    await expectCSS(browser, byId('screen.home'), 'background-color', value === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
    await expect(image).toHaveAttribute('src', originalSource!);
    await expectInViewport(uiScreen.getByTestId('btn.home.today.cta'), browser);
    await app.screenshot(`home-${value}.png`);
  }
  await uiScreen.getByTestId('btn.home.today.cta').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  await browser.back();
  // The week's last night is today's dream; the symbol of the day opens its dictionary page.
  await browser.locator('[data-testid^="btn.home.week.night."]').last().click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  await browser.back();
  await uiScreen.getByTestId('btn.home.week.recap').click();
  await expect(uiScreen.getByTestId('screen.weeklyRecap')).toBeVisible();
  await browser.back();
  await uiScreen.getByTestId('btn.home.resources.dailySymbol').click();
  await expect(uiScreen.getByTestId('screen.symbolDetail')).toBeVisible();
  await browser.back();
  // Reminder scheduling stays native-only; web does not advertise an unsupported CTA.
  await expect(uiScreen.getByTestId('btn.home.reminder')).toHaveCount(0);
  await uiScreen.getByTestId('btn.header.home.settings').click();
  await uiScreen.getByTestId('quick-settings.all').click();
  await expect(uiScreen.getByTestId('settings.back')).toBeVisible();
  await app.screenshot('home-settings.png');
});

test('home recovers from a failed illustration and remains usable on a narrow screen', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await browser.setViewport({ width: 320, height: 640 });
  await populatedHome(ui, true);
  await theme(ui, 'dark');
  await expect(uiScreen.getByTestId('text.home.today.title')).toHaveText(dreamTitle);
  await expect(uiScreen.getByTestId('image.home.today')).toHaveCount(0);
  await uiScreen.getByTestId('btn.home.today.cta').scrollIntoView();
  await expectInViewport(uiScreen.getByTestId('tab.addDream'), browser);
  await app.screenshot('home-narrow.png');
  await uiScreen.getByTestId('btn.home.today.cta').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toBeVisible();
});
