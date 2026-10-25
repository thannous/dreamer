// The weekly recap: Today's week opens it once the journal holds a dream, the Sunday
// notification opens it directly. It counts the last seven days against the seven before,
// names the theme, symbol and emotion that came back, and offers one dream: the newest read
// but not yet deepened, else the newest not yet read, through Plus once the free analyses
// are used. An empty week asks for a dream. Its back button returns to Today.
import type { Page } from 'playwright/test';
import { answerSeal, createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest();

const DAY = 24 * 60 * 60 * 1000;
// The mock journal goes back two days per dream from the moment it is injected, each at a
// random hour of its day. Injected one second past midnight and read the next morning, the
// week holds exactly the three newest dreams and the week before the next three.
const JOURNAL_AT = new Date('2026-09-16T00:00:01+02:00');
const NEXT_MORNING = new Date('2026-09-17T09:00:00+02:00');

async function selectProfile(page: Page, profile: 'new' | 'existing' | 'plus', journalAt?: Date) {
  if (journalAt) await page.clock.setSystemTime(new Date(journalAt.getTime() - 60_000));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await home(page);
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-account-open-signin').click();
  // The mock journal is spread back from the moment its profile is chosen.
  if (journalAt) await page.clock.setSystemTime(journalAt);
  await page.getByTestId(`btn.mockProfile.${profile}`).click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function home(page: Page) {
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await expect(page.getByTestId('screen.home')).toBeVisible();
}

// Home stays mounted behind other screens; read the link of the visible screen only.
const recapLink = (page: Page) => page.getByTestId('screen.home').getByTestId('btn.home.week.recap');
const recap = (page: Page) => page.getByTestId('screen.weeklyRecap').filter({ visible: true });
const dreamPage = (page: Page) => page.getByTestId('component.transcriptCard').filter({ visible: true });

async function openRecapFromToday(page: Page) {
  await home(page);
  await recapLink(page).scrollIntoViewIfNeeded();
  await expect(recapLink(page)).toContainText('See my week');
  await recapLink(page).click();
  await expect(recap(page)).toBeVisible();
  await expect(recap(page)).toContainText('Your week in dreams');
}

async function saveDream(page: Page, story: string) {
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
}

test('the recap reads the mock week, offers its dream to deepen, and returns to Today', async ({ page }) => {
  await selectProfile(page, 'existing', JOURNAL_AT);
  await page.clock.setSystemTime(NEXT_MORNING);
  await openRecapFromToday(page);
  const week = recap(page);
  await expect(week).toContainText('Sep 11 – Sep 17');
  await expect(week).toContainText('Seven nights, one reading. Here is what came back.');
  await expect(week.getByTestId('text.weeklyRecap.count')).toHaveText('3');
  await expect(week).toContainText(/3\s*dreams\s*same as last week/);
  // The newest dream was the day before yesterday: no night in a row to count.
  await expect(week).toContainText(/0\s*days in a row/);
  // The Shadowy Pursuer's analysis failed: two of the three are read.
  await expect(week).toContainText(/2\s*analyzed/);
  await expect(week.getByTestId('text.weeklyRecap.theme')).toHaveText('Mystical');
  await expect(week.getByTestId('text.weeklyRecap.symbol')).toHaveText('Not yet');
  await expect(week.getByTestId('text.weeklyRecap.emotion')).toHaveText('Joy');
  // Ocean of Stars is already deepened; The Infinite Library is read but not yet.
  await expect(week).toContainText('One dream to deepen');
  await expect(week).toContainText('The Infinite Library');
  await expect(week).toContainText('I found myself in an enormous library');
  const next = week.getByTestId('btn.weeklyRecap.openDream');
  await expect(next).toHaveText('Deepen this dream');
  // With a dream to deepen, a free account past its analyses sees no offer.
  await expect(week).not.toContainText('Plus');

  await week.getByTestId('btn.weeklyRecap.back').click();
  await expect(recap(page)).toHaveCount(0);
  await expect(page.getByTestId('screen.home')).toBeVisible();

  await openRecapFromToday(page);
  await recap(page).getByTestId('btn.weeklyRecap.openDream').click();
  await expect(dreamPage(page)).toContainText('I found myself in an enormous library');
});

test('Today offers no recap without a dream; the recap from the notification asks for one, then offers it for analysis', async ({ page }) => {
  await selectProfile(page, 'new');
  await home(page);
  await expect(page.getByTestId('screen.home').getByTestId('component.home.today')).toBeVisible();
  await expect(recapLink(page)).toHaveCount(0);
  await expect(page.getByTestId('screen.home').getByTestId('btn.home.recurring')).toHaveCount(0);

  // The Sunday notification opens the recap whatever the journal holds. Browser history
  // keeps the session; a page load would start a new app launch.
  await page.evaluate(() => {
    window.history.pushState({}, '', '/weekly-recap');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
  const empty = recap(page);
  await expect(empty).toContainText('No dream recorded these last seven days.');
  await expect(empty.getByTestId('text.weeklyRecap.count')).toHaveText('0');
  await expect(empty).not.toContainText('vs last week');
  await expect(empty).toContainText('A fresh week starts tomorrow morning');
  await expect(empty).toContainText('One fragment at wake-up is enough to give next Sunday something to say.');
  await expect(empty.getByTestId('text.weeklyRecap.theme')).toHaveCount(0);
  const record = empty.getByTestId('btn.weeklyRecap.record');
  await expect(record).toHaveText('Record a dream');
  await record.click();
  await expect(page.getByTestId('screen.recording').filter({ visible: true })).toHaveCount(1);

  const story = 'E2E recap: a lantern drifting over a frozen lake.';
  await saveDream(page, story);
  await answerSeal(page, 'later');
  await expect(dreamPage(page)).toContainText(story);

  await openRecapFromToday(page);
  const week = recap(page);
  await expect(week.getByTestId('text.weeklyRecap.count')).toHaveText('1');
  await expect(week).toContainText(/1\s*dream\s*\+1 vs last week/);
  await expect(week).toContainText(/1\s*day in a row/);
  await expect(week).toContainText(/0\s*analyzed/);
  await expect(week.getByTestId('text.weeklyRecap.theme')).toHaveText('Not yet');
  await expect(week).toContainText('One dream to analyze');
  await expect(week).toContainText(story);
  const analyze = week.getByTestId('btn.weeklyRecap.openDream');
  await expect(analyze).toHaveText('Analyze this dream');
  await analyze.click();
  await expect(dreamPage(page)).toContainText(story);
  await expect(page.getByTestId('screen.paywall')).toHaveCount(0);
});

test('past its free analyses, an account opens the offer for its week’s unread dream from the recap', async ({ page }) => {
  const at = new Date('2026-09-08T09:00:00+02:00');
  await selectProfile(page, 'existing', at);
  // Twenty days on, the mock journal has left both weeks of the recap.
  await page.clock.setSystemTime(new Date(at.getTime() + 20 * DAY));
  const story = 'E2E recap: a staircase of salt that dissolves at every step.';
  await saveDream(page, story);
  await expect(dreamPage(page)).toContainText(story);

  await openRecapFromToday(page);
  const week = recap(page);
  await expect(week.getByTestId('text.weeklyRecap.count')).toHaveText('1');
  await expect(week).toContainText(/1\s*dream\s*\+1 vs last week/);
  await expect(week).toContainText('One dream to analyze');
  await expect(week).toContainText(story);
  const analyze = week.getByTestId('btn.weeklyRecap.openDream');
  await expect(analyze).toHaveText('Analyze this dream with Plus');
  await analyze.click();
  const offer = page.getByTestId('screen.paywall');
  await expect(offer).toBeVisible();
  await expect(page.getByTestId('btn.paywall.purchase')).toHaveText('Subscribe and analyze this dream');
  await expect(offer.getByTestId('text.paywall.dreamExcerpt')).toContainText(story);
  await page.getByTestId('btn.paywall.close').click();
  await expect(offer).toBeHidden();
  await expect(recap(page)).toBeVisible();
});
