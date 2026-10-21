import { readDOM, byId, expectInViewport, setTestDate, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
import { readFileSync } from 'node:fs';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.

const test = createExactWebTest({ viewport: { width: 390, height: 844 } });

// The mock Plus journal holds 8 dreams, one every two nights back from 2 October 2026:
// 5 analyzed, 3 not (failed, pending, never asked). Mystical, noir and calm hold two each.
const SECTIONS = ['trends.section.period', 'trends.section.seal', 'trends.section.nights', 'trends.section.returns'];

async function startGuest(ui: ExactWebUI) {
  const { app, screen: uiScreen, browser } = ui;
  await setTestDate(browser, '2026-10-02T12:00:00Z');
  await browser.addInitScript(() => { Math.random = () => 0.5; });
  await app.open('/');
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  }
  await uiScreen.getByTestId('btn.onboarding.skip').click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
}

async function openTrends(ui: ExactWebUI) {
  const { screen: uiScreen } = ui;
  await uiScreen.getByTestId('tab.stats').click();
  await expect(uiScreen.getByTestId('screen.trends', { visible: true })).toHaveCount(1);
}

async function finishProfileWelcome(ui: ExactWebUI) {
  const { screen: uiScreen } = ui;
  const skip = uiScreen.getByTestId('btn.onboarding.skip');
  const recording = uiScreen.getByTestId('screen.recording');
  await expect.poll(async () => await skip.isVisible() || await recording.isVisible()).toBe(true);
  if (await skip.isVisible()) await skip.click();
  await expect(recording).toBeVisible();
}

async function signInPlus(ui: ExactWebUI) {
  const { screen: uiScreen } = ui;
  await uiScreen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await uiScreen.getByTestId('btn.header.home.settings').click();
  await uiScreen.getByTestId('quick-settings.signin').click();
  await uiScreen.getByTestId('btn.mockProfile.plus').click();
  await finishProfileWelcome(ui);
}

async function selectTheme(ui: ExactWebUI, theme: 'light' | 'dark' | 'auto') {
  const { screen: uiScreen, browser } = ui;
  await uiScreen.getByTestId('btn.header.trends.settings').click();
  await uiScreen.getByTestId(`quick-settings.theme.${theme}`).click();
  await uiScreen.getByTestId('quick-settings.close').click();
  // The profile row has real bounds; the drawer container can have zero height while its content is still sliding.
  await expectInViewport(uiScreen.getByTestId('quick-settings.profile'), browser, 0, false);
}

async function expectWithinScreen(ui: ExactWebUI, ids: string[]) {
  const { browser } = ui;
  for (const id of ids) {
    await expect.poll(() => readDOM(browser, byId(id), (element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
}

async function artifact(ui: ExactWebUI, name: string, ids: string[]) {
  const { app, artifacts } = ui;
  await expectWithinScreen(ui, ids);
  await artifacts.attach(name, { body: readFileSync(await app.screenshot('trends-evidence')), contentType: 'image/png' });
}

const journalItems = (ui: ExactWebUI) => ui.screen.getByTestId(/^dream\.item\.\d+$/, { visible: true });

test('an empty journal offers its first capture instead of a row of zeros', async (ui) => {
  const { app, screen: uiScreen, browser, artifacts } = ui;
  await startGuest(ui);
  await openTrends(ui);
  await expect(uiScreen.getByTestId('trends.empty')).toContainText('Your first dream will light the first star of your trends.');
  await expect(uiScreen.getByTestId('trends.figures')).toHaveCount(0);
  await expect(uiScreen.getByTestId('trends.section.seal')).toHaveCount(0);
  await selectTheme(ui, 'light');
  await browser.setViewport({ width: 320, height: 844 });
  await artifact(ui, 'empty-light-320', ['trends.empty']);
  await selectTheme(ui, 'dark');
  await artifact(ui, 'empty-dark-320', ['trends.empty']);
  await uiScreen.getByTestId('trends.cta.primary').click();
  await uiScreen.getByTestId('input.dreamTranscript').fill('A short synthetic dream about a quiet garden.');
  await uiScreen.getByTestId('btn.saveDream').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText('A short synthetic dream about a quiet garden.');
  await expect(uiScreen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await artifacts.attach('first-capture-inline-analysis', { body: readFileSync(await app.screenshot('trends-evidence')), contentType: 'image/png' });
  await uiScreen.getByTestId('btn.navigateJournal').click();
  await expect(journalItems(ui)).toContainText('A short synthetic dream about a quiet garden.');
});

test('30 nights read honestly, a chosen sign turns the seal, and Intl.PluralRules may be missing', async (ui) => {
  const { screen: uiScreen, browser } = ui;
  // Hermes builds may provide number/date formatters without this constructor.
  await browser.addInitScript(() => Object.defineProperty(Intl, 'PluralRules', { value: undefined, configurable: true }));
  await startGuest(ui);
  await signInPlus(ui);
  await openTrends(ui);

  await expect(uiScreen.getByTestId('trends.period.30')).toHaveAttribute('aria-selected', 'true');
  await expect(uiScreen.getByTestId('trends.figure.dreams.value')).toHaveText('8');
  await expect(uiScreen.getByTestId('trends.figure.nights.value')).toHaveText('8');
  await expect(uiScreen.getByTestId('trends.figure.streak.value')).toHaveText('1');
  // Nothing was noted in the 30 nights before: no comparison is claimed.
  await expect(uiScreen.getByTestId('trends.range')).toHaveText('Sep 3 – Oct 2');
  await expect(uiScreen.getByTestId('trends.figure.dreams.note')).toHaveCount(0);
  // Three themes hold two dreams each: none leads.
  await expect(uiScreen.getByTestId('trends.seal.sentence')).toHaveText('No theme leads: tap a sign to see its dreams.');
  await expect(uiScreen.getByTestId('trends.seal.open')).toHaveCount(0);

  await uiScreen.getByTestId('trends.seal.sign.mystical').click();
  await expect(uiScreen.getByTestId('trends.seal.sentence')).toHaveText('Mystical: 2 of 8 dreams.');
  await expect(uiScreen.getByTestId('trends.seal.open')).toContainText('See these 2 dreams');
  await uiScreen.getByTestId('trends.seal.sign.luminous').click();
  await expect(uiScreen.getByTestId('trends.seal.sentence')).toHaveText('Luminous: none of 8 dreams.');
  await expect(uiScreen.getByTestId('trends.seal.open')).toHaveCount(0);
  // The turning ring never pushes the page sideways.
  await expect.poll(() => readDOM(browser, byId('trends.section.seal'), (element) => {
    let current: Element | null = element;
    while (current) {
      if (current.scrollLeft !== 0) return current.scrollLeft;
      current = current.parentElement;
    }
    return 0;
  })).toBe(0);

  await uiScreen.getByTestId('trends.section.nights').scrollIntoView();
  await expect(uiScreen.getByTestId('trends.nights.stat.perWeek')).toHaveText(/3\.7\s*dreams per week/);
  await expect(uiScreen.getByTestId('trends.nights.stat.richest')).toHaveText(/Friday\s*your richest night/);
  await expect(uiScreen.getByTestId('trends.nights.stat.last')).toHaveText(/Today\s*your last dream/);
  // Today already holds a dream: the run needs no nudge.
  await expect(uiScreen.getByTestId('trends.nights.nudge')).toHaveCount(0);

  await uiScreen.getByTestId('trends.section.returns').scrollIntoView();
  await expect(uiScreen.getByTestId('trends.section.returns')).toContainText('Based on 5 analyzed dreams out of 8');
  await expect(uiScreen.getByTestId('trends.returns.toAnalyze')).toContainText('3 to analyze');
  await expect(uiScreen.getByTestId('trends.returns.emotions')).toContainText('3 of 5');
  await expect(uiScreen.getByTestId('trends.returns.type.symbolic-dream')).toHaveText(/^Symbolic dream\s*4$/);
  await expect(uiScreen.getByTestId('trends.returns.type.lucid-dream')).toHaveText(/^Lucid Dream\s*1$/);

  const background = () => readDOM(browser, byId('trends.section.period'), (element) => {
    let current: Element | null = element;
    while (current) {
      const value = getComputedStyle(current).backgroundColor;
      if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value;
      current = current.parentElement;
    }
    return '';
  });
  await uiScreen.getByTestId('trends.section.period').scrollIntoView();
  await selectTheme(ui, 'light');
  await expect.poll(background).toBe('rgb(240, 228, 212)');
  await artifact(ui, 'populated-light', SECTIONS);
  await browser.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(background).toBe('rgb(240, 228, 212)');
  await selectTheme(ui, 'dark');
  await expect.poll(background).toBe('rgb(3, 4, 13)');
  await artifact(ui, 'populated-dark', SECTIONS);
  await browser.emulateMedia({ colorScheme: 'light' });
  await expect.poll(background).toBe('rgb(3, 4, 13)');
  await selectTheme(ui, 'auto');
  await expect.poll(background).toBe('rgb(240, 228, 212)');
  await browser.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(background).toBe('rgb(3, 4, 13)');
});

test('each door opens the journal on exactly those dreams, and the period changes every figure', async (ui) => {
  const { app, screen: uiScreen, browser, artifacts } = ui;
  await startGuest(ui);
  await signInPlus(ui);
  await openTrends(ui);

  // A sign's door: its theme over the 30 nights.
  await uiScreen.getByTestId('trends.seal.sign.mystical').click();
  await uiScreen.getByTestId('trends.seal.open').click();
  await expect(uiScreen.getByTestId('btn.filterTheme')).toContainText('Mystical');
  await expect(uiScreen.getByTestId('btn.filterDate')).toBeVisible();
  await expect(journalItems(ui)).toHaveCount(2);
  await expect(journalItems(ui).first()).toContainText('The Infinite Library');
  await expect(journalItems(ui).last()).toContainText('Meeting My Future Self');
  await artifacts.attach('journal-from-seal', { body: readFileSync(await app.screenshot('trends-evidence')), contentType: 'image/png' });

  // The dreams still to analyze.
  await openTrends(ui);
  await uiScreen.getByTestId('trends.returns.toAnalyze').click();
  await expect(uiScreen.getByTestId('btn.filterTheme')).toHaveCount(0);
  await expect(journalItems(ui)).toHaveCount(3);
  for (const title of ['The Shadowy Pursuer', 'The Forgotten Classroom', 'The Broken Mirror']) {
    await expect(journalItems(ui).filter({ hasText: title })).toHaveCount(1);
  }

  // 7 nights: 4 dreams against 3 the week before. A night picked in the 30 leaves with
  // them, and the latest night of the 7 takes its place.
  await openTrends(ui);
  await uiScreen.getByTestId('trends.nights.night.2026-09-20').click();
  await expect(uiScreen.getByTestId('trends.nights.selected')).toContainText('Sep 20');
  await uiScreen.getByTestId('trends.period.7').click();
  await expect(uiScreen.getByTestId('trends.nights.selected')).toContainText('Oct 2');
  await expect(uiScreen.getByTestId('trends.period.7')).toHaveAttribute('aria-selected', 'true');
  await expect(uiScreen.getByTestId('trends.figure.dreams.value')).toHaveText('4');
  await expect(uiScreen.getByTestId('trends.figure.dreams.note')).toHaveText('+1');
  await expect(uiScreen.getByTestId('trends.range')).toHaveText('Sep 26 – Oct 2 · compared with the 7 nights before');
  await expect(uiScreen.getByTestId(/^trends\.nights\.night\./)).toHaveCount(7);
  await uiScreen.getByTestId('trends.nights.night.2026-09-28').click();
  await expect(uiScreen.getByTestId('trends.nights.selected')).toContainText('The Shadowy Pursuer');
  await expect(uiScreen.getByTestId('trends.nights.selected')).toContainText('to analyze');
  await artifacts.attach('seven-nights', { body: readFileSync(await app.screenshot('trends-evidence')), contentType: 'image/png' });
  await uiScreen.getByTestId(/^trends\.nights\.dream\./).click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toBeVisible();
  await browser.back();

  // The whole journal, month by month.
  await openTrends(ui);
  await uiScreen.getByTestId('trends.period.all').click();
  await expect(uiScreen.getByTestId('trends.figure.dreams.value')).toHaveText('8');
  await expect(uiScreen.getByTestId('trends.nights.month.2026-09')).toContainText('7');
  await expect(uiScreen.getByTestId('trends.nights.month.2026-10')).toContainText('1');
  // A type counts analyzed dreams only, so its door leaves out The Broken Mirror, symbolic but unread.
  // The journal draws only the cards near the screen, and a card shows its whole painting (#480).
  // In a window tall enough to bring the list's end into view, every card before it is drawn,
  // so the count below is the door's whole result: a fifth card would be drawn or push the end out.
  await browser.setViewport({ width: 390, height: 3400 });
  await uiScreen.getByTestId('trends.returns.type.symbolic-dream').click();
  await expect(uiScreen.getByTestId('btn.filterDate')).toHaveCount(0);
  await expectInViewport(uiScreen.getByText('All available results shown', { visible: true }), browser);
  await expect(journalItems(ui)).toHaveCount(4);
  await expect(journalItems(ui).filter({ hasText: 'The Broken Mirror' })).toHaveCount(0);
});

{
  const germanTest = createExactWebTest({ locale: 'de-DE', viewport: { width: 320, height: 844 } });
  germanTest('the German trends keep labels and values within a 320 screen', async (ui) => {
  const { screen: uiScreen } = ui;
    await startGuest(ui);
    await signInPlus(ui);
    await openTrends(ui);
    await expect(uiScreen.getByTestId('trends.period.30')).toHaveText('30 Nächte');
    await uiScreen.getByTestId('trends.section.returns').scrollIntoView();
    await expect(uiScreen.getByTestId('trends.section.returns').getByRole('heading', { name: 'Was wiederkehrt' })).toBeVisible();
    await expect(uiScreen.getByTestId('trends.returns.emotions')).toContainText('3 von 5');
    await uiScreen.getByTestId('trends.section.period').scrollIntoView();
    await artifact(ui, 'populated-long-labels-de-320', SECTIONS);
  });
}
