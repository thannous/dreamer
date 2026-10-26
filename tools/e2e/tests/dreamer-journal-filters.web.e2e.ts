// The journal's filters: Favorites and To deepen (read, not yet deepened) sit in the bar;
// the advanced sheet adds the analysis status (unanalyzed, analyzed, deepened) and the
// order. Each filter narrows the search, shows as a chip, and Clear brings every dream
// back. The mock journal holds eight dreams, newest first in this order.
import type { Locator, Page } from 'playwright/test';
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
// Tall enough for the desktop grid to draw all eight dreams.
const test = createParityTest({ viewport: { width: 1280, height: 1600 } });

const TITLES = [
  'The Infinite Library', // analyzed, favorite
  'Ocean of Stars', // analyzed and deepened, favorite
  'The Shadowy Pursuer', // its analysis failed
  'Garden in the Clouds', // analyzed
  'The Forgotten Classroom', // its analysis is still running
  'Meeting My Future Self', // analyzed, favorite
  'The Singing Forest', // analyzed
  'The Broken Mirror', // never analyzed
];

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

async function openJournal(page: Page) {
  await selectProfile(page, 'existing');
  await page.getByTestId('tab.journal').filter({ visible: true }).click();
  await expect(journal(page)).toHaveCount(1);
  await expect(card(page, 'The Infinite Library')).toBeVisible();
}

const journal = (page: Page) => page.getByTestId('screen.journal').filter({ visible: true });
const sheet = (page: Page) => page.getByTestId('modal.advancedFilters');
const card = (page: Page, title: string) => page.getByTestId(/^dream\.item\./).filter({ hasText: title, visible: true });

// The titles of the dreams on screen, in reading order (the desktop journal is a grid). One
// snapshot: each new result remounts the list, so a card read a moment later may be gone.
function shownTitles(page: Page) {
  return page.evaluate((titles) => Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="dream.item."]'))
    .map((item) => ({ box: item.getBoundingClientRect(), text: item.textContent ?? '' }))
    .filter(({ box }) => box.width > 0 && box.height > 0)
    .sort((a, b) => (Math.abs(a.box.y - b.box.y) > 24 ? a.box.y - b.box.y : a.box.x - b.box.x))
    .map(({ text }) => titles.find((title) => text.includes(title)) ?? text), TITLES);
}

// A filter is a toggle: a screen reader hears whether it is on.
const expectPressed = (control: Locator, on: boolean) => expect(control).toHaveAttribute('aria-pressed', String(on));

async function expectShown(page: Page, titles: string[]) {
  await expect.poll(() => shownTitles(page)).toEqual(titles);
}

async function expectEveryDream(page: Page) {
  await expectShown(page, TITLES);
  await expect(journal(page).getByTestId('btn.clearFilters')).toHaveCount(0);
}

async function chooseInSheet(page: Page, choose: (filters: Locator) => Promise<unknown>) {
  await journal(page).getByTestId('btn.filterMore').click();
  await expect(sheet(page)).toBeVisible();
  await choose(sheet(page));
  await sheet(page).getByRole('button', { name: 'Done', exact: true }).click();
  await expect(sheet(page)).not.toBeVisible();
}

test('the bar keeps the favorite dreams or those left to deepen, and a second tap shows every dream again', async ({ page }) => {
  await openJournal(page);
  await expectEveryDream(page);
  const favorites = journal(page).getByTestId('btn.filterFavorites');
  await expectPressed(favorites, false);
  await favorites.click();
  await expectShown(page, ['The Infinite Library', 'Ocean of Stars', 'Meeting My Future Self']);
  await expectPressed(favorites, true);
  // Each card's heart says it is a favorite.
  const library = await card(page, 'The Infinite Library').getAttribute('data-testid');
  await expectPressed(journal(page).getByTestId(`journal.favorite.${library}`), true);

  // To deepen takes the place of Favorites: analyzed dreams without a reflection yet.
  const toDeepen = journal(page).getByTestId('btn.filterToDeepen');
  await toDeepen.click();
  await expectShown(page, ['The Infinite Library', 'Garden in the Clouds', 'Meeting My Future Self', 'The Singing Forest']);
  await expectPressed(toDeepen, true);
  await expectPressed(favorites, false);
  const garden = await card(page, 'Garden in the Clouds').getAttribute('data-testid');
  await expectPressed(journal(page).getByTestId(`journal.favorite.${garden}`), false);

  await toDeepen.click();
  await expectEveryDream(page);
  await expectPressed(toDeepen, false);
});

test('the analysis status keeps the dreams not yet read, those read, or those already deepened', async ({ page }) => {
  await openJournal(page);
  const more = journal(page).getByTestId('btn.filterMore');
  await expectPressed(more, false);
  await more.click();
  const filters = sheet(page);
  await expect(filters).toContainText('Advanced filters');
  await expectPressed(filters.getByTestId('btn.filterStatus.all'), true);

  // A failed or running analysis has not read the dream yet.
  await filters.getByTestId('btn.filterStatus.unanalyzed').click();
  await expectShown(page, ['The Shadowy Pursuer', 'The Forgotten Classroom', 'The Broken Mirror']);
  await expectPressed(filters.getByTestId('btn.filterStatus.unanalyzed'), true);
  await expectPressed(filters.getByTestId('btn.filterStatus.all'), false);

  await filters.getByTestId('btn.filterStatus.analyzed').click();
  await expectShown(page, ['The Infinite Library', 'Ocean of Stars', 'Garden in the Clouds', 'Meeting My Future Self', 'The Singing Forest']);

  await filters.getByTestId('btn.filterStatus.explored').click();
  await expectShown(page, ['Ocean of Stars']);
  await filters.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(filters).not.toBeVisible();
  // The button that opens the sheet shows an advanced filter is on.
  await expectPressed(more, true);

  // The status stays on as a chip in the bar; tapping it lets every dream back.
  const chip = journal(page).getByTestId('btn.filterExplored');
  await expect(chip).toContainText('Deepened');
  await expectPressed(chip, true);
  await chip.click();
  await expect(chip).toHaveCount(0);
  await expectEveryDream(page);
  await expectPressed(more, false);
});

test('the oldest dream comes first on request, within a status filter, until the order is cleared', async ({ page }) => {
  await openJournal(page);
  await chooseInSheet(page, async (filters) => {
    await filters.getByTestId('btn.filterStatus.unanalyzed').click();
    const order = filters.getByTestId('component.journal.sortOptions');
    await expectPressed(order.getByRole('button', { name: 'Newest first', exact: true }), true);
    await order.getByRole('button', { name: 'Oldest first', exact: true }).click();
    await expectPressed(order.getByRole('button', { name: 'Oldest first', exact: true }), true);
    await expectPressed(order.getByRole('button', { name: 'Newest first', exact: true }), false);
  });
  await expectShown(page, ['The Broken Mirror', 'The Forgotten Classroom', 'The Shadowy Pursuer']);
  const bar = journal(page).getByTestId('journal-filter-bar');
  await expect(bar.getByTestId('btn.filterAnalyzed')).toContainText('Unanalyzed');

  // The order's chip puts the newest first again and keeps the status.
  await bar.getByRole('button', { name: 'Oldest first', exact: true }).click();
  await expectShown(page, ['The Shadowy Pursuer', 'The Forgotten Classroom', 'The Broken Mirror']);
  await expect(bar.getByRole('button', { name: 'Oldest first', exact: true })).toHaveCount(0);

  await chooseInSheet(page, async (filters) => {
    await filters.getByTestId('component.journal.sortOptions').getByRole('button', { name: 'Oldest first', exact: true }).click();
  });
  await expectShown(page, ['The Broken Mirror', 'The Forgotten Classroom', 'The Shadowy Pursuer']);
  // The sheet's Clear removes the status and the order together.
  await journal(page).getByTestId('btn.filterMore').click();
  await sheet(page).getByTestId('btn.advancedFilters.clear').click();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).not.toBeVisible();
  await expect(bar.getByTestId('btn.filterAnalyzed')).toHaveCount(0);
  await expectEveryDream(page);
});

test('a filter narrows a search, and clearing an empty result brings back every dream', async ({ page }) => {
  await openJournal(page);
  const field = page.getByRole('textbox', { name: 'Search dreams…' });
  await field.fill('light');
  await expectShown(page, ['Ocean of Stars', 'The Shadowy Pursuer', 'Garden in the Clouds']);
  await expect(journal(page).getByTestId('btn.filterSearch')).toContainText('light');

  await journal(page).getByTestId('btn.filterToDeepen').click();
  await expectShown(page, ['Garden in the Clouds']);
  await journal(page).getByTestId('btn.filterToDeepen').click();
  await chooseInSheet(page, (filters) => filters.getByTestId('btn.filterStatus.explored').click());
  await expectShown(page, ['Ocean of Stars']);

  // Another search keeps the status: no deepened dream speaks of the dark.
  await field.fill('dark');
  await expect(page.getByTestId(/^dream\.item\./).filter({ visible: true })).toHaveCount(0);
  await expect(journal(page)).toContainText('No dreams match your filters');
  await journal(page).getByTestId('btn.empty.clearFilters').click();
  await expect(field).toHaveValue('');
  await expect(journal(page).getByTestId('btn.filterExplored')).toHaveCount(0);
  await expect(journal(page).getByTestId('btn.filterSearch')).toHaveCount(0);
  await expectEveryDream(page);

  // Clear in the bar ends a search and a filter at once.
  await field.fill('light');
  await journal(page).getByTestId('btn.filterFavorites').click();
  await expectShown(page, ['Ocean of Stars']);
  await journal(page).getByTestId('btn.clearFilters').click();
  await expect(field).toHaveValue('');
  await expectEveryDream(page);
});
