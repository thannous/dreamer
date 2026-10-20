import { test, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { App, Screen } from 'e2e';
import { isolateWeb } from '../web-fixtures';

// The reading's symbols are followed through the journal. The mock reading names the
// dictionary's Water and Doorway and one symbol of the dreamer's own, Light.

async function leaveGuidedStories(browser: Browser, screen: Screen) {
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true') return;
  const unsubscribe = await browser.onDialog('accept');
  try { await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap(); }
  finally { await unsubscribe(); }
}

async function startPlus(app: App, screen: Screen, browser: Browser) {
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await leaveGuidedStories(browser, screen);
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  const home = screen.getByTestId('tab.home', { visible: true });
  if (await home.isVisible()) await home.tap();
  else await screen.getByTestId('btn.recording.home', { visible: true }).tap();
  await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
  await screen.getByTestId('quick-settings.all', { visible: true }).tap();
  await screen.getByTestId('settings-account-open-signin', { visible: true }).tap();
  await screen.getByTestId('btn.mockProfile.plus', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
}

async function settledMotion(browser: Browser) {
  await expect.poll(() => browser.evaluate(() => document.getAnimations().filter(animation =>
    animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity).length)).toBe(0);
}

async function tellAndRead(screen: Screen, story: string) {
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  // The journal asks during the seal; yes opens the page already reading the dream.
  await screen.getByTestId('btn.dreamCaptureSeal.readNow', { visible: true }).tap();
  await expect(screen.getByTestId('component.dreamDetail.readingZone', { visible: true })).toContainText('Symbols');
  await expect(screen.getByTestId('component.dreamDetail.readingWait')).toHaveCount(0);
}

async function newDream(screen: Screen) {
  await screen.getByTestId('btn.navigateJournal', { visible: true }).tap();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
  await screen.getByTestId('tab.addDream', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
}

test('a personal symbol is born when first opened, then the reading and Tendances follow each symbol across dreams',
  async ({ app, screen, browser }) => {
    await isolateWeb(browser, app);
    await startPlus(app, screen, browser);
    const consent = await browser.onDialog('accept');
    const first = 'E2E symbols: a lamp glows beside still water near an old doorway.';
    await tellAndRead(screen, first);
    await consent();

    // A first reading: every symbol appears for the first time; the dreamer's own one is new.
    const water = screen.getByTestId('dream.symbol.d.water', { visible: true });
    const light = screen.getByTestId('dream.symbol.p.guiding-light', { visible: true });
    await light.scrollIntoView();
    await expect(water).toHaveAttribute('aria-label', 'Water, First appearance');
    await expect(light).toHaveAttribute('aria-label', 'Light, New, First appearance');
    await settledMotion(browser);
    await light.scrollIntoView();
    await app.screenshot('first-reading-symbols');

    // Opening it tells its birth and makes it the dreamer's.
    await light.tap();
    const sheet = screen.getByTestId('sheet.dreamSymbol', { visible: true });
    await expect(sheet).toContainText(/a symbol is born/i);
    await app.screenshot('personal-symbol-being-born');
    await expect(screen.getByTestId('text.dreamSymbol.born', { visible: true }))
      .toContainText('No dictionary knows it: it comes from this dream.');
    await expect(sheet).toContainText('Followed in your journal');
    await settledMotion(browser);
    await app.screenshot('personal-symbol-born');
    await screen.getByTestId('btn.dreamSymbol.close', { visible: true }).tap();
    await expect(screen.getByTestId('sheet.dreamSymbol')).toBeHidden();
    await expect(light).toHaveAttribute('aria-label', 'Light, First appearance');

    // A second dream: the same symbols come back, linked to the first. They are counted out
    // of every analyzed dream of the journal, as Tendances counts them (7 with the mock's own).
    await newDream(screen);
    await tellAndRead(screen, 'E2E symbols: the water returns by the café, and the same quiet light.');
    const returning = screen.getByTestId('dream.symbol.p.guiding-light', { visible: true });
    await returning.scrollIntoView();
    await expect(screen.getByTestId('dream.symbol.d.water', { visible: true }))
      .toHaveAttribute('aria-label', 'Water, In 2 of 7 dreams');
    await expect(returning).toHaveAttribute('aria-label', 'Light, In 2 of 7 dreams');
    await settledMotion(browser);
    await returning.scrollIntoView();
    await app.screenshot('second-reading-symbols');

    // The dreamer's own symbol, already theirs, opened from its star: its thread holds both dreams.
    const lightStar = screen.getByTestId('dream.constellation.p.guiding-light', { visible: true });
    await lightStar.scrollIntoView();
    await lightStar.tap();
    await expect(screen.getByTestId('text.dreamSymbol.title')).toContainText('Light');
    await expect(sheet).toContainText(/your symbol/i);
    await expect(sheet).not.toContainText(/a symbol is born/i);
    await expect(screen.getByTestId('text.dreamSymbol.status')).toContainText('In 2 of 7 dreams');
    await expect(sheet).toContainText('In your dreams');
    await expect(sheet).toContainText(/this dream/i);
    await expect(screen.getByTestId(/^dreamSymbol\.appearance\./, { visible: true })).toHaveCount(1);
    await settledMotion(browser);
    await app.screenshot('personal-symbol-thread');

    // Its companion from the dictionary opens in place, with the dictionary's landmarks.
    await screen.getByTestId('dreamSymbol.companion.d.water', { visible: true }).tap();
    await expect(screen.getByTestId('text.dreamSymbol.title')).toContainText('Water');
    await expect(sheet).toContainText(/dictionary symbol/i);
    await expect(sheet).toContainText('Landmarks');
    await expect(screen.getByTestId('btn.dreamSymbol.readMore', { visible: true })).toBeVisible();
    await settledMotion(browser);
    await app.screenshot('dictionary-symbol-landmarks');

    // Back returns to the symbol it was opened from, then the sheet has nothing more to go back to.
    const back = screen.getByTestId('btn.dreamSymbol.back', { visible: true });
    await expect(back).toHaveAttribute('aria-label', 'Back to Light');
    await back.tap();
    await expect(screen.getByTestId('text.dreamSymbol.title')).toContainText('Light');
    await expect(screen.getByTestId('btn.dreamSymbol.back')).toHaveCount(0);

    // The thread opens the first dream.
    await screen.getByTestId(/^dreamSymbol\.appearance\./, { visible: true }).tap();
    await expect(screen.getByTestId('sheet.dreamSymbol')).toBeHidden();
    await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(first);

    // From that reading, the journal opens on every dream of the thread, filtered on the symbol.
    const firstLight = screen.getByTestId('dream.symbol.p.guiding-light', { visible: true });
    await firstLight.scrollIntoView();
    await firstLight.tap();
    await screen.getByTestId('btn.dreamSymbol.allDreams', { visible: true }).tap();
    await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
    // The reading closed on the way: no second set of tabs waits behind it.
    await expect(screen.getByTestId('screen.journal')).toHaveCount(1);
    const symbolFilter = screen.getByTestId('btn.filterSymbol', { visible: true });
    await expect(symbolFilter).toContainText('Light');
    const journalItems = screen.getByTestId(/^dream\.item\./, { visible: true });
    await expect(journalItems).toHaveCount(2);
    await settledMotion(browser);
    await app.screenshot('journal-symbol-thread');
    await symbolFilter.tap();
    await expect(screen.getByTestId('btn.filterSymbol')).toHaveCount(0);

    // The search ignores accents and reads the names of a reading's symbols: only the
    // first dream says "doorway", both readings name it.
    const search = screen.getByTestId('input.searchDreams', { visible: true });
    await search.fill('cafe');
    await expect(journalItems).toHaveCount(1);
    await search.fill('doorway');
    await expect(journalItems).toHaveCount(2);
    await search.fill('');

    // Home names a symbol that came back this month; its medallion opens the same sheet.
    await screen.getByTestId('tab.home', { visible: true }).tap();
    const recurring = screen.getByTestId('btn.home.recurring', { visible: true });
    await recurring.scrollIntoView();
    await expect(screen.getByTestId('text.home.recurring.detail', { visible: true })).toContainText('2 dreams in 30 days');
    await settledMotion(browser);
    await app.screenshot('home-returning-symbol');
    await recurring.tap();
    await expect(screen.getByTestId('text.dreamSymbol.status', { visible: true })).toContainText('In 2 of 7 dreams');
    await screen.getByTestId('btn.dreamSymbol.close', { visible: true }).tap();
    await expect(screen.getByTestId('sheet.dreamSymbol', { visible: true })).toHaveCount(0);

    // Tendances names the symbols that came back this month. Opened from there, no dream is
    // being read: every dream of the thread opens.
    await screen.getByTestId('tab.stats', { visible: true }).tap();
    const periodSymbols = screen.getByTestId('trends.returns.symbols', { visible: true });
    await periodSymbols.scrollIntoView();
    const trendsLight = screen.getByTestId('trends.returns.symbol.p.guiding-light', { visible: true });
    await expect(screen.getByTestId('trends.returns.symbol.d.water', { visible: true }))
      .toHaveAttribute('aria-label', 'Water, 2 of 7');
    await expect(trendsLight).toHaveAttribute('aria-label', 'Light, Your symbol, 2 of 7');
    await expect(screen.getByTestId(/^trends\.returns\.symbol\./, { visible: true })).toHaveCount(3);
    await settledMotion(browser);
    await app.screenshot('trends-returning-symbols');
    await trendsLight.tap();
    // A reading opened earlier can keep its closed sheet in the page: only the open one counts.
    await expect(screen.getByTestId('text.dreamSymbol.title', { visible: true })).toContainText('Light');
    await expect(sheet).not.toContainText(/this dream/i);
    const traces = screen.getByTestId(/^dreamSymbol\.appearance\./, { visible: true });
    await expect(traces).toHaveCount(2);
    await settledMotion(browser);
    await app.screenshot('trends-symbol-thread');
    await traces.first().tap();
    await expect(screen.getByTestId('sheet.dreamSymbol', { visible: true })).toHaveCount(0);
    await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(first);

    // From there, the dictionary's full entry.
    await screen.getByTestId('dream.symbol.d.water', { visible: true }).tap();
    await screen.getByTestId('btn.dreamSymbol.readMore', { visible: true }).tap();
    await expect(screen.getByTestId('screen.symbolDetail', { visible: true })).toBeVisible();
  });
