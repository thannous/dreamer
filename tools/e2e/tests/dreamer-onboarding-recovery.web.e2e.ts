// The introduction ends by saving that it was seen. When the device refuses that write, the
// reader is told nothing was lost and can try again, or go on for this session without it.
// The mock's storage lives in memory and cannot fail on its own: session storage asks it to
// refuse the next writes that finish the introduction (services/mocks/storageServiceMock.ts).
import type { Page } from 'playwright/test';
import { createParityTest, expect, leaveOnboarding } from '../web-parity-fixtures';
const test = createParityTest({ tags: ['zone-onboarding'] });

const error = (page: Page) => page.getByTestId('component.onboarding.error');

async function leaveWithRefusedSaves(page: Page, refusals: number) {
  await page.addInitScript((count) => {
    const key = 'noctalia.mock.onboardingSaveFailures';
    if (sessionStorage.getItem(key) === null) sessionStorage.setItem(key, String(count));
  }, refusals);
  await page.goto('/');
  await leaveOnboarding(page);
  await expect(error(page)).toContainText('We could not save your progress. Nothing was lost.');
  await expect(page).toHaveURL(/\/onboarding$/);
}

test('a refused save keeps the reader on the introduction until a retry succeeds', async ({ page }) => {
  await leaveWithRefusedSaves(page, 2);
  // The second attempt is refused too: the message stays, and so does the reader.
  await page.getByTestId('btn.onboarding.retry').click();
  await expect(error(page)).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByTestId('btn.onboarding.retry').click();
  await expect(page.getByTestId('screen.recording').filter({ visible: true })).toHaveCount(1);
  await expect(error(page)).toHaveCount(0);
});

test('a reader can go on for this session when the save keeps being refused', async ({ page }) => {
  await leaveWithRefusedSaves(page, 50);
  await page.getByTestId('btn.onboarding.continueSession').click();
  await expect(page.getByTestId('screen.recording').filter({ visible: true })).toHaveCount(1);
  // Capture works without the saved introduction.
  await page.getByTestId('input.dreamTranscript').fill('E2E dream written after a refused save.');
  await expect(page.getByTestId('btn.saveDream')).toBeEnabled();
});
