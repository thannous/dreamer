// The full moon letter: Today offers it the morning after a full moon and the two days after,
// to a signed-in account with at least three dreams in the cycle. Plus reads it whole, a free
// account its first sentence, a guest is asked for an account. The mock reads a fixed letter.
import type { Page } from 'playwright/test';
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest();

// The morning after the 26 October 2026 full moon, in Paris as in UTC. The mock journal
// spreads its dreams over the weeks before the clock, so the cycle holds them all.
const MORNING_AFTER = new Date('2026-10-27T09:00:00Z');
// A week later the letter is no longer offered on Today.
const WEEK_AFTER = new Date('2026-11-03T09:00:00Z');
const OPENING = 'This cycle, water came back in almost every dream, first as a threat, then as a way through.';
const BODY = 'At first the sea rose behind you and you looked for a door.';

async function start(page: Page, at: Date) {
  await page.clock.setSystemTime(at);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await home(page);
}

async function selectProfile(page: Page, profile: 'new' | 'existing' | 'plus', at: Date) {
  await start(page, at);
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId(`btn.mockProfile.${profile}`).click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await home(page);
}

async function home(page: Page) {
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await expect(page.getByTestId('screen.home')).toBeVisible();
}

// Home stays mounted behind other screens; read the row of the visible screen only.
const letterRow = (page: Page) => page.getByTestId('screen.home').getByTestId('btn.home.moonLetter');
// A letter opened from another keeps the first one mounted under it.
const letterScreen = (page: Page) => page.getByTestId('screen.moonLetter').filter({ visible: true });

async function openLetterFromToday(page: Page) {
  const row = letterRow(page);
  await row.scrollIntoViewIfNeeded();
  await expect(row).toContainText('Full moon letter');
  await expect(row).toContainText(/It reads back the \d+ dreams noted between the last two full moons\./);
  await row.click();
  await expect(letterScreen(page)).toHaveCount(1);
  await expect(letterScreen(page).getByTestId('text.moonLetter.opening')).toHaveText(OPENING);
}

test('a Plus account opens the whole full moon letter from Today, then an earlier letter, and returns', async ({ page }) => {
  await selectProfile(page, 'plus', MORNING_AFTER);
  await openLetterFromToday(page);
  const letter = letterScreen(page);
  await expect(letter).toContainText('Full moon of October 26');
  await expect(letter).toContainText(BODY);
  await expect(letter).toContainText('Written from 5 dreams noted between two full moons.');
  await expect(letter.getByTestId('btn.moonLetter.plus')).toHaveCount(0);
  await expect(letter).not.toContainText('The rest of this letter is written.');

  await expect(letter).toContainText('Earlier letters');
  const earlier = letter.getByTestId(/^btn\.moonLetter\.previous\./);
  await expect(earlier).toHaveCount(1);
  await earlier.click();
  const previous = letterScreen(page);
  await expect(previous).toHaveCount(1);
  await expect(previous).toContainText('Full moon of September 26');
  await expect(previous.getByTestId('text.moonLetter.opening')).toHaveText(OPENING);
  // An earlier letter is only read: it lists no letters before it.
  await expect(previous.getByTestId(/^btn\.moonLetter\.previous\./)).toHaveCount(0);

  await previous.getByTestId('btn.moonLetter.back').click();
  await expect(letterScreen(page)).toContainText('Full moon of October 26');
  await letterScreen(page).getByTestId('btn.moonLetter.back').click();
  await expect(letterScreen(page)).toHaveCount(0);
  await expect(page.getByTestId('screen.home')).toBeVisible();
});

test('a free account reads the first sentence of its letter and opens Plus for the rest', async ({ page }) => {
  await selectProfile(page, 'existing', MORNING_AFTER);
  await openLetterFromToday(page);
  const letter = letterScreen(page);
  await expect(letter).toContainText('The rest of this letter is written. It can be read with Noctalia Plus.');
  await expect(letter).not.toContainText(BODY);
  await letter.getByTestId('btn.moonLetter.plus').click();
  const offer = page.getByTestId('screen.paywall');
  await expect(offer).toBeVisible();
  await page.getByTestId('btn.paywall.close').click();
  await expect(offer).toBeHidden();
  await expect(letterScreen(page).getByTestId('text.moonLetter.opening')).toHaveText(OPENING);
});

test('a withdrawn AI permission holds the letter until it is given again', async ({ page }) => {
  await selectProfile(page, 'plus', MORNING_AFTER);
  await page.getByTestId('tab.settings').filter({ visible: true }).click();
  const row = page.getByTestId('settings-ai-consent');
  await row.scrollIntoViewIfNeeded();
  await expect(row).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('btn.settings.aiConsent').click();
  await expect(row).toHaveAttribute('aria-checked', 'false');

  await home(page);
  const consent = page.getByTestId('modal.aiConsent').filter({ visible: true });
  await letterRow(page).scrollIntoViewIfNeeded();
  await letterRow(page).click();
  await expect(consent).toBeVisible();
  await page.getByTestId('btn.aiConsent.decline').filter({ visible: true }).click();
  await expect(consent).toBeHidden();
  const letter = letterScreen(page);
  await expect(letter).toContainText('The letter reads your dreams with AI and waits for your permission to do so.');
  await expect(letter.getByTestId('text.moonLetter.opening')).toHaveCount(0);

  await letter.getByTestId('btn.moonLetter.retry').click();
  await expect(consent).toBeVisible();
  await page.getByTestId('btn.aiConsent.accept').filter({ visible: true }).click();
  await expect(consent).toBeHidden();
  await expect(letterScreen(page).getByTestId('text.moonLetter.opening')).toHaveText(OPENING);
  await expect(letterScreen(page)).toContainText(BODY);
});

test('a guest sees no letter on Today and its page asks for an account', async ({ page }) => {
  await start(page, MORNING_AFTER);
  await expect(page.getByTestId('screen.home').getByTestId('component.home.today')).toBeVisible();
  await expect(letterRow(page)).toHaveCount(0);
  // Browser history keeps the session; a page load would start a new app launch.
  await page.evaluate(() => {
    window.history.pushState({}, '', '/moon-letter');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
  await expect(letterScreen(page)).toContainText('Full moon letters are read with an account, which keeps your dreams from one cycle to the next.');
  await expect(letterScreen(page).getByTestId('text.moonLetter.opening')).toHaveCount(0);
});

test('Today offers no letter to an account without dreams this cycle', async ({ page }) => {
  await selectProfile(page, 'new', MORNING_AFTER);
  await expect(page.getByTestId('screen.home').getByTestId('component.home.today')).toBeVisible();
  await expect(letterRow(page)).toHaveCount(0);
});

test('Today no longer offers the letter a week after the full moon', async ({ page }) => {
  await selectProfile(page, 'plus', WEEK_AFTER);
  await expect(page.getByTestId('screen.home').getByTestId('component.home.today')).toBeVisible();
  await expect(letterRow(page)).toHaveCount(0);
});
