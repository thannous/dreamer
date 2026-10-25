// Today's rows that come back with the calendar, and the Trends sections that keep them.
// The full moon seals the dreams noted on the day its night ends: Today announces it the day
// before, then opens the capture, or the sealed dream once there is one. A dream noted on this
// date a month ago comes back that day only. Five nights noted from Monday to Sunday form the
// week's constellation, which Trends keeps. In the month's last five days, a free account with
// included analyses left and a dream never read is told they do not carry over; Plus never is.
// Trends keeps the full moon letters for an account. Dreams are noted through the capture, the
// clock set to the night they belong to; the journeys run in Paris time.
import type { Page } from 'playwright/test';
import { answerSeal, createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest();

// The full moon of 26 October 2026 comes at 05:12 in Paris: the night it ends is the 25th's,
// so the 26th's dreams wear the seal and the 25th is its eve.
const FULL_MOON_EVE = new Date('2026-10-25T17:00:00Z');
const FULL_MOON_MORNING = new Date('2026-10-26T06:30:00Z');
const DAY_AFTER_FULL_MOON = new Date('2026-10-27T06:30:00Z');
// A week later Today no longer offers that cycle's letter.
const WEEK_AFTER_FULL_MOON = new Date('2026-11-03T09:00:00Z');
// The included analyses end at midnight UTC on the 1st: the 27th is within five days of it.
const MONTH_END = new Date('2026-10-27T08:00:00Z');
const WEEK_BEFORE_MONTH_END = new Date('2026-10-20T08:00:00Z');

// One sentence each, so the name the capture gives and the one the mock gives are the same.
const SEALED_STORY = 'The moon floated low over the vineyard';
const UNSEALED_STORY = 'A white owl waited on the chimney';
const ANNIVERSARY_STORY = 'A silver hare ran across the frozen pond';
// The mock reads these five as noir, which names their week.
const WEEK = [
  { at: new Date('2026-11-09T06:30:00Z'), story: 'A paper boat crossed the flooded street' },
  { at: new Date('2026-11-10T06:30:00Z'), story: 'A staircase climbed into the clouds' },
  { at: new Date('2026-11-11T06:30:00Z'), story: 'A train of lanterns crossed the bay' },
  { at: new Date('2026-11-12T06:30:00Z'), story: 'The tide left silver keys on the sand' },
  { at: new Date('2026-11-13T06:30:00Z'), story: 'Clocks drifted down a silent river' },
];
// The Sunday before belongs to the week before.
const SUNDAY_BEFORE = { at: new Date('2026-11-08T19:00:00Z'), story: 'A lantern swung over the quiet harbor' };
const LETTER_OPENING = 'This cycle, water came back in almost every dream, first as a threat, then as a way through.';
const LETTER_BODY = 'At first the sea rose behind you and you looked for a door.';

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

async function trends(page: Page) {
  await page.getByTestId('tab.stats').filter({ visible: true }).click();
  await expect(page.getByTestId('screen.trends').filter({ visible: true })).toHaveCount(1);
}

/** Moves the clock to another day; Today reads the date again when it comes back into view. */
async function moveClock(page: Page, at: Date) {
  await page.clock.setSystemTime(at);
  await page.getByTestId('tab.journal').filter({ visible: true }).click();
  await home(page);
}

// Home stays mounted behind other screens; read the rows of the visible screen only.
const today = (page: Page) => page.getByTestId('screen.home');
const dreamPage = (page: Page) => page.getByTestId('screen.dreamDetail').filter({ visible: true });
const letterScreen = (page: Page) => page.getByTestId('screen.moonLetter').filter({ visible: true });

/** Saved, an account is asked whether to read the dream now; later keeps it unread on its page. */
async function saveDream(page: Page, story: string) {
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  await answerSeal(page, 'later');
  await expect(dreamPage(page).getByTestId('component.transcriptCard')).toContainText(story);
}

async function noteDream(page: Page, night: { at: Date; story: string }) {
  await page.clock.setSystemTime(night.at);
  await page.getByTestId('tab.addDream').filter({ visible: true }).click();
  await saveDream(page, night.story);
}

test('the eve of a full moon announces the silver seal, and the dream noted the next morning wears it', async ({ page }) => {
  await selectProfile(page, 'new', FULL_MOON_EVE);
  const row = today(page).getByTestId('component.home.fullMoon');
  await expect(row).toContainText('Full moon tonight');
  await expect(row).toContainText('The dream you note tomorrow will wear the silver seal.');
  // The eve only announces it; the morning's row is the one to tap.
  await expect(row).not.toHaveRole('button');

  await moveClock(page, FULL_MOON_MORNING);
  await expect(row).toContainText('Full moon night');
  await expect(row).toContainText('Note your dream today: it will wear the silver seal.');
  await expect(row).toHaveRole('button');
  await row.click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await saveDream(page, SEALED_STORY);
  await expect(dreamPage(page).getByTestId('journal.detail.fullMoon')).toContainText('Full moon');

  // Once the morning's dream is noted, the row opens it.
  await home(page);
  await expect(row).toContainText('Last night’s dream wears the silver seal.');
  await row.click();
  await expect(dreamPage(page).getByTestId('component.transcriptCard')).toContainText(SEALED_STORY);
  await expect(dreamPage(page).getByTestId('journal.detail.fullMoon')).toBeVisible();

  // The day after, Today says no more of it, and a dream noted then wears no seal.
  await moveClock(page, DAY_AFTER_FULL_MOON);
  await expect(today(page).getByTestId('component.home.today')).toBeVisible();
  await expect(row).toHaveCount(0);
  await noteDream(page, { at: DAY_AFTER_FULL_MOON, story: UNSEALED_STORY });
  await expect(dreamPage(page).getByTestId('journal.detail.fullMoon')).toHaveCount(0);
});

test('a dream noted a month ago comes back on Today on that date only, and opens its page', async ({ page }) => {
  const noted = { at: new Date('2026-09-14T06:30:00Z'), story: ANNIVERSARY_STORY };
  await selectProfile(page, 'new', noted.at);
  await noteDream(page, noted);
  const card = today(page).getByTestId('btn.home.anniversary');

  await moveClock(page, new Date('2026-10-13T06:30:00Z'));
  await expect(today(page).getByTestId('component.home.today')).toBeVisible();
  await expect(card).toHaveCount(0);

  await moveClock(page, new Date('2026-10-14T06:30:00Z'));
  await expect(card).toContainText('A month ago today');
  await expect(card).toContainText(noted.story);
  await card.click();
  await expect(dreamPage(page).getByTestId('component.transcriptCard')).toContainText(noted.story);

  // The next day the same dream is only one to rediscover among the older ones.
  await moveClock(page, new Date('2026-10-15T06:30:00Z'));
  await expect(today(page).getByTestId('home.rediscovery')).toContainText('Rediscover a dream');
  await expect(card).toHaveCount(0);
  await expect(today(page)).not.toContainText('A month ago today');
});

test('five nights noted from Monday form the week constellation, which Trends keeps and opens on those dreams', async ({ page }) => {
  await selectProfile(page, 'new', SUNDAY_BEFORE.at);
  await noteDream(page, SUNDAY_BEFORE);
  await home(page);
  const row = today(page).getByTestId('btn.home.constellation');
  await expect(row).toContainText('This week’s constellation');
  // Sunday ends its week: one night can no longer make five.
  await expect(row).toContainText('1 night noted this week. A new constellation starts on Monday.');

  await noteDream(page, WEEK[0]);
  await home(page);
  await expect(row).toContainText('1 night noted since Monday. At 5, your week forms its constellation.');
  for (const night of WEEK.slice(1, 4)) await noteDream(page, night);
  await home(page);
  await expect(row).toContainText('4 nights noted since Monday. At 5, your week forms its constellation.');
  await row.click();
  const section = page.getByTestId('trends.section.constellations');
  await section.scrollIntoViewIfNeeded();
  await expect(section).toContainText('Your starry weeks');
  await expect(section).toContainText('Note 5 nights in the same week and it will form its constellation here.');
  await expect(section.getByTestId(/^trends\.constellations\.week\./)).toHaveCount(0);

  await noteDream(page, WEEK[4]);
  await home(page);
  await expect(row).toContainText('Your week formed its constellation: Noir.');
  await row.click();
  await section.scrollIntoViewIfNeeded();
  await expect(section).toContainText('1 week formed its constellation.');
  const week = section.getByTestId(/^trends\.constellations\.week\./);
  await expect(week).toHaveCount(1);
  await expect(week).toContainText('Noir');
  await expect(week).toContainText('Nov 9 – Nov 15 · 5 nights');

  // The week opens the journal on its Monday to its Sunday.
  await week.click();
  await expect(page.getByTestId('btn.filterDate').filter({ visible: true })).toBeVisible();
  const dreams = page.getByTestId(/^dream\.item\.\d+$/).filter({ visible: true });
  await expect(dreams).toHaveCount(WEEK.length);
  for (const night of WEEK) await expect(dreams.filter({ hasText: night.story })).toHaveCount(1);
  await expect(dreams.filter({ hasText: SUNDAY_BEFORE.story })).toHaveCount(0);
});

const monthEndCard = (page: Page) => today(page).getByTestId('btn.quota.monthEndAnalyses');

test('in the last five days of the month a free account learns its analyses do not carry over, then opens the dream to read', async ({ page }) => {
  await selectProfile(page, 'new', WEEK_BEFORE_MONTH_END);
  await noteDream(page, { at: WEEK_BEFORE_MONTH_END, story: UNSEALED_STORY });
  await home(page);
  await expect(today(page).getByTestId('component.home.today')).toBeVisible();
  await expect(monthEndCard(page)).toHaveCount(0);

  await moveClock(page, MONTH_END);
  const card = monthEndCard(page);
  await expect(card).toContainText('You have 3 included analyses left until October 31. They do not carry over.');
  await expect(card).toContainText(`Your dream “${UNSEALED_STORY}” has not been analyzed yet.`);
  await expect(card).toContainText('Analyze this dream');
  await card.click();
  await expect(dreamPage(page).getByTestId('component.transcriptCard')).toContainText(UNSEALED_STORY);
});

// The mock journal holds a dream never read, which would bring the card to a free account.
test('a Plus account never sees the month-end card', async ({ page }) => {
  await selectProfile(page, 'plus', MONTH_END);
  await expect(today(page).getByTestId('component.home.today')).toBeVisible();
  await expect(monthEndCard(page)).toHaveCount(0);
});

test('a free account with no analyses left keeps its usual nudge instead of the month-end card', async ({ page }) => {
  await selectProfile(page, 'existing', MONTH_END);
  await expect(today(page).getByTestId('btn.quota.freeAnalysesNudge')).toContainText('Your included analyses come back on November 1');
  await expect(monthEndCard(page)).toHaveCount(0);
});

test('past the days Today offers it, Trends still opens the latest full moon letter', async ({ page }) => {
  await selectProfile(page, 'plus', WEEK_AFTER_FULL_MOON);
  await expect(today(page).getByTestId('component.home.today')).toBeVisible();
  await expect(today(page).getByTestId('btn.home.moonLetter')).toHaveCount(0);
  await trends(page);
  const section = page.getByTestId('trends.section.moon_letters');
  await section.scrollIntoViewIfNeeded();
  await expect(section).toContainText('Full moon letters');
  await expect(section).toContainText('At each full moon, a letter reads back the dreams noted since the one before.');
  await section.getByTestId('trends.moon_letters.open').click();
  const letter = letterScreen(page);
  await expect(letter).toContainText('Full moon of October 26');
  await expect(letter.getByTestId('text.moonLetter.opening')).toHaveText(LETTER_OPENING);
  await expect(letter).toContainText(LETTER_BODY);
  await letter.getByTestId('btn.moonLetter.back').click();
  await expect(letterScreen(page)).toHaveCount(0);
  await expect(page.getByTestId('screen.trends').filter({ visible: true })).toHaveCount(1);
});

test('a guest finds an account offer in Trends in place of the full moon letters', async ({ page }) => {
  await start(page, WEEK_AFTER_FULL_MOON);
  await page.getByTestId('tab.addDream').filter({ visible: true }).click();
  await page.getByTestId('input.dreamTranscript').fill(UNSEALED_STORY);
  await page.getByTestId('btn.saveDream').click();
  // A guest's first dream is read at once, without the question.
  await expect(dreamPage(page).getByTestId('component.transcriptCard')).toContainText(UNSEALED_STORY);
  await trends(page);
  const offer = page.getByTestId('btn.guest.account.trends');
  await offer.scrollIntoViewIfNeeded();
  await expect(offer).toContainText('Without an account, you get 2 dream analyses in total. With a free account, you get 3 every month.');
  await expect(page.getByTestId('trends.section.moon_letters')).toHaveCount(0);
  await offer.click();
  await expect(page.getByTestId('screen.account')).toBeVisible();
  await expect(page.getByTestId('btn.auth.signUp').filter({ visible: true })).toHaveCount(1);
});
