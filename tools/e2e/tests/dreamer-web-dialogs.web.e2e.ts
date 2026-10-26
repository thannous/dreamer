// In a browser the app's alerts are the browser's own dialogs: a choice is a confirmation whose
// OK takes the action and whose Cancel keeps things as they are. Before, they did nothing.
import type { Page } from 'playwright/test';
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest();

const LIMIT = 'Guest recording limit reached\n\nYou have saved 5 dreams without an account. Your draft stays on this device. Create a free account to add this dream.';
const RESTART = 'Start the story again?\n\nThe story and current answers will be removed from this draft.';

async function startAsGuest(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

const transcript = (page: Page) => page.getByTestId('input.dreamTranscript').filter({ visible: true });

async function saveDream(page: Page, story: string) {
  const capture = page.getByTestId('tab.addDream').filter({ visible: true });
  if (await capture.count()) await capture.click();
  await transcript(page).fill(story);
  await page.getByTestId('btn.saveDream').filter({ visible: true }).click();
  // A guest's first dream is read at once; the next ones ask while reading is available.
  const saved = page.getByTestId('component.transcriptCard').filter({ hasText: story });
  const later = page.getByTestId('btn.dreamCaptureSeal.readLater');
  await expect(saved.or(later)).toBeVisible({ timeout: 60_000 });
  if (await later.isVisible()) await later.click();
  await expect(saved).toBeVisible({ timeout: 60_000 });
}

/** Clicks `target`, answers the browser's one dialog, and returns what it said. */
async function answer(page: Page, choice: 'accept' | 'dismiss', target: () => Promise<unknown>) {
  const said: string[] = [];
  await withDialog(page, async dialog => {
    said.push(`${dialog.type}: ${dialog.message}`);
    await (choice === 'accept' ? dialog.accept() : dialog.dismiss());
  }, async () => {
    await target();
    await expect.poll(() => said.length).toBe(1);
  });
  return said[0];
}

test('a guest’s sixth dream asks for an account; declining keeps the draft, accepting opens the sign-up', async ({ page }) => {
  await startAsGuest(page);
  for (let night = 1; night <= 5; night++) {
    await saveDream(page, `Guest night ${night}: I walked along a quiet shore under a violet sky.`);
  }
  const sixth = 'Guest night 6: a lantern swung above a sleeping harbour.';
  await page.getByTestId('tab.addDream').filter({ visible: true }).click();
  await transcript(page).fill(sixth);
  const save = page.getByTestId('btn.saveDream').filter({ visible: true });

  expect(await answer(page, 'dismiss', () => save.click())).toBe(`confirm: ${LIMIT}`);
  await expect(transcript(page)).toHaveValue(sixth);
  await expect(page.getByTestId('screen.recording')).toBeVisible();

  expect(await answer(page, 'accept', () => save.click())).toBe(`confirm: ${LIMIT}`);
  await expect(page).toHaveURL(/\/settings\?section=account&auth=signup$/);
  await expect(page.getByTestId('btn.auth.signUp').filter({ visible: true })).toHaveCount(1);
});

test('clearing a told story asks first; declining keeps it, accepting starts again', async ({ page }) => {
  await startAsGuest(page);
  await page.getByTestId('btn.recording.inputMode.voice').click();
  const reply = page.getByTestId('recording-conversation-answer');
  await expect(reply).toBeVisible();
  const story = 'I was walking by a lake and a lit house appeared between the trees.';
  await reply.fill(story);
  await page.getByTestId('recording-conversation-submit').click();
  await expect(page.getByTestId('capture-chat-user')).toHaveText(story);
  const restart = page.getByTestId('recording-conversation-restart');

  expect(await answer(page, 'dismiss', () => restart.click())).toBe(`confirm: ${RESTART}`);
  await expect(page.getByTestId('capture-chat-user')).toHaveText(story);

  expect(await answer(page, 'accept', () => restart.click())).toBe(`confirm: ${RESTART}`);
  await expect(page.getByTestId('capture-chat-user')).toHaveCount(0);
  await expect(page.getByTestId('recording-conversation-answer')).toBeVisible();
});
