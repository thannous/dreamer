// A forgotten password: the sign-in form sends a reset link to a valid address, says so
// without revealing whether an account exists, and waits a minute before sending another.
// The link opens the reset page, which takes a new password of six characters or more,
// typed twice; a link this browser did not ask for is no longer valid. The mock has no
// mailbox: the link always "leaves", and the page is reached as the link would reach it.
import type { Browser } from '@e2e-dev/web';
import type { Screen } from 'e2e';
import { expect } from 'e2e';
import { journeyTest } from '../traced-parity-test';
import { openHome, selectProfile, startGuest } from '../web-journeys';
const test = journeyTest({ tags: ['zone-connexion'] });

const SENT = 'If an account exists for this address, we sent a link to reset your password. Check your inbox and spam folder.';

async function openSignIn(screen: Screen, browser: Browser) {
  await startGuest(screen, browser);
  await openHome(screen);
  await screen.getByTestId('btn.header.home.settings').tap();
  await screen.getByTestId('quick-settings.signin').tap();
  await expect(signIn(screen).getByTestId('btn.auth.signIn')).toBeVisible();
}

// Browser history keeps the session; a page load would start a new app launch.
async function openResetPage(screen: Screen, browser: Browser) {
  await browser.evaluate(() => {
    window.history.pushState({}, '', '/auth/reset-password');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    return null;
  });
  await expect(resetPage(screen)).toBeVisible();
}

const signIn = (screen: Screen) => screen.getByTestId('screen.account');
const panel = (screen: Screen) => signIn(screen).getByTestId('component.auth.forgotPasswordPanel');
const resetPage = (screen: Screen) => screen.getByTestId('screen.auth.resetPassword');
// The send button carries no button role, so its state is read from the attribute.
const sendLink = (screen: Screen) => panel(screen).getByTestId('btn.auth.sendPasswordReset');
// e2e withholds a password field's attributes; a masked field is one still typed password.
const masked = (browser: Browser, testId: string) => browser.locator(`input[data-testid="${testId}"][type="password"]`);

test('a forgotten password asks for a valid email, then confirms the link without saying whether the account exists', { tags: ['smoke'] }, async ({ screen, browser }) => {
  await openSignIn(screen, browser);
  await signIn(screen).getByTestId('btn.auth.forgotPassword').tap();
  await expect(panel(screen)).toContainText('Reset your password');
  await expect(panel(screen)).toContainText('Enter your account email and we will send you a link to choose a new password.');
  await expect(panel(screen).getByTestId('input.auth.forgotPasswordEmail')).toHaveValue('');
  await expect(sendLink(screen)).toHaveAttribute('aria-disabled', 'true');
  // Cancel gives the sign-in form back.
  await panel(screen).getByTestId('btn.auth.closeForgotPassword').tap();
  await expect(panel(screen)).toHaveCount(0);

  // The panel starts from the address typed in the sign-in form, here an incomplete one.
  await signIn(screen).getByTestId('input.auth.email').fill('dreamer@example');
  await signIn(screen).getByTestId('btn.auth.forgotPassword').tap();
  const email = panel(screen).getByTestId('input.auth.forgotPasswordEmail');
  await expect(email).toHaveValue('dreamer@example');
  await expect(sendLink(screen)).toHaveAttribute('aria-disabled', 'true');
  await email.fill('dreamer@example.com');
  await expect(sendLink(screen)).not.toHaveAttribute('aria-disabled', 'true');
  await sendLink(screen).tap();

  await expect(panel(screen).getByTestId('text.auth.forgotPasswordStatus')).toHaveText(SENT);
  await expect(email).toHaveCount(0);
  await expect(sendLink(screen)).toHaveCount(0);
  const done = panel(screen).getByTestId('btn.auth.closeForgotPassword');
  await expect(done).toHaveText('Done');
  await done.tap();
  await expect(panel(screen)).toHaveCount(0);
  await expect(signIn(screen).getByTestId('btn.auth.forgotPassword')).toHaveText('Forgot password?');
  await expect(signIn(screen).getByTestId('input.auth.email')).toHaveValue('dreamer@example');
});

test('a second reset link waits a minute after the first', async ({ screen, browser }) => {
  await openSignIn(screen, browser);
  await signIn(screen).getByTestId('btn.auth.forgotPassword').tap();
  // Enter in the address sends the link, as the button does.
  const email = panel(screen).getByTestId('input.auth.forgotPasswordEmail');
  await email.fill('dreamer@example.com');
  await email.press('Enter');
  await expect(panel(screen).getByTestId('text.auth.forgotPasswordStatus')).toHaveText(SENT);
  await panel(screen).getByTestId('btn.auth.closeForgotPassword').tap();

  await signIn(screen).getByTestId('btn.auth.forgotPassword').tap();
  await expect(email).toHaveValue('');
  await email.fill('dreamer@example.com');
  await expect(panel(screen)).toContainText(/You can resend in \d+s/);
  await expect(sendLink(screen)).toHaveAttribute('aria-disabled', 'true');

  // e2e has no clock yet; the cooldown counts with Date.now(), so move it a minute on.
  await browser.evaluate(() => {
    const now = Date.now;
    Date.now = () => now() + 61_000;
    return null;
  });
  await expect(panel(screen)).not.toContainText('You can resend in');
  await expect(sendLink(screen)).not.toHaveAttribute('aria-disabled', 'true');
  await sendLink(screen).tap();
  await expect(panel(screen).getByTestId('text.auth.forgotPasswordStatus')).toHaveText(SENT);
});

test('a signed-in account sets a new password of six characters typed twice, then continues', async ({ screen, browser }) => {
  await selectProfile(screen, browser, 'existing');
  await openResetPage(screen, browser);
  const reset = resetPage(screen);
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
  await expect(masked(browser, 'input.auth.newPassword')).toHaveCount(1);
  await reset.getByTestId('btn.auth.togglePassword').tap();
  await expect(masked(browser, 'input.auth.newPassword')).toHaveCount(0);
  await expect(masked(browser, 'input.auth.confirmPassword')).toHaveCount(0);
  await reset.getByTestId('btn.auth.togglePassword').tap();
  await expect(masked(browser, 'input.auth.newPassword')).toHaveCount(1);
  await expect(masked(browser, 'input.auth.confirmPassword')).toHaveCount(1);

  await confirmation.fill('moonlit-1');
  await expect(reset).not.toContainText('The passwords do not match.');
  await expect(update).toBeEnabled();
  await update.tap();
  await expect(reset).toContainText('Password updated');
  await expect(reset).toContainText('Your new password is saved and you are signed in.');
  await expect(password).toHaveCount(0);
  const next = reset.getByTestId('btn.auth.resetContinue');
  await expect(next).toHaveText('Continue');
  await next.tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toHaveCount(1);
});

test('a reset link opened in a browser that did not ask for it is no longer valid and leads back to sign in', async ({ screen, browser }) => {
  await startGuest(screen, browser);
  // A recovery code proves nothing without the request this browser would have kept.
  await browser.goto('/auth/reset-password?code=e2e-unrequested-recovery-code', { waitUntil: 'domcontentloaded' });
  const reset = resetPage(screen);
  await expect(reset).toContainText('This link is no longer valid');
  await expect(reset).toContainText('Reset links expire quickly and can only be used once. Go back to sign in and request a new one.');
  await expect(browser).toHaveURL(/\/auth\/reset-password$/);
  await expect(reset.getByTestId('input.auth.newPassword')).toHaveCount(0);
  await reset.getByTestId('btn.auth.resetBackToSignIn').tap();
  await expect(screen.getByTestId('screen.settings')).toBeVisible();
  await expect(screen.getByTestId('settings-account-open-signin')).toBeVisible();
});

test('a reset link asks for its account email before the new password can be saved', async ({ screen, browser }) => {
  await startGuest(screen, browser);
  await browser.goto('/auth/reset-password?token_hash=e2e-synthetic-recovery-hash&type=recovery', { waitUntil: 'domcontentloaded' });
  const reset = resetPage(screen);
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
