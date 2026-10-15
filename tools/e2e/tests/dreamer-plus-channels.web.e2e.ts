// Paths from a free account to the Plus offer: the remaining-analyses row and the chat limit.
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

async function expectOffer(page: Page, chip: string) {
  await expect(page.getByTestId('screen.paywall')).toBeVisible();
  await expect(page.getByText(chip, { exact: true })).toBeVisible();
  await page.getByTestId('btn.paywall.close').click();
  await expect(page.getByTestId('screen.paywall')).toBeHidden();
}

test('a fresh free account sees its remaining analyses on Home and opens the quota offer', async ({ page }) => {
  await selectProfile(page, 'new');
  await home(page);
  const row = homeRow(page);
  await expect(row).toContainText('You have 3 included analyses left this month');
  await expect(row).toContainText('Analyze without limits with Noctalia Plus');
  await row.click();
  await expectOffer(page, 'Quota overview');
  await expect(page.getByTestId('screen.home')).toBeVisible();
});

test('a free account that used its analyses opens the analysis limit offer from Home', async ({ page }) => {
  await selectProfile(page, 'existing');
  await home(page);
  const row = homeRow(page);
  await expect(row).toContainText('You’ve used this month’s included analyses');
  await row.click();
  await expectOffer(page, 'Analysis limit reached');
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

test('after an analysis the dream page stays quiet while analyses remain and Home counts one fewer', async ({ page }) => {
  await selectProfile(page, 'new');
  const story = 'E2E free traveler finds a lantern on a silver bridge.';
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  // The journal asks during the seal; yes opens the page already reading the dream.
  await answerSeal(page, 'now');
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await expect(dreamRow(page)).toHaveCount(0);
  await home(page);
  await expect(homeRow(page)).toContainText('You have 2 included analyses left this month');
});

test('an analyzed dream offers Plus once the included analyses are used', async ({ page }) => {
  await selectProfile(page, 'existing');
  await openDream(page, 'The Infinite Library');
  const row = dreamRow(page);
  await row.scrollIntoViewIfNeeded();
  await expect(row).toContainText('You’ve used this month’s included analyses');
  await row.click();
  await expectOffer(page, 'Analysis limit reached');
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
  const upgrade = page.getByTestId('btn.chat.limitUpgrade');
  await expect(upgrade).toHaveText('Upgrade to Noctalia Plus');
  await upgrade.click();
  await expectOffer(page, 'Reflection limit reached');
  await expect(banner).toBeVisible();
});
