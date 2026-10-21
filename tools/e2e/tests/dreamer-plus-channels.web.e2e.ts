import { readDOM, byId, expectEditable, answerSeal, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Paths from a free account to the Plus offer: the remaining-analyses row and the chat limit.
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

async function expectOffer(ui: ExactWebUI, chip: string) {
  const { screen: uiScreen } = ui;
  await expect(uiScreen.getByTestId('screen.paywall')).toBeVisible();
  await expect(uiScreen.getByText(chip, { exact: true })).toBeVisible();
  await uiScreen.getByTestId('btn.paywall.close').click();
  await expect(uiScreen.getByTestId('screen.paywall')).toBeHidden();
}

test('a fresh free account sees its remaining analyses on Home and opens the quota offer', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'new');
  await home(ui);
  const row = homeRow(ui);
  await expect(row).toContainText('You have 3 included analyses left this month');
  await expect(row).toContainText('Analyze without limits with Noctalia Plus');
  await row.click();
  await expectOffer(ui, 'Quota overview');
  await expect(uiScreen.getByTestId('screen.home')).toBeVisible();
});

test('a free account that used its analyses opens the analysis limit offer from Home', async (ui) => {
  await selectProfile(ui, 'existing');
  await home(ui);
  const row = homeRow(ui);
  await expect(row).toContainText('You’ve used this month’s included analyses');
  await row.click();
  await expectOffer(ui, 'Analysis limit reached');
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

test('after an analysis the dream page stays quiet while analyses remain and Home counts one fewer', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'new');
  const story = 'E2E free traveler finds a lantern on a silver bridge.';
  await uiScreen.getByTestId('input.dreamTranscript').fill(story);
  await uiScreen.getByTestId('btn.saveDream').click();
  // The journal asks during the seal; yes opens the page already reading the dream.
  await answerSeal(uiScreen, 'now');
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(uiScreen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await expect(dreamRow(ui)).toHaveCount(0);
  await home(ui);
  await expect(homeRow(ui)).toContainText('You have 2 included analyses left this month');
});

test('an analyzed dream offers Plus once the included analyses are used', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'existing');
  await openDream(ui, 'The Infinite Library');
  const row = dreamRow(ui);
  await row.scrollIntoView();
  await expect(row).toContainText('You’ve used this month’s included analyses');
  await row.click();
  await expectOffer(ui, 'Analysis limit reached');
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
  const upgrade = uiScreen.getByTestId('btn.chat.limitUpgrade');
  await expect(upgrade).toHaveText('Upgrade to Noctalia Plus');
  await upgrade.click();
  await expectOffer(ui, 'Reflection limit reached');
  await expect(banner).toBeVisible();
});
