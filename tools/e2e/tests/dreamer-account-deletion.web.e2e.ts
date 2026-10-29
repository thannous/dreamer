// Deleting an account from Settings asks twice, as on a phone: once for the deletion itself,
// then about the store subscription it does not cancel. In a browser both questions are the
// browser's own. Only then is the account deleted on the server and the device signed out.
// The mock app has no server: the journey answers its request the way the API does.
import type { Page } from 'playwright/test';
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest({ tags: ['zone-connexion'] });

const QUESTION = 'Delete your account?\n\nThis action is irreversible. Your dreams and your data will be permanently deleted.';
const SUBSCRIPTION = 'Delete your account?\n\nDeleting your account doesn’t cancel your store subscription. Cancel it in your store subscription settings.';
const DELETED = 'Account deleted\n\nYour account and your data have been deleted.';
const FAILED = 'We couldn’t delete your account right now. Try again, or write to contact@noctalia.app.';

async function openSettingsSignedIn(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId('btn.mockProfile.existing').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await page.getByTestId('tab.settings').filter({ visible: true }).click();
  await expect(page.getByTestId('screen.settings').filter({ visible: true })).toHaveCount(1);
}

/** Answers the API's DELETE /account with `status`, and counts the requests. */
async function answerDeletion(page: Page, status: 200 | 500) {
  const requests: string[] = [];
  await page.route(url => url.pathname.endsWith('/account'), async route => {
    requests.push(route.request().method());
    await route.fulfill(status === 200
      ? { status, contentType: 'application/json', body: JSON.stringify({ deleted: true }) }
      : { status, contentType: 'application/json', body: JSON.stringify({ error: 'Account deletion failed' }) });
  });
  return requests;
}

/**
 * Presses Delete account and answers the browser's dialogs in turn ('accept' or 'dismiss'),
 * until `expected` dialogs have shown; returns what each one said.
 */
async function deleteAccount(page: Page, answers: ('accept' | 'dismiss')[], expected = answers.length) {
  const said: string[] = [];
  await withDialog(page, async dialog => {
    said.push(`${dialog.type}: ${dialog.message}`);
    await (answers.shift() === 'dismiss' ? dialog.dismiss() : dialog.accept());
  }, async () => {
    const row = page.getByTestId('settings-delete-account');
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await expect.poll(() => said.length).toBe(expected);
  });
  return said;
}

test('an account deletes itself from Settings after both questions and is signed out', async ({ page }) => {
  const requests = await answerDeletion(page, 200);
  await openSettingsSignedIn(page);
  const said = await deleteAccount(page, ['accept', 'accept', 'accept']);
  expect(said).toEqual([`confirm: ${QUESTION}`, `confirm: ${SUBSCRIPTION}`, `alert: ${DELETED}`]);
  expect(requests).toEqual(['DELETE']);
  // Signed out, the app opens Capture, as after any sign-out: a check made on Settings before
  // that move could lose its screen. Back in Settings, it offers to sign in and the row is gone.
  await expect(page.getByTestId('screen.recording').filter({ visible: true })).toHaveCount(1);
  await page.getByTestId('tab.settings').filter({ visible: true }).click();
  await expect(page.getByTestId('settings-account-open-signin').filter({ visible: true })).toHaveCount(1);
  await expect(page.getByTestId('settings-delete-account')).toHaveCount(0);
});

test('declining either question keeps the account', async ({ page }) => {
  const requests = await answerDeletion(page, 200);
  await openSettingsSignedIn(page);
  expect(await deleteAccount(page, ['dismiss'])).toEqual([`confirm: ${QUESTION}`]);
  expect(await deleteAccount(page, ['accept', 'dismiss'])).toEqual([`confirm: ${QUESTION}`, `confirm: ${SUBSCRIPTION}`]);
  expect(requests).toEqual([]);
  await expect(page.getByTestId('settings-delete-account')).toBeEnabled();
  await expect(page.getByTestId('settings-account-open-signin').filter({ visible: true })).toHaveCount(0);
});

test('a deletion the server refuses says so and leaves the account signed in', async ({ page }) => {
  const requests = await answerDeletion(page, 500);
  await openSettingsSignedIn(page);
  const said = await deleteAccount(page, ['accept', 'accept', 'accept']);
  expect(said).toEqual([`confirm: ${QUESTION}`, `confirm: ${SUBSCRIPTION}`, `alert: ${FAILED}`]);
  expect(requests).toEqual(['DELETE']);
  await expect(page.getByTestId('settings-delete-account-loading')).toHaveCount(0);
  await expect(page.getByTestId('settings-delete-account')).toBeEnabled();
  await expect(page.getByTestId('settings-account-open-signin').filter({ visible: true })).toHaveCount(0);
});
