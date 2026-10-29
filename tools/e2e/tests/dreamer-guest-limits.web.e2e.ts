// Where a limit leads (2026-10-25): a guest out of illustrations is offered Plus, since a free
// account adds none of its own; a guest at the chat limit is asked for an account first, while a
// free account at the same limit goes straight to Plus.
import type { Page } from 'playwright/test';
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest();

async function startGuest(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function saveAndRead(page: Page, story: string) {
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  // A guest's first dream is read unasked.
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
}

async function openFirstDream(page: Page) {
  const back = page.getByTestId('btn.navigateJournal');
  if (await back.isVisible()) await back.click();
  else await page.getByTestId('tab.journal').filter({ visible: true }).click();
  await expect(page.getByTestId('screen.journal').filter({ visible: true })).toHaveCount(1);
  await page.getByTestId(/^dream\.item\./).filter({ visible: true }).first().click();
  await expect(page.getByTestId('component.transcriptCard')).toBeVisible();
}

/** Sends free-chat messages on the open dream until the 10-exchange limit banner shows. */
async function reachChatLimit(page: Page) {
  await page.getByTestId('component.transcriptCard').scrollIntoViewIfNeeded();
  await page.getByTestId('component.dreamDetail.actionCard').click();
  await page.getByTestId('btn.dreamCategory.freeChat').click();
  const input = page.getByTestId('chat.input.message');
  const banner = page.getByTestId('text.chat.limit');
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
  return { banner, upgrade: page.getByTestId('btn.chat.limitUpgrade') };
}

async function expectSignupForm(page: Page) {
  await expect(page).toHaveURL(/\/settings\?section=account&auth=signup$/);
  await expect(page.getByTestId('screen.account')).toBeVisible();
  await expect(page.getByTestId('btn.auth.signUp').filter({ visible: true })).toHaveCount(1);
  await expect(page.getByTestId('btn.auth.signIn').filter({ visible: true })).toHaveCount(0);
  await expect(page.getByTestId('screen.paywall')).toHaveCount(0);
}

test('a guest out of illustrations is offered Plus from the dream page', async ({ page, context }) => {
  // The mock never fails a painting and each read dream holds one, so no guest journey ends with a
  // read dream left unillustrated. Start from the mock pool already spent (2 of 2), readings intact,
  // as after illustrated dreams since deleted. Seeded once, before the app's first read of it.
  await context.addInitScript(() => {
    if (sessionStorage.getItem('e2e.guestImagesSpent')) return;
    sessionStorage.setItem('e2e.guestImagesSpent', '1');
    localStorage.setItem('mock_quota_events_migrated_v1', 'true');
    localStorage.setItem('mock_quota_events_v1', JSON.stringify({
      analysisCount: 0, explorationCount: 0, imageCount: 2,
      analyzedDreamIds: [], exploredDreamIds: [], imagedDreamIds: [],
    }));
  });
  await startGuest(page);
  await saveAndRead(page, 'E2E guest walks a lantern-lit pier while the tide sings below.');
  // Read without a painting: the plate says the pool is spent and offers Plus, not an account.
  const upgrade = page.getByTestId('btn.journal.imageUpgrade');
  await upgrade.scrollIntoViewIfNeeded();
  await expect(upgrade).toContainText('Unlock dream images with Plus');
  await expect(page.getByText('Your illustration quota has been reached. You can still add an image from your device.')).toBeVisible();
  await expect(page.getByTestId('btn.journal.illustrate')).toHaveCount(0);
  await expect(page.getByTestId('btn.quotaLimit.ctaGuest')).toHaveCount(0);
  await upgrade.click();
  await expect(page).toHaveURL(/\/paywall\?trigger=image_generation$/);
  const offer = page.getByTestId('screen.paywall');
  await expect(offer).toBeVisible();
  await expect(offer.getByText('Image generation', { exact: true })).toBeVisible();
  // The offer itself asks a guest to sign in before any purchase.
  await expect(page.getByTestId('btn.paywall.purchase')).toContainText('Sign in');
  await expect(page.getByTestId('screen.account')).toHaveCount(0);
});

test('a guest at the chat limit is sent to create an account, not to Plus', async ({ page }) => {
  await startGuest(page);
  await saveAndRead(page, 'E2E guest crosses a glass orchard where every tree hums.');
  await openFirstDream(page);
  const { banner, upgrade } = await reachChatLimit(page);
  // Offered exchanges, not the safety limit (2026-10-29): the card says what continues them.
  await expect(banner).toContainText('You’ve used the 10 included exchanges');
  await expect(banner).toContainText('With an account and Noctalia Plus, this conversation continues.');
  await expect(banner).not.toContainText('safety limit');
  await expect(upgrade).toHaveText('Create account');
  await upgrade.click();
  await expectSignupForm(page);
});

test('a free account at the chat limit still goes to Plus, not to an account form', async ({ page }) => {
  await startGuest(page);
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId('btn.mockProfile.existing').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await page.getByTestId('tab.journal').filter({ visible: true }).click();
  await page.getByRole('textbox', { name: 'Search dreams…' }).fill('The Infinite Library');
  await page.getByTestId(/^dream\.item\./).filter({ hasText: 'The Infinite Library', visible: true }).click();
  await expect(page.getByTestId('component.transcriptCard')).toBeVisible();
  const { upgrade } = await reachChatLimit(page);
  await expect(upgrade).toHaveText('Continue with Plus');
  await upgrade.click();
  await expect(page).toHaveURL(/\/paywall\?trigger=chat_limit$/);
  await expect(page.getByTestId('screen.paywall')).toBeVisible();
  await expect(page.getByTestId('screen.account')).toHaveCount(0);
});
