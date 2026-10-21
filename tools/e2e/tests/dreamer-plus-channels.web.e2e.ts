// Paths from a free account to the Plus offer: the remaining-analyses row, the chat limit,
// a saved dream waiting for its reading, Trends and the weekly recap.
import type { Page } from 'playwright/test';
import { answerSeal, createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest();

const nudge = 'btn.quota.freeAnalysesNudge';
// Home stays mounted behind other screens; read the row of the visible screen only.
const homeRow = (page: Page) => page.getByTestId('screen.home').getByTestId(nudge);
const dreamRow = (page: Page) => page.getByTestId('screen.dreamDetail').getByTestId(nudge);

async function selectProfile(page: Page, profile: 'new' | 'existing' | 'plus') {
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
  await page.getByTestId(`btn.mockProfile.${profile}`).click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function home(page: Page) {
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await expect(page.getByTestId('screen.home')).toBeVisible();
}

async function openDream(page: Page, title: string) {
  await page.getByTestId('tab.journal').filter({ visible: true }).click();
  await page.getByRole('textbox', { name: 'Search dreams…' }).fill(title);
  await page.getByTestId(/^dream\.item\./).filter({ hasText: title, visible: true }).click();
  await expect(page.getByTestId('component.transcriptCard')).toBeVisible();
}

// The day the included analyses come back, as the en-US offer writes it ("November 1").
const comeBack = /Your included analyses come back on [A-Z][a-z]+ \d{1,2}/;

async function expectOffer(page: Page, chip: string, title?: string) {
  const offer = page.getByTestId('screen.paywall');
  await expect(offer).toBeVisible();
  await expect(offer.getByText(chip, { exact: true })).toBeVisible();
  if (title) await expect(offer.getByText(title, { exact: true })).toBeVisible();
  await page.getByTestId('btn.paywall.close').click();
  await expect(offer).toBeHidden();
}

test('a fresh free account keeps Home for the dream while several analyses remain', async ({ page }) => {
  await selectProfile(page, 'new');
  await home(page);
  await expect(homeRow(page)).toHaveCount(0);
});

test('a free account that used its analyses learns when they come back and opens the analysis limit offer', async ({ page }) => {
  await selectProfile(page, 'existing');
  await home(page);
  const row = homeRow(page);
  await expect(row).toContainText(comeBack);
  await expect(row).toContainText('Analyze without limits with Noctalia Plus');
  await row.click();
  const offer = page.getByTestId('screen.paywall');
  await expect(offer).toBeVisible();
  await expect(offer).toContainText(comeBack);
  // Real numbers, not "limited": 3 analyses a month, 10 exchanges against unlimited ones, the synthesis only with Plus.
  for (const text of ['3 a month', 'Exchanges per dream', '10', '360° synthesis', 'Not included', 'Included']) {
    await expect(offer.getByText(text, { exact: true })).toBeVisible();
  }
  // Analyses and exchanges are both unlimited with Plus; the safety ceiling is never sold as a number.
  await expect(offer.getByText('Unlimited', { exact: true })).toHaveCount(2);
  await expect(offer.getByText('100', { exact: true })).toHaveCount(0);
  await expect(offer.getByText('Recording your dreams stays unlimited, with or without Plus.')).toBeVisible();
  await expect(offer.getByText('Unlimited exchanges, subject to abuse prevention measures.')).toBeVisible();
  await expectOffer(page, 'Included analyses used', 'Your next dreams, read as you wake');
});

test('the analyses row stays away from guests', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await home(page);
  await expect(homeRow(page)).toHaveCount(0);
});

test('the analyses row stays away from Plus', async ({ page }) => {
  await selectProfile(page, 'plus');
  await home(page);
  await expect(homeRow(page)).toHaveCount(0);
});

async function recordAndRead(page: Page, story: string) {
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  // The journal asks during the seal; yes opens the page already reading the dream.
  await answerSeal(page, 'now');
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
}

test('Home waits for the last included analysis before it mentions Plus', async ({ page }) => {
  await selectProfile(page, 'new');
  await recordAndRead(page, 'E2E free traveler finds a lantern on a silver bridge.');
  await expect(dreamRow(page)).toHaveCount(0);
  await home(page);
  await expect(homeRow(page)).toHaveCount(0);

  await page.getByTestId('tab.addDream').filter({ visible: true }).click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await recordAndRead(page, 'E2E free traveler hears a choir under a frozen lake.');
  await page.getByTestId('component.transcriptCard').scrollIntoViewIfNeeded();
  await expect(dreamRow(page)).toContainText('You have 1 included analysis left this month');
  await home(page);
  const row = homeRow(page);
  await expect(row).toContainText('You have 1 included analysis left this month');
  await row.click();
  await expectOffer(page, 'Noctalia Plus', 'Analyze every dream, no counting');
});

test('an analyzed dream offers Plus once the included analyses are used', async ({ page }) => {
  await selectProfile(page, 'existing');
  await openDream(page, 'The Infinite Library');
  const row = dreamRow(page);
  await row.scrollIntoViewIfNeeded();
  await expect(row).toContainText(comeBack);
  await row.click();
  await expectOffer(page, 'Included analyses used');
  await expect(page.getByTestId('component.transcriptCard')).toBeVisible();
});

test('the chat message limit opens the Plus offer for a free account', async ({ page }) => {
  await selectProfile(page, 'existing');
  await openDream(page, 'The Infinite Library');
  // Below the plate, the seal and the reading (PR #358), the story brings its action into the dock.
  await page.getByTestId('component.transcriptCard').scrollIntoViewIfNeeded();
  await page.getByTestId('component.dreamDetail.actionCard').click();
  await page.getByTestId('btn.dreamCategory.freeChat').click();
  const input = page.getByTestId('chat.input.message');
  const banner = page.getByTestId('text.chat.limit');
  // A free account has 10 messages per dream; send until the limit banner replaces the counter.
  const counter = page.getByTestId('text.chat.messageCounter');
  for (let sent = 0; sent < 10 && !(await banner.isVisible()); sent += 1) {
    await expect(input).toBeEditable();
    const used = Number((await counter.innerText()).match(/^(\d+)\/10\b/)?.[1]);
    expect(used).toBeLessThan(10);
    await input.fill(`E2E limit message ${sent + 1}`);
    await page.getByTestId('chat.button.send').click();
    // The counter moves once the mock reply has landed, or the banner takes its place at the limit.
    await expect(counter.filter({ hasText: `${used + 1}/10 ` }).or(banner)).toBeVisible();
  }
  await expect(banner).toBeVisible();
  // The end of the included exchanges is not an error: no "safety limit" for a free account.
  await expect(banner).toContainText('You’ve used the 10 included exchanges');
  await expect(banner).toContainText('With Plus, this conversation continues without limits.');
  await expect(banner).not.toContainText('safety limit');
  await expect(input).toHaveAttribute('placeholder', 'Included exchanges used for this dream');
  const upgrade = page.getByTestId('btn.chat.limitUpgrade');
  await expect(upgrade).toHaveText('Continue with Plus');
  await upgrade.click();
  await expectOffer(page, 'Noctalia Plus', 'Keep this conversation going');
  await expect(banner).toBeVisible();
});

test('a saved dream waiting for its reading shows its own first words on the offer', async ({ page }) => {
  await selectProfile(page, 'existing');
  const story = 'E2E sleeper walks through an immense station where trains leave for the sea.';
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  const analyze = page.getByRole('button', { name: 'Analyze this dream with Plus' }).filter({ visible: true }).first();
  await analyze.scrollIntoViewIfNeeded();
  await analyze.click();
  const offer = page.getByTestId('screen.paywall');
  await expect(offer).toBeVisible();
  await expect(offer.getByTestId('text.paywall.dreamExcerpt')).toContainText('E2E sleeper walks through an immense station');
  await expect(offer).toContainText(/Without a subscription, your included analyses come back on [A-Z][a-z]+ \d{1,2}\./);
  await expect(page.getByTestId('btn.paywall.purchase')).toHaveText('Subscribe and analyze this dream');
  await offer.getByText('View my dream', { exact: true }).click();
  await expect(offer).toBeHidden();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
});

// Image errors and the paywall sign-in send people to the account screen, which has no
// subscription card: its quota card keeps the one way to Plus there.
test('the account screen keeps its own way to Plus for a free account', async ({ page }) => {
  await selectProfile(page, 'existing');
  // Browser history keeps the mock session; a page load would start a new app launch.
  await page.evaluate(() => {
    window.history.pushState({}, '', '/settings?section=account');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
  await expect(page.getByTestId('screen.account')).toBeVisible();
  await expect(page.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await page.getByRole('button', { name: 'Upgrade to Noctalia Plus', exact: true }).click();
  await expectOffer(page, 'Noctalia Plus', 'Analyze dreams without limits');
});

test('Trends points to Plus only when used analyses leave dreams unread', async ({ page }) => {
  await selectProfile(page, 'existing');
  await page.getByTestId('tab.stats').filter({ visible: true }).click();
  const hint = page.getByTestId('trends.returns.plusHint');
  await hint.scrollIntoViewIfNeeded();
  await expect(hint).toContainText(comeBack);
  await expect(hint).toContainText(/With Plus, you can analyze (these \d+ dreams|this dream) now so (they join|it joins) your trends/);
  await hint.click();
  await expectOffer(page, 'Trends', 'Trends that count every dream');
  await expect(page.getByTestId('screen.trends')).toBeVisible();
});

test('Trends says nothing about Plus to a subscriber', async ({ page }) => {
  await selectProfile(page, 'plus');
  await page.getByTestId('tab.stats').filter({ visible: true }).click();
  await page.getByTestId('trends.section.returns').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('trends.returns.plusHint')).toHaveCount(0);
});

test('the weekly recap shows a free account its recurring emotion, with no Plus lock', async ({ page }) => {
  await selectProfile(page, 'existing');
  await home(page);
  await page.getByTestId('btn.home.week.recap').click();
  await expect(page.getByTestId('screen.weeklyRecap')).toBeVisible();
  await expect(page.getByTestId('text.weeklyRecap.emotion')).toBeVisible();
  await expect(page.getByTestId('btn.weeklyRecap.unlockEmotion')).toHaveCount(0);
  await expect(page.getByText('Revealed with Plus')).toHaveCount(0);
});
