// A forgotten password: the sign-in form sends a reset link to a valid address, says so
// without revealing whether an account exists, and waits a minute before sending another.
// The link opens the reset page, which takes a new password of six characters or more,
// typed twice; a link this browser did not ask for is no longer valid. The mock has no
// mailbox: the link always "leaves", and the page is reached as the link would reach it.
import type { Page } from 'playwright/test';
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest({ tags: ['zone-connexion'] });

const SENT = 'If an account exists for this address, we sent a link to reset your password. Check your inbox and spam folder.';

async function start(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function home(page: Page) {
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await expect(page.getByTestId('screen.home')).toBeVisible();
}

async function openSignIn(page: Page) {
  await start(page);
  await home(page);
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.signin').click();
  await expect(signIn(page).getByTestId('btn.auth.signIn')).toBeVisible();
}

async function selectProfile(page: Page, profile: 'new' | 'existing' | 'plus') {
  await start(page);
  await home(page);
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId(`btn.mockProfile.${profile}`).click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

// Browser history keeps the session; a page load would start a new app launch.
async function openResetPage(page: Page) {
  await page.evaluate(() => {
    window.history.pushState({}, '', '/auth/reset-password');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
  await expect(resetPage(page)).toBeVisible();
}

const signIn = (page: Page) => page.getByTestId('screen.account');
const panel = (page: Page) => signIn(page).getByTestId('component.auth.forgotPasswordPanel');
const resetPage = (page: Page) => page.getByTestId('screen.auth.resetPassword');
// The send button carries no button role, so its state is read from the attribute.
const sendLink = (page: Page) => panel(page).getByTestId('btn.auth.sendPasswordReset');

test('a forgotten password asks for a valid email, then confirms the link without saying whether the account exists', { tags: ['smoke'] }, async ({ page }) => {
  await openSignIn(page);
  await signIn(page).getByTestId('btn.auth.forgotPassword').click();
  await expect(panel(page)).toContainText('Reset your password');
  await expect(panel(page)).toContainText('Enter your account email and we will send you a link to choose a new password.');
  await expect(panel(page).getByTestId('input.auth.forgotPasswordEmail')).toHaveValue('');
  await expect(sendLink(page)).toHaveAttribute('aria-disabled', 'true');
  // Cancel gives the sign-in form back.
  await panel(page).getByTestId('btn.auth.closeForgotPassword').click();
  await expect(panel(page)).toHaveCount(0);

  // The panel starts from the address typed in the sign-in form, here an incomplete one.
  await signIn(page).getByTestId('input.auth.email').fill('dreamer@example');
  await signIn(page).getByTestId('btn.auth.forgotPassword').click();
  const email = panel(page).getByTestId('input.auth.forgotPasswordEmail');
  await expect(email).toHaveValue('dreamer@example');
  await expect(sendLink(page)).toHaveAttribute('aria-disabled', 'true');
  await email.fill('dreamer@example.com');
  await expect(sendLink(page)).not.toHaveAttribute('aria-disabled', 'true');
  await sendLink(page).click();

  await expect(panel(page).getByTestId('text.auth.forgotPasswordStatus')).toHaveText(SENT);
  await expect(email).toHaveCount(0);
  await expect(sendLink(page)).toHaveCount(0);
  const done = panel(page).getByTestId('btn.auth.closeForgotPassword');
  await expect(done).toHaveText('Done');
  await done.click();
  await expect(panel(page)).toHaveCount(0);
  await expect(signIn(page).getByTestId('btn.auth.forgotPassword')).toHaveText('Forgot password?');
  await expect(signIn(page).getByTestId('input.auth.email')).toHaveValue('dreamer@example');
});

test('a second reset link waits a minute after the first', async ({ page }) => {
  await openSignIn(page);
  await signIn(page).getByTestId('btn.auth.forgotPassword').click();
  // Enter in the address sends the link, as the button does.
  await panel(page).getByTestId('input.auth.forgotPasswordEmail').fill('dreamer@example.com');
  await panel(page).getByTestId('input.auth.forgotPasswordEmail').press('Enter');
  await expect(panel(page).getByTestId('text.auth.forgotPasswordStatus')).toHaveText(SENT);
  await panel(page).getByTestId('btn.auth.closeForgotPassword').click();

  await signIn(page).getByTestId('btn.auth.forgotPassword').click();
  await expect(panel(page).getByTestId('input.auth.forgotPasswordEmail')).toHaveValue('');
  await panel(page).getByTestId('input.auth.forgotPasswordEmail').fill('dreamer@example.com');
  await expect(panel(page)).toContainText(/You can resend in \d+s/);
  await expect(sendLink(page)).toHaveAttribute('aria-disabled', 'true');

  const now = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(now + 61_000);
  await expect(panel(page)).not.toContainText('You can resend in');
  await expect(sendLink(page)).not.toHaveAttribute('aria-disabled', 'true');
  await sendLink(page).click();
  await expect(panel(page).getByTestId('text.auth.forgotPasswordStatus')).toHaveText(SENT);
});

test('a signed-in account sets a new password of six characters typed twice, then continues', async ({ page }) => {
  await selectProfile(page, 'existing');
  await openResetPage(page);
  const reset = resetPage(page);
  await expect(reset).toContainText('Choose a new password');
  await expect(reset).toContainText('Pick a new password for your account.');
  // The account's own session stands for the link: no address to confirm.
  await expect(reset.getByTestId('input.auth.recoveryEmail')).toHaveCount(0);
  const update = reset.getByTestId('btn.auth.updatePassword');
  const password = reset.getByTestId('input.auth.newPassword');
  const confirmation = reset.getByTestId('input.auth.confirmPassword');
  await expect(update).toBeDisabled();

  await password.fill('moon');
  await expect(reset).toContainText('Use at least 6 characters.');
  await expect(update).toBeDisabled();
  await password.fill('moonlit-1');
  await expect(reset).not.toContainText('Use at least 6 characters.');
  await confirmation.fill('moonlit-2');
  await expect(reset).toContainText('The passwords do not match.');
  await expect(update).toBeDisabled();

  // One eye shows and hides both fields.
  await expect(password).toHaveAttribute('type', 'password');
  await reset.getByTestId('btn.auth.togglePassword').click();
  await expect(password).not.toHaveAttribute('type', 'password');
  await expect(confirmation).not.toHaveAttribute('type', 'password');
  await reset.getByTestId('btn.auth.togglePassword').click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(confirmation).toHaveAttribute('type', 'password');

  await confirmation.fill('moonlit-1');
  await expect(reset).not.toContainText('The passwords do not match.');
  await expect(update).toBeEnabled();
  await update.click();
  await expect(reset).toContainText('Password updated');
  await expect(reset).toContainText('Your new password is saved and you are signed in.');
  await expect(password).toHaveCount(0);
  const next = reset.getByTestId('btn.auth.resetContinue');
  await expect(next).toHaveText('Continue');
  await next.click();
  await expect(page.getByTestId('screen.recording').filter({ visible: true })).toHaveCount(1);
});

test('a reset link opened in a browser that did not ask for it is no longer valid and leads back to sign in', async ({ page }) => {
  await start(page);
  // A recovery code proves nothing without the request this browser would have kept.
  await page.goto('/auth/reset-password?code=e2e-unrequested-recovery-code', { waitUntil: 'domcontentloaded' });
  const reset = resetPage(page);
  await expect(reset).toContainText('This link is no longer valid');
  await expect(reset).toContainText('Reset links expire quickly and can only be used once. Go back to sign in and request a new one.');
  await expect(page).toHaveURL(/\/auth\/reset-password$/);
  await expect(reset.getByTestId('input.auth.newPassword')).toHaveCount(0);
  await reset.getByTestId('btn.auth.resetBackToSignIn').click();
  await expect(page.getByTestId('screen.settings')).toBeVisible();
  await expect(page.getByTestId('settings-account-open-signin')).toBeVisible();
});

test('a reset link asks for its account email before the new password can be saved', async ({ page }) => {
  await start(page);
  await page.goto('/auth/reset-password?token_hash=e2e-synthetic-recovery-hash&type=recovery', { waitUntil: 'domcontentloaded' });
  const reset = resetPage(page);
  await expect(reset).toContainText('Enter the email address that received this reset link to confirm the account.');
  const email = reset.getByTestId('input.auth.recoveryEmail');
  const update = reset.getByTestId('btn.auth.updatePassword');
  await reset.getByTestId('input.auth.newPassword').fill('moonlit-1');
  await reset.getByTestId('input.auth.confirmPassword').fill('moonlit-1');
  await expect(update).toBeDisabled();
  await email.fill('dreamer@example');
  await expect(update).toBeDisabled();
  await email.fill('dreamer@example.com');
  await expect(update).toBeEnabled();
  // Saving redeems the link with the auth service, which the mock does not run.
});
