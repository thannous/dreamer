// Historical exact UI assertions executed under the guarded TesterArmy engine.
import type { Page } from 'playwright/test';
import { createParityTest, expect, withDialog, type ParityInfo } from '../web-parity-fixtures';

const test = createParityTest({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Paris' });

// The mock Plus journal holds 8 dreams, one every two nights back from 2 October 2026:
// 5 analyzed, 3 not (failed, pending, never asked). Mystical, noir and calm hold two each.
const SECTIONS = ['trends.section.period', 'trends.section.seal', 'trends.section.nights', 'trends.section.returns'];

async function startGuest(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00Z'));
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function openTrends(page: Page) {
  await page.getByRole('tab').and(page.getByTestId('tab.stats')).click();
  await expect(page.getByTestId('screen.trends').filter({ visible: true })).toHaveCount(1);
}

async function finishProfileWelcome(page: Page) {
  const skip = page.getByTestId('btn.onboarding.skip');
  const recording = page.getByTestId('screen.recording');
  await expect.poll(async () => await skip.isVisible() || await recording.isVisible()).toBe(true);
  if (await skip.isVisible()) await skip.click();
  await expect(recording).toBeVisible();
}

async function signInPlus(page: Page) {
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.signin').click();
  await page.getByTestId('btn.mockProfile.plus').click();
  await finishProfileWelcome(page);
}

async function selectTheme(page: Page, theme: 'light' | 'dark' | 'auto') {
  await page.getByTestId('btn.header.trends.settings').click();
  await page.getByTestId(`quick-settings.theme.${theme}`).click();
  await page.getByTestId('quick-settings.close').click();
  // The profile row has real bounds; the drawer container can have zero height while its content is still sliding.
  await expect(page.getByTestId('quick-settings.profile')).not.toBeInViewport();
}

async function expectWithinScreen(page: Page, ids: string[]) {
  for (const id of ids) {
    await expect.poll(() => page.getByTestId(id).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
}

async function artifact(page: Page, info: ParityInfo, name: string, ids: string[]) {
  await expectWithinScreen(page, ids);
  await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

const journalItems = (page: Page) => page.getByTestId(/^dream\.item\.\d+$/).filter({ visible: true });

test('an empty journal offers its first capture instead of a row of zeros', async ({ page }, info) => {
  await startGuest(page);
  await openTrends(page);
  await expect(page.getByTestId('trends.empty')).toContainText('Your first dream will light the first star of your trends.');
  await expect(page.getByTestId('trends.figures')).toHaveCount(0);
  await expect(page.getByTestId('trends.section.seal')).toHaveCount(0);
  await selectTheme(page, 'light');
  await page.setViewportSize({ width: 320, height: 844 });
  await artifact(page, info, 'empty-light-320', ['trends.empty']);
  await selectTheme(page, 'dark');
  await artifact(page, info, 'empty-dark-320', ['trends.empty']);
  await page.getByTestId('trends.cta.primary').click();
  await page.getByTestId('input.dreamTranscript').fill('A short synthetic dream about a quiet garden.');
  await page.getByTestId('btn.saveDream').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText('A short synthetic dream about a quiet garden.');
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await info.attach('first-capture-inline-analysis', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByTestId('btn.navigateJournal').click();
  await expect(journalItems(page)).toContainText('A short synthetic dream about a quiet garden.');
});

test('30 nights read honestly, a chosen sign turns the seal, and Intl.PluralRules may be missing', async ({ page }, info) => {
  // Hermes builds may provide number/date formatters without this constructor.
  await page.addInitScript(() => Object.defineProperty(Intl, 'PluralRules', { value: undefined, configurable: true }));
  await startGuest(page);
  await signInPlus(page);
  await openTrends(page);

  await expect(page.getByTestId('trends.period.30')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('trends.figure.dreams.value')).toHaveText('8');
  await expect(page.getByTestId('trends.figure.nights.value')).toHaveText('8');
  await expect(page.getByTestId('trends.figure.streak.value')).toHaveText('1');
  // Nothing was noted in the 30 nights before: no comparison is claimed.
  await expect(page.getByTestId('trends.range')).toHaveText('Sep 3 – Oct 2');
  await expect(page.getByTestId('trends.figure.dreams.note')).toHaveCount(0);
  // Three themes hold two dreams each: none leads.
  await expect(page.getByTestId('trends.seal.sentence')).toHaveText('No theme leads: tap a sign to see its dreams.');
  await expect(page.getByTestId('trends.seal.open')).toHaveCount(0);

  await page.getByTestId('trends.seal.sign.mystical').click();
  await expect(page.getByTestId('trends.seal.sentence')).toHaveText('Mystical: 2 of 8 dreams.');
  await expect(page.getByTestId('trends.seal.open')).toContainText('See these 2 dreams');
  await page.getByTestId('trends.seal.sign.luminous').click();
  await expect(page.getByTestId('trends.seal.sentence')).toHaveText('Luminous: none of 8 dreams.');
  await expect(page.getByTestId('trends.seal.open')).toHaveCount(0);
  // The turning ring never pushes the page sideways.
  await expect.poll(() => page.getByTestId('trends.section.seal').evaluate((element) => {
    let current: Element | null = element;
    while (current) {
      if (current.scrollLeft !== 0) return current.scrollLeft;
      current = current.parentElement;
    }
    return 0;
  })).toBe(0);

  await page.getByTestId('trends.section.nights').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('trends.nights.stat.perWeek')).toHaveText(/3\.7\s*dreams per week/);
  await expect(page.getByTestId('trends.nights.stat.richest')).toHaveText(/Friday\s*your richest night/);
  await expect(page.getByTestId('trends.nights.stat.last')).toHaveText(/Today\s*your last dream/);
  // Today already holds a dream: the run needs no nudge.
  await expect(page.getByTestId('trends.nights.nudge')).toHaveCount(0);

  await page.getByTestId('trends.section.returns').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('trends.section.returns')).toContainText('Based on 5 analyzed dreams out of 8');
  await expect(page.getByTestId('trends.returns.toAnalyze')).toContainText('3 to analyze');
  await expect(page.getByTestId('trends.returns.emotions')).toContainText('3 of 5');
  await expect(page.getByTestId('trends.returns.type.symbolic-dream')).toHaveText(/^Symbolic dream\s*4$/);
  await expect(page.getByTestId('trends.returns.type.lucid-dream')).toHaveText(/^Lucid Dream\s*1$/);

  const background = () => page.getByTestId('trends.section.period').evaluate((element) => {
    let current: Element | null = element;
    while (current) {
      const value = getComputedStyle(current).backgroundColor;
      if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value;
      current = current.parentElement;
    }
    return '';
  });
  await page.getByTestId('trends.section.period').scrollIntoViewIfNeeded();
  await selectTheme(page, 'light');
  await expect.poll(background).toBe('rgb(240, 228, 212)');
  await artifact(page, info, 'populated-light', SECTIONS);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(background).toBe('rgb(240, 228, 212)');
  await selectTheme(page, 'dark');
  await expect.poll(background).toBe('rgb(3, 4, 13)');
  await artifact(page, info, 'populated-dark', SECTIONS);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(background).toBe('rgb(3, 4, 13)');
  await selectTheme(page, 'auto');
  await expect.poll(background).toBe('rgb(240, 228, 212)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(background).toBe('rgb(3, 4, 13)');
});

test('each door opens the journal on exactly those dreams, and the period changes every figure', async ({ page }, info) => {
  await startGuest(page);
  await signInPlus(page);
  await openTrends(page);

  // A sign's door: its theme over the 30 nights.
  await page.getByTestId('trends.seal.sign.mystical').click();
  await page.getByTestId('trends.seal.open').click();
  await expect(page.getByTestId('btn.filterTheme')).toContainText('Mystical');
  await expect(page.getByTestId('btn.filterDate')).toBeVisible();
  await expect(journalItems(page)).toHaveCount(2);
  await expect(journalItems(page).first()).toContainText('The Infinite Library');
  await expect(journalItems(page).last()).toContainText('Meeting My Future Self');
  await info.attach('journal-from-seal', { body: await page.screenshot(), contentType: 'image/png' });

  // The dreams still to analyze.
  await openTrends(page);
  await page.getByTestId('trends.returns.toAnalyze').click();
  await expect(page.getByTestId('btn.filterTheme')).toHaveCount(0);
  await expect(journalItems(page)).toHaveCount(3);
  for (const title of ['The Shadowy Pursuer', 'The Forgotten Classroom', 'The Broken Mirror']) {
    await expect(journalItems(page).filter({ hasText: title })).toHaveCount(1);
  }

  // 7 nights: 4 dreams against 3 the week before. A night picked in the 30 leaves with
  // them, and the latest night of the 7 takes its place.
  await openTrends(page);
  await page.getByTestId('trends.nights.night.2026-09-20').click();
  await expect(page.getByTestId('trends.nights.selected')).toContainText('Sep 20');
  await page.getByTestId('trends.period.7').click();
  await expect(page.getByTestId('trends.nights.selected')).toContainText('Oct 2');
  await expect(page.getByTestId('trends.period.7')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('trends.figure.dreams.value')).toHaveText('4');
  await expect(page.getByTestId('trends.figure.dreams.note')).toHaveText('+1');
  await expect(page.getByTestId('trends.range')).toHaveText('Sep 26 – Oct 2 · compared with the 7 nights before');
  await expect(page.getByTestId(/^trends\.nights\.night\./)).toHaveCount(7);
  await page.getByTestId('trends.nights.night.2026-09-28').click();
  await expect(page.getByTestId('trends.nights.selected')).toContainText('The Shadowy Pursuer');
  await expect(page.getByTestId('trends.nights.selected')).toContainText('to analyze');
  await info.attach('seven-nights', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByTestId(/^trends\.nights\.dream\./).click();
  await expect(page.getByTestId('component.transcriptCard')).toBeVisible();
  await page.goBack();

  // The whole journal, month by month.
  await openTrends(page);
  await page.getByTestId('trends.period.all').click();
  await expect(page.getByTestId('trends.figure.dreams.value')).toHaveText('8');
  await expect(page.getByTestId('trends.nights.month.2026-09')).toContainText('7');
  await expect(page.getByTestId('trends.nights.month.2026-10')).toContainText('1');
  // A type counts analyzed dreams only, so its door leaves out The Broken Mirror, symbolic but unread.
  // The journal draws only the cards near the screen, and a card shows its whole painting (#480).
  // In a window tall enough to bring the list's end into view, every card before it is drawn,
  // so the count below is the door's whole result: a fifth card would be drawn or push the end out.
  await page.setViewportSize({ width: 390, height: 3400 });
  await page.getByTestId('trends.returns.type.symbolic-dream').click();
  await expect(page.getByTestId('btn.filterDate')).toHaveCount(0);
  await expect(page.getByText('All available results shown').filter({ visible: true })).toBeInViewport();
  await expect(journalItems(page)).toHaveCount(4);
  await expect(journalItems(page).filter({ hasText: 'The Broken Mirror' })).toHaveCount(0);
});

{
  const germanTest = createParityTest({ locale: 'de-DE', viewport: { width: 320, height: 844 } });
  germanTest('the German trends keep labels and values within a 320 screen', async ({ page }, info) => {
    await startGuest(page);
    await signInPlus(page);
    await openTrends(page);
    await expect(page.getByTestId('trends.period.30')).toHaveText('30 Nächte');
    await page.getByTestId('trends.section.returns').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('trends.section.returns').getByRole('heading', { name: 'Was wiederkehrt' })).toBeVisible();
    await expect(page.getByTestId('trends.returns.emotions')).toContainText('3 von 5');
    await page.getByTestId('trends.section.period').scrollIntoViewIfNeeded();
    await artifact(page, info, 'populated-long-labels-de-320', SECTIONS);
  });
}
