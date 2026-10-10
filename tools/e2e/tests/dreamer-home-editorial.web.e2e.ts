// Historical exact UI assertions executed under the guarded TesterArmy engine.
import path from 'node:path';
import type { Page } from 'playwright/test';
import { createParityTest, expect } from '../web-parity-fixtures';

const artwork = path.resolve(process.cwd(), '../../e2e/fixtures/home-dream.png');
const dreamTitle = 'L’éléphant au sommet de la grande roue';
const story = 'An elephant lands on top of a Ferris wheel among turquoise and coral clouds.';

async function startGuest(page: Page) {
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') await page.getByTestId('btn.onboarding.feature.close').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function home(page: Page) {
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await expect(page.getByTestId('btn.home.today.cta').filter({ visible: true })).toHaveCount(1);
}

async function populatedHome(page: Page, failImage = false) {
  await page.clock.setSystemTime(new Date('2026-10-02T12:00:00Z'));
  await page.route('https://picsum.photos/**', route => failImage ? route.abort() : route.fulfill({ path: artwork }));
  await startGuest(page);
  await home(page);
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.profile').click();
  await page.getByTestId('btn.mockProfile.plus').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await page.getByTestId('btn.dream.primaryCta').click();
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await page.getByTestId('btn.journal.illustrate').click();
  await expect(page.getByTestId('btn.journal.illustrate')).toHaveCount(0);
  if (!failImage) await expect(page.getByTestId('btn.journal.illustration.expand')).toBeVisible();
  await expect(page.getByTestId('journal.detail.image.generation_dots')).toHaveCount(0);
  if (failImage) {
    // Bring the lazy artwork into range before waiting for its failure state.
    await page.getByTestId('component.metadataCard').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('journal.detail.image.unavailable')).toBeVisible();
  }
  await page.getByTestId('btn.editMetadata').click();
  await page.getByTestId('input.dreamTitle').fill(dreamTitle);
  await page.getByTestId('btn.editMetadata').click();
  await page.goBack();
  await home(page);
}

async function theme(page: Page, value: 'dark' | 'light') {
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId(`quick-settings.theme.${value}`).click();
  await page.getByTestId('quick-settings.close').click();
  await expect(page.getByTestId('quick-settings.drawer')).not.toBeInViewport();
  await expect(page.getByTestId('screen.home')).toHaveCSS('background-color', value === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
}

const test = createParityTest({ viewport: { width: 390, height: 867 }, reducedMotion: 'reduce' });

test('home prioritizes the saved draft and keeps capture available without artwork', async ({ page }, info) => {
  await startGuest(page);
  await home(page);
  await expect(page.getByTestId('text.home.today.state')).toHaveText('empty');
  await page.getByTestId('btn.home.today.cta').click();
  const transcript = page.getByTestId('input.dreamTranscript');
  await transcript.fill('A lighthouse over a turquoise ocean.');
  await expect(page.getByText('Draft kept on this device', { exact: true })).toBeVisible();
  await home(page);
  await expect(page.getByTestId('text.home.today.state')).toHaveText('draft_resume');
  await page.screenshot({ path: info.outputPath('home-draft.png') });
  await page.getByTestId('btn.home.today.cta').click();
  await expect(transcript).toHaveValue('A lighthouse over a turquoise ocean.');
});

test('home keeps the dream image unchanged when explicit themes override the system and its actions work', async ({ page }, info) => {
  await populatedHome(page);
  await expect(page.getByTestId('text.home.today.state')).toHaveText('optional_deepen');
  await expect(page.getByTestId('text.home.today.title')).toHaveText(dreamTitle);
  const image = page.getByTestId('image.home.today').locator('img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const originalSource = await image.getAttribute('src');
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.language').click();
  await page.getByTestId('quick-settings.language.fr').click();
  await page.getByTestId('quick-settings.close').click();
  await expect(page.getByRole('heading', { name: 'Aujourd’hui', exact: true })).toBeVisible();
  await expect(page.getByTestId('quick-settings.drawer')).not.toBeInViewport();
  await expect(page.getByText('Rêve analysé · Touchez pour ouvrir', { exact: true })).toBeHidden();

  for (const value of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: value === 'dark' ? 'light' : 'dark' });
    await theme(page, value);
    await expect(page.getByTestId('screen.home')).toHaveCSS('background-color', value === 'dark' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)');
    await expect(image).toHaveAttribute('src', originalSource!);
    await expect(page.getByTestId('btn.home.today.cta')).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`home-${value}.png`) });
  }
  await page.getByTestId('btn.home.today.cta').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await page.goBack();
  await page.getByTestId('btn.inspiration.personalReadingRecap').click();
  await expect(page.getByTestId('screen.weeklyRecap')).toBeVisible();
  await page.goBack();
  // Reminder scheduling stays native-only; web does not advertise an unsupported CTA.
  await expect(page.getByTestId('btn.home.reminder')).toHaveCount(0);
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await expect(page.getByTestId('settings.back')).toBeVisible();
  await page.screenshot({ path: info.outputPath('home-settings.png') });
});

test('home recovers from a failed illustration and remains usable on a narrow screen', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await populatedHome(page, true);
  await theme(page, 'dark');
  await expect(page.getByTestId('text.home.today.title')).toHaveText(dreamTitle);
  await expect(page.getByTestId('image.home.today')).toHaveCount(0);
  await page.getByTestId('btn.home.today.cta').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('tab.addDream')).toBeInViewport();
  await page.screenshot({ path: info.outputPath('home-narrow.png') });
  await page.getByTestId('btn.home.today.cta').click();
  await expect(page.getByTestId('component.transcriptCard')).toBeVisible();
});
