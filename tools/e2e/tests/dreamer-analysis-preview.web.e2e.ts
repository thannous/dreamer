// Past its monthly analyses, a free account still gets one preview a week of a dream's
// prepared analysis: its title, first sentence, symbols and a band of its illustration.
// The prepared analysis then opens with Plus. The mock prepares a fixed preview.
import type { Page } from 'playwright/test';
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest();

const INVITE = 'Your included analyses for this month are used. This week, Noctalia still gives you a preview';
const OPENING = 'In this dream the river of glass is no obstacle: it carries you towards a house you already know.';
// The mock journal's two unread dreams: the first has no analysis, the second's did not finish.
const STORIES = {
  'The Broken Mirror': 'I was looking at myself in a mirror',
  'The Shadowy Pursuer': 'I was running through dark corridors',
};

async function selectProfile(page: Page, profile: 'new' | 'existing' | 'plus') {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId(`btn.mockProfile.${profile}`).click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function openDream(page: Page, title: keyof typeof STORIES) {
  // A dream page opens over the journal: its tab stays on that page, the way back leaves it.
  const back = page.getByTestId('btn.navigateJournal').filter({ visible: true });
  if (await back.isVisible()) await back.click();
  else await page.getByTestId('tab.journal').filter({ visible: true }).click();
  await expect(page.getByTestId('screen.journal').filter({ visible: true })).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Search dreams…' }).fill(title);
  await page.getByTestId(/^dream\.item\./).filter({ hasText: title, visible: true }).click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(STORIES[title]);
}

const preview = (page: Page) => page.getByTestId('screen.dreamDetail').getByTestId('component.analysisPreview');

async function expectOffer(page: Page, cta: string) {
  const offer = page.getByTestId('screen.paywall');
  await expect(offer).toBeVisible();
  await expect(page.getByTestId('btn.paywall.purchase')).toHaveText(cta);
  await page.getByTestId('btn.paywall.close').click();
  await expect(offer).toBeHidden();
}

test('a free account past its analyses previews one dream, then opens its prepared analysis with Plus', async ({ page }) => {
  await selectProfile(page, 'existing');
  await openDream(page, 'The Broken Mirror');
  const card = preview(page);
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText(INVITE);
  await expect(card.getByTestId('btn.analysisPreview.prepare')).toHaveText('See this dream’s preview');

  // Plus right away: the offer analyzes the dream, nothing is prepared.
  await card.getByTestId('btn.analysisPreview.plusNow').click();
  await expectOffer(page, 'Subscribe and analyze this dream');
  await expect(card.getByTestId('text.analysisPreview.opening')).toHaveCount(0);

  await card.getByTestId('btn.analysisPreview.prepare').click();
  await expect(card.getByTestId('text.analysisPreview.opening')).toHaveText(OPENING);
  await expect(card).toContainText('The river of glass');
  for (const symbol of ['River of glass', 'Childhood home', 'Light']) await expect(card.getByText(symbol, { exact: true })).toBeVisible();
  await expect(card).toContainText('Their meaning opens with the full analysis.');
  await expect(card).toContainText('Your full analysis is ready. All that’s left is to open it.');
  await expect(card).toContainText(/Or with your included analysis on [A-Z][a-z]+ \d{1,2}\./);
  // The band of the illustration arrives a few seconds after the reading.
  await expect(card.getByTestId('component.analysisPreview.band')).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText('A fragment of your illustration');

  await card.getByTestId('btn.analysisPreview.plus').click();
  const offer = page.getByTestId('screen.paywall');
  await expect(offer).toBeVisible();
  await expect(offer).toContainText('Your analysis is ready');
  await expect(offer).toContainText('Your analyzed dream');
  await expect(offer.getByTestId('text.paywall.dreamExcerpt')).toContainText(STORIES['The Broken Mirror']);
  await expectOffer(page, 'Subscribe and read the analysis');
  // Back on the dream, its preview is still read, not prepared again.
  await expect(preview(page).getByTestId('text.analysisPreview.opening')).toHaveText(OPENING);
  await expect(preview(page).getByTestId('btn.analysisPreview.prepare')).toHaveCount(0);
});

test('a prepared preview reads again when its dream reopens; an interrupted analysis keeps its retry', async ({ page }) => {
  await selectProfile(page, 'existing');
  await openDream(page, 'The Broken Mirror');
  await preview(page).scrollIntoViewIfNeeded();
  await preview(page).getByTestId('btn.analysisPreview.prepare').click();
  await expect(preview(page).getByTestId('text.analysisPreview.opening')).toHaveText(OPENING);

  // A dream whose analysis did not finish resumes it, refunded: no preview takes its place.
  await openDream(page, 'The Shadowy Pursuer');
  await expect(page.getByRole('button', { name: 'Retry analysis' }).filter({ visible: true })).toHaveCount(1);
  await expect(preview(page)).toHaveCount(0);

  await openDream(page, 'The Broken Mirror');
  const card = preview(page);
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByTestId('text.analysisPreview.opening')).toHaveText(OPENING);
  await expect(card.getByTestId('btn.analysisPreview.prepare')).toHaveCount(0);
  await expect(card.getByTestId('btn.analysisPreview.plus')).toBeVisible();
});

test('a Plus account reads no preview', async ({ page }) => {
  await selectProfile(page, 'plus');
  await openDream(page, 'The Broken Mirror');
  await expect(page.getByTestId('component.analysisPreview')).toHaveCount(0);
});
