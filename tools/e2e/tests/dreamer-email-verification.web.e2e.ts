// A new account must confirm its address before it is signed in. The dialog names the address,
// waits, and lets the reader ask for the email again after a minute; closing it leaves a reminder
// on the sign-in form. The mock has no mailbox: an address tagged "+verify" signs up unconfirmed,
// and asking for the email again stands for the reader opening its link (lib/mockAuth.ts).
import type { Page } from 'playwright/test';
import { createParityTest, expect, leaveOnboarding } from '../web-parity-fixtures';
const test = createParityTest({ tags: ['zone-connexion'] });

const EMAIL = 'new.dreamer+verify@example.com';
// The sign-in form keeps its own reminder behind the dialog: the dialog is the one with "Done".
const resend = (page: Page) => page.getByTestId('btn.auth.resendVerification');
const done = (page: Page) => page.getByTestId('btn.auth.closeVerification');

async function signUp(page: Page) {
  // The installed clock holds the one-minute wait and the fifteen-second checks.
  await page.clock.install();
  await page.goto('/');
  await leaveOnboarding(page);
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-account-open-signup').click();
  await page.getByTestId('input.auth.email').fill(EMAIL);
  await page.getByTestId('input.auth.password').fill('secret123');
  await page.getByTestId('btn.auth.signUp').first().click();
  await expect(done(page)).toBeVisible();
}

test('an unconfirmed sign-up waits, sends the email again after a minute, then signs in once confirmed', async ({ page }) => {
  await signUp(page);
  await expect(page.getByText(`We sent a confirmation link to ${EMAIL}`)).toBeVisible();
  await expect(page.getByText('Waiting for confirmation...')).toBeVisible();
  await expect(resend(page).first()).toBeDisabled();
  await expect(page.getByText('You can resend in 59s').first()).toBeVisible();
  // Two checks pass without a confirmation: still waiting, still signed out.
  await page.clock.runFor(31_000);
  await expect(done(page)).toBeVisible();
  await expect(page.getByTestId('text.auth.email')).toHaveCount(0);
  await page.clock.runFor(30_000);
  await expect(resend(page).first()).toBeEnabled();
  await resend(page).first().click();
  // The next check finds the address confirmed: the dialog leaves and the account is signed in.
  await page.clock.runFor(20_000);
  await expect(done(page)).toHaveCount(0);
  await expect(page.getByTestId('screen.recording').filter({ visible: true })).toHaveCount(1);
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await expect(page.getByTestId('text.auth.email').filter({ visible: true })).toHaveText(EMAIL);
});

test('closing the confirmation dialog keeps the account signed out with a reminder on the form', async ({ page }) => {
  await signUp(page);
  await done(page).click();
  // The dialog leaves on a timer, and the installed clock only moves when told to. A closed
  // sheet stays in the page, hidden.
  await page.clock.runFor(1_000);
  await expect(done(page)).toBeHidden();
  await expect(page.getByText('Confirm your address to sync dreams and unlock analyses.')).toBeVisible();
  await expect(resend(page).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByTestId('text.auth.email')).toHaveCount(0);
  // Signing in with the unconfirmed address is still refused.
  await page.clock.runFor(31_000);
  await expect(page.getByTestId('text.auth.email')).toHaveCount(0);
  await expect(page.getByTestId('settings-account-open-signin').filter({ visible: true })).toHaveCount(1);
});
