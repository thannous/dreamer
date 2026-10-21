import { readDOM, byId, expectEditable, answerSeal, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Paths from a free account to Plus: analyses, chat, a waiting dream, Trends and recap.
const test = createExactWebTest();

const nudge = 'btn.quota.freeAnalysesNudge';
// Home stays mounted behind other screens; read the row of the visible screen only.
const homeRow = (ui: ExactWebUI) => ui.screen.getByTestId('screen.home').getByTestId(nudge);
const dreamRow = (ui: ExactWebUI) => ui.screen.getByTestId('screen.dreamDetail').getByTestId(nudge);

async function selectProfile(ui: ExactWebUI, profile: 'new' | 'existing' | 'plus') {
  const { app, screen: uiScreen, browser } = ui;
  await app.open('/');
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  }
  await uiScreen.getByTestId('btn.onboarding.skip').click();
  await home(ui);
  await uiScreen.getByTestId('btn.header.home.settings').click();
  await uiScreen.getByTestId('quick-settings.all').click();
  await uiScreen.getByTestId('settings-account-open-signin').click();
  await uiScreen.getByTestId(`btn.mockProfile.${profile}`).click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
}

async function home(ui: ExactWebUI) {
  const { screen: uiScreen } = ui;
  await uiScreen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await expect(uiScreen.getByTestId('screen.home')).toBeVisible();
}

async function openDream(ui: ExactWebUI, title: string) {
  const { screen: uiScreen } = ui;
  await uiScreen.getByTestId('tab.journal', { visible: true }).click();
  await uiScreen.getByRole('textbox', { name: 'Search dreams…' }).fill(title);
  await uiScreen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: title }).click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toBeVisible();
}

// The day the included analyses come back, as the en-US offer writes it ("November 1").
const comeBack = /Your included analyses come back on [A-Z][a-z]+ \d{1,2}/;

async function expectOffer(ui: ExactWebUI, chip: string, title?: string) {
  const { screen: uiScreen } = ui;
  const offer = uiScreen.getByTestId('screen.paywall');
  await expect(offer).toBeVisible();
  await expect(offer.getByText(chip, { exact: true })).toBeVisible();
  if (title) await expect(offer.getByText(title, { exact: true })).toBeVisible();
  await uiScreen.getByTestId('btn.paywall.close').click();
  await expect(offer).toBeHidden();
}

test('a fresh free account keeps Home for the dream while several analyses remain', async (ui) => {
  await selectProfile(ui, 'new');
  await home(ui);
  await expect(homeRow(ui)).toHaveCount(0);
});

test('a free account that used its analyses learns when they come back and opens the analysis limit offer', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'existing');
  await home(ui);
  const row = homeRow(ui);
  await expect(row).toContainText(comeBack);
  await expect(row).toContainText('Analyze without limits with Noctalia Plus');
  await row.click();
  const offer = uiScreen.getByTestId('screen.paywall');
  await expect(offer).toBeVisible();
  await expect(offer).toContainText(comeBack);
  // Real numbers, not "limited": 3 analyses a month, 10 against 100 exchanges, the synthesis only with Plus.
  for (const text of ['3 a month', 'Exchanges per dream', '10', '100', '360° synthesis', 'Not included', 'Included']) {
    await expect(offer.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(offer.getByText('Recording your dreams stays unlimited, with or without Plus.')).toBeVisible();
  await expectOffer(ui, 'Included analyses used', 'Your next dreams, read as you wake');
});

test('the analyses row stays away from guests', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await app.open('/');
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  }
  await uiScreen.getByTestId('btn.onboarding.skip').click();
  await home(ui);
  await expect(homeRow(ui)).toHaveCount(0);
});

test('the analyses row stays away from Plus', async (ui) => {
  await selectProfile(ui, 'plus');
  await home(ui);
  await expect(homeRow(ui)).toHaveCount(0);
});

async function recordAndRead(ui: ExactWebUI, story: string) {
  const { screen: uiScreen } = ui;
  await uiScreen.getByTestId('input.dreamTranscript').fill(story);
  await uiScreen.getByTestId('btn.saveDream').click();
  // The journal asks during the seal; yes opens the page already reading the dream.
  await answerSeal(uiScreen, 'now');
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(uiScreen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
}

test('Home waits for the last included analysis before it mentions Plus', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'new');
  await recordAndRead(ui, 'E2E free traveler finds a lantern on a silver bridge.');
  await expect(dreamRow(ui)).toHaveCount(0);
  await home(ui);
  await expect(homeRow(ui)).toHaveCount(0);

  await uiScreen.getByTestId('tab.addDream', { visible: true }).click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
  await recordAndRead(ui, 'E2E free traveler hears a choir under a frozen lake.');
  await uiScreen.getByTestId('component.transcriptCard').scrollIntoView();
  await expect(dreamRow(ui)).toContainText('You have 1 included analysis left this month');
  await home(ui);
  const row = homeRow(ui);
  await expect(row).toContainText('You have 1 included analysis left this month');
  await row.click();
  await expectOffer(ui, 'Noctalia Plus', 'Analyze every dream, no counting');
});

test('an analyzed dream offers Plus once the included analyses are used', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'existing');
  await openDream(ui, 'The Infinite Library');
  const row = dreamRow(ui);
  await row.scrollIntoView();
  await expect(row).toContainText(comeBack);
  await row.click();
  await expectOffer(ui, 'Included analyses used');
  await expect(uiScreen.getByTestId('component.transcriptCard')).toBeVisible();
});

test('the chat message limit opens the Plus offer for a free account', async (ui) => {
  const { screen: uiScreen, browser } = ui;
  await selectProfile(ui, 'existing');
  await openDream(ui, 'The Infinite Library');
  // Below the plate, the seal and the reading (PR #358), the story brings its action into the dock.
  await uiScreen.getByTestId('component.transcriptCard').scrollIntoView();
  await uiScreen.getByTestId('component.dreamDetail.actionCard').click();
  await uiScreen.getByTestId('btn.dreamCategory.freeChat').click();
  const input = uiScreen.getByTestId('chat.input.message');
  const banner = uiScreen.getByTestId('text.chat.limit');
  // A free account has 10 messages per dream; send until the limit banner replaces the counter.
  const counter = uiScreen.getByTestId('text.chat.messageCounter');
  for (let sent = 0; sent < 10 && !(await banner.isVisible()); sent += 1) {
    await expectEditable(browser, byId('chat.input.message'));
    const used = Number((await readDOM(browser, byId('text.chat.messageCounter'), element => element.innerText)).match(/^(\d+)\/10\b/)?.[1]);
    expect(used).toBeLessThan(10);
    await input.fill(`E2E limit message ${sent + 1}`);
    await uiScreen.getByTestId('chat.button.send').click();
    // The counter moves once the mock reply has landed, or the banner takes its place at the limit.
    await expect.poll(async () => await counter.filter({ hasText: `${used + 1}/10 ` }).isVisible() || await banner.isVisible(), { timeout: 15_000 }).toBe(true);
  }
  await expect(banner).toBeVisible();
  // The end of the included exchanges is not an error: no "safety limit" for a free account.
  await expect(banner).toContainText('You’ve used the 10 included exchanges');
  await expect(banner).toContainText('this conversation continues up to 100 exchanges');
  await expect(banner).not.toContainText('safety limit');
  await expect(input).toHaveAttribute('placeholder', 'Included exchanges used for this dream');
  const upgrade = uiScreen.getByTestId('btn.chat.limitUpgrade');
  await expect(upgrade).toHaveText('Continue with Plus');
  await upgrade.click();
  await expectOffer(ui, 'Noctalia Plus', 'Keep this conversation going');
  await expect(banner).toBeVisible();
});

test('a saved dream waiting for its reading shows its own first words on the offer', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'existing');
  const story = 'E2E sleeper walks through an immense station where trains leave for the sea.';
  await uiScreen.getByTestId('input.dreamTranscript').fill(story);
  await uiScreen.getByTestId('btn.saveDream').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  const analyze = uiScreen.getByRole('button', { name: 'Analyze this dream with Plus', visible: true }).first();
  await analyze.scrollIntoView();
  await analyze.click();
  const offer = uiScreen.getByTestId('screen.paywall');
  await expect(offer).toBeVisible();
  await expect(offer.getByTestId('text.paywall.dreamExcerpt')).toContainText('E2E sleeper walks through an immense station');
  await expect(offer).toContainText(/Without a subscription, your included analyses come back on [A-Z][a-z]+ \d{1,2}\./);
  await expect(uiScreen.getByTestId('btn.paywall.purchase')).toHaveText('Subscribe and analyze this dream');
  await offer.getByText('View my dream', { exact: true }).click();
  await expect(offer).toBeHidden();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
});

// Image errors and the paywall sign-in send people to the account screen, which has no
// subscription card: its quota card keeps the one way to Plus there.
test('the account screen keeps its own way to Plus for a free account', async (ui) => {
  const { screen: uiScreen, browser } = ui;
  await selectProfile(ui, 'existing');
  // Browser history keeps the mock session; a page load would start a new app launch.
  await browser.evaluate(() => {
    window.history.pushState({}, '', '/settings?section=account');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    return null;
  });
  await expect(uiScreen.getByTestId('screen.account')).toBeVisible();
  await expect(uiScreen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
  await uiScreen.getByRole('button', { name: 'Upgrade to Noctalia Plus', exact: true }).click();
  await expectOffer(ui, 'Noctalia Plus', 'Analyze dreams without limits');
});

test('Trends points to Plus only when used analyses leave dreams unread', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'existing');
  await uiScreen.getByTestId('tab.stats', { visible: true }).click();
  const hint = uiScreen.getByTestId('trends.returns.plusHint');
  await hint.scrollIntoView();
  await expect(hint).toContainText(comeBack);
  await expect(hint).toContainText(/With Plus, you can analyze (these \d+ dreams|this dream) now so (they join|it joins) your trends/);
  await hint.click();
  await expectOffer(ui, 'Trends', 'Trends that count every dream');
  await expect(uiScreen.getByTestId('screen.trends')).toBeVisible();
});

test('Trends says nothing about Plus to a subscriber', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'plus');
  await uiScreen.getByTestId('tab.stats', { visible: true }).click();
  await uiScreen.getByTestId('trends.section.returns').scrollIntoView();
  await expect(uiScreen.getByTestId('trends.returns.plusHint')).toHaveCount(0);
});

test('the weekly recap shows a free account its recurring emotion, with no Plus lock', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'existing');
  await home(ui);
  await uiScreen.getByTestId('btn.home.week.recap').click();
  await expect(uiScreen.getByTestId('screen.weeklyRecap')).toBeVisible();
  await expect(uiScreen.getByTestId('text.weeklyRecap.emotion')).toBeVisible();
  await expect(uiScreen.getByTestId('btn.weeklyRecap.unlockEmotion')).toHaveCount(0);
  await expect(uiScreen.getByText('Revealed with Plus')).toHaveCount(0);
});
