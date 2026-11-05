// The journal's filters: Favorites and To deepen (read, not yet deepened) sit in the bar;
// the advanced sheet adds the analysis status (unanalyzed, analyzed, deepened) and the
// order. Each filter narrows the search, shows as a chip, and Clear brings every dream
// back. The mock journal holds eight dreams, newest first in this order.
import type { Browser } from '@e2e-dev/web';
import type { Locator, Screen } from 'e2e';
import { expect } from 'e2e';
import { journeyTest } from '../traced-parity-test';
import { dreamCards, searchField, selectProfile } from '../web-journeys';
// Tall enough for the desktop grid to draw all eight dreams.
const test = journeyTest({ viewport: { width: 1280, height: 1600 }, tags: ['zone-journal'] });

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

async function openJournal(screen: Screen, browser: Browser) {
  await selectProfile(screen, browser, 'existing');
  await screen.getByTestId('tab.journal', { visible: true }).tap();
  await expect(journal(screen)).toHaveCount(1);
  await expect(card(screen, 'The Infinite Library')).toBeVisible();
}

const journal = (screen: Screen) => screen.getByTestId('screen.journal', { visible: true });
const sheet = (screen: Screen) => screen.getByTestId('modal.advancedFilters');
const card = (screen: Screen, title: string) => dreamCards(screen).filter({ hasText: title });

// The titles of the dreams on screen, in reading order (the desktop journal is a grid). One
// snapshot: each new result remounts the list, so a card read a moment later may be gone.
function shownTitles(browser: Browser) {
  return browser.evaluate((titles) => Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="dream.item."]'))
    .map((item) => ({ box: item.getBoundingClientRect(), text: item.textContent ?? '' }))
    .filter(({ box }) => box.width > 0 && box.height > 0)
    .sort((a, b) => (Math.abs(a.box.y - b.box.y) > 24 ? a.box.y - b.box.y : a.box.x - b.box.x))
    .map(({ text }) => titles.find((title) => text.includes(title)) ?? text), TITLES);
}

// A filter is a toggle: a screen reader hears whether it is on.
const expectPressed = (control: Locator, on: boolean) => expect(control).toHaveAttribute('aria-pressed', String(on));

async function expectShown(browser: Browser, titles: string[]) {
  await expect.poll(() => shownTitles(browser)).toEqual(titles);
}

async function expectEveryDream(screen: Screen, browser: Browser) {
  await expectShown(browser, TITLES);
  await expect(journal(screen).getByTestId('btn.clearFilters')).toHaveCount(0);
}

async function chooseInSheet(screen: Screen, choose: (filters: Locator) => Promise<unknown>) {
  await journal(screen).getByTestId('btn.filterMore').tap();
  await expect(sheet(screen)).toBeVisible();
  await choose(sheet(screen));
  await sheet(screen).getByRole('button', 'Done').tap();
  await expect(sheet(screen)).toBeHidden();
}

test('the bar keeps the favorite dreams or those left to deepen, and a second tap shows every dream again', { tags: ['smoke'] }, async ({ screen, browser }) => {
  await openJournal(screen, browser);
  await expectEveryDream(screen, browser);
  const favorites = journal(screen).getByTestId('btn.filterFavorites');
  await expectPressed(favorites, false);
  await favorites.tap();
  await expectShown(browser, ['The Infinite Library', 'Ocean of Stars', 'Meeting My Future Self']);
  await expectPressed(favorites, true);
  // Each card's heart says it is a favorite.
  const library = await card(screen, 'The Infinite Library').getAttribute('data-testid');
  await expectPressed(journal(screen).getByTestId(`journal.favorite.${library}`), true);

  // To deepen takes the place of Favorites: analyzed dreams without a reflection yet.
  const toDeepen = journal(screen).getByTestId('btn.filterToDeepen');
  await toDeepen.tap();
  await expectShown(browser, ['The Infinite Library', 'Garden in the Clouds', 'Meeting My Future Self', 'The Singing Forest']);
  await expectPressed(toDeepen, true);
  await expectPressed(favorites, false);
  const garden = await card(screen, 'Garden in the Clouds').getAttribute('data-testid');
  await expectPressed(journal(screen).getByTestId(`journal.favorite.${garden}`), false);

  await toDeepen.tap();
  await expectEveryDream(screen, browser);
  await expectPressed(toDeepen, false);
});

test('the analysis status keeps the dreams not yet read, those read, or those already deepened', async ({ screen, browser }) => {
  await openJournal(screen, browser);
  const more = journal(screen).getByTestId('btn.filterMore');
  await expectPressed(more, false);
  await more.tap();
  const filters = sheet(screen);
  await expect(filters).toContainText('Advanced filters');
  await expectPressed(filters.getByTestId('btn.filterStatus.all'), true);

  // A failed or running analysis has not read the dream yet.
  await filters.getByTestId('btn.filterStatus.unanalyzed').tap();
  await expectShown(browser, ['The Shadowy Pursuer', 'The Forgotten Classroom', 'The Broken Mirror']);
  await expectPressed(filters.getByTestId('btn.filterStatus.unanalyzed'), true);
  await expectPressed(filters.getByTestId('btn.filterStatus.all'), false);

  await filters.getByTestId('btn.filterStatus.analyzed').tap();
  await expectShown(browser, ['The Infinite Library', 'Ocean of Stars', 'Garden in the Clouds', 'Meeting My Future Self', 'The Singing Forest']);

  await filters.getByTestId('btn.filterStatus.explored').tap();
  await expectShown(browser, ['Ocean of Stars']);
  await filters.getByRole('button', 'Done').tap();
  await expect(filters).toBeHidden();
  // The button that opens the sheet shows an advanced filter is on.
  await expectPressed(more, true);

  // The status stays on as a chip in the bar; tapping it lets every dream back.
  const chip = journal(screen).getByTestId('btn.filterExplored');
  await expect(chip).toContainText('Deepened');
  await expectPressed(chip, true);
  await chip.tap();
  await expect(chip).toHaveCount(0);
  await expectEveryDream(screen, browser);
  await expectPressed(more, false);
});

test('the oldest dream comes first on request, within a status filter, until the order is cleared', async ({ screen, browser }) => {
  await openJournal(screen, browser);
  await chooseInSheet(screen, async (filters) => {
    await filters.getByTestId('btn.filterStatus.unanalyzed').tap();
    const order = filters.getByTestId('component.journal.sortOptions');
    await expectPressed(order.getByRole('button', 'Newest first'), true);
    await order.getByRole('button', 'Oldest first').tap();
    await expectPressed(order.getByRole('button', 'Oldest first'), true);
    await expectPressed(order.getByRole('button', 'Newest first'), false);
  });
  await expectShown(browser, ['The Broken Mirror', 'The Forgotten Classroom', 'The Shadowy Pursuer']);
  const bar = journal(screen).getByTestId('journal-filter-bar');
  await expect(bar.getByTestId('btn.filterAnalyzed')).toContainText('Unanalyzed');

  // The order's chip puts the newest first again and keeps the status.
  await bar.getByRole('button', 'Oldest first').tap();
  await expectShown(browser, ['The Shadowy Pursuer', 'The Forgotten Classroom', 'The Broken Mirror']);
  await expect(bar.getByRole('button', 'Oldest first')).toHaveCount(0);

  await chooseInSheet(screen, async (filters) => {
    await filters.getByTestId('component.journal.sortOptions').getByRole('button', 'Oldest first').tap();
  });
  await expectShown(browser, ['The Broken Mirror', 'The Forgotten Classroom', 'The Shadowy Pursuer']);
  // The sheet's Clear removes the status and the order together.
  await journal(screen).getByTestId('btn.filterMore').tap();
  await sheet(screen).getByTestId('btn.advancedFilters.clear').tap();
  await browser.keyboard.press('Escape');
  await expect(sheet(screen)).toBeHidden();
  await expect(bar.getByTestId('btn.filterAnalyzed')).toHaveCount(0);
  await expectEveryDream(screen, browser);
});

test('a filter narrows a search, and clearing an empty result brings back every dream', async ({ screen, browser }) => {
  await openJournal(screen, browser);
  const field = searchField(screen);
  await field.fill('light');
  await expectShown(browser, ['Ocean of Stars', 'The Shadowy Pursuer', 'Garden in the Clouds']);
  await expect(journal(screen).getByTestId('btn.filterSearch')).toContainText('light');

  await journal(screen).getByTestId('btn.filterToDeepen').tap();
  await expectShown(browser, ['Garden in the Clouds']);
  await journal(screen).getByTestId('btn.filterToDeepen').tap();
  await chooseInSheet(screen, (filters) => filters.getByTestId('btn.filterStatus.explored').tap());
  await expectShown(browser, ['Ocean of Stars']);

  // Another search keeps the status: no deepened dream speaks of the dark.
  await field.fill('dark');
  await expect(dreamCards(screen)).toHaveCount(0);
  await expect(journal(screen)).toContainText('No dreams match your filters');
  await journal(screen).getByTestId('btn.empty.clearFilters').tap();
  await expect(field).toHaveValue('');
  await expect(journal(screen).getByTestId('btn.filterExplored')).toHaveCount(0);
  await expect(journal(screen).getByTestId('btn.filterSearch')).toHaveCount(0);
  await expectEveryDream(screen, browser);

  // Clear in the bar ends a search and a filter at once.
  await field.fill('light');
  await journal(screen).getByTestId('btn.filterFavorites').tap();
  await expectShown(browser, ['Ocean of Stars']);
  await journal(screen).getByTestId('btn.clearFilters').tap();
  await expect(field).toHaveValue('');
  await expectEveryDream(screen, browser);
});
