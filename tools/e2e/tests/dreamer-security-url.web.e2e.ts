// The router can replay the initial URL after auth-js has cleared it. Exercise
// the actual web bootstrap so a bearer fragment never survives in the address bar.
// Synthetic values, mock app services and an external-request guard keep this off
// production services.
import { test, type Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { isolateWeb } from '../web-fixtures';

async function startGuest(app: App, screen: Screen, browser: Browser) {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next', { visible: true }).tap();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const off = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap(); }
    finally { await off(); }
  }
  await screen.getByTestId('btn.onboarding.skip', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
}

async function assertStillGuest(screen: Screen) {
  const home = screen.getByTestId('tab.home', { visible: true });
  if (await home.isVisible()) await home.tap();
  else await screen.getByTestId('btn.recording.home', { visible: true }).tap();
  await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
  await screen.getByTestId('quick-settings.all', { visible: true }).tap();
  await expect(screen.getByTestId('settings-account-open-signin', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('btn.auth.signOut')).toHaveCount(0);
}

test('security URL: injected bearer pair is removed and guest access stays guest', async ({ app, screen, browser }) => {
  await startGuest(app, screen, browser);
  await browser.goto('/recording?lang=fr#access_token=e2e-fake-access&refresh_token=e2e-fake-refresh&token_type=bearer');
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await expect(browser).toHaveURL('/recording?lang=fr');
  expect(await browser.evaluate(() => Object.values(localStorage).some(value =>
    value.includes('e2e-fake-access') || value.includes('e2e-fake-refresh')))).toBe(false);
  await assertStillGuest(screen);
});

test('security URL: code on an unrelated route causes no Supabase token exchange', async ({ app, screen, browser }) => {
  let tokenExchanges = 0;
  await startGuest(app, screen, browser);
  // Registered after the broad isolation route so an unexpected exchange is
  // counted, then aborted before it could reach any external service.
  await browser.route('**/auth/v1/token**', async route => {
    tokenExchanges++;
    await route.abort();
  });
  await browser.goto('/auth/callback/success?code=e2e-unrelated-code');
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  expect(tokenExchanges).toBe(0);
  await assertStillGuest(screen);
});

test('security URL: a recovery hash is removed before the reset form renders', async ({ app, screen, browser }) => {
  await startGuest(app, screen, browser);
  await browser.goto('/auth/reset-password?token_hash=e2e-fake-recovery-hash&type=recovery');
  await expect(browser).toHaveURL('/auth/reset-password');
  await expect(screen.getByTestId('input.auth.recoveryEmail', { visible: true })).toBeVisible();
  expect(await browser.evaluate(() => Object.values(localStorage).some(value =>
    value.includes('e2e-fake-recovery-hash')))).toBe(false);
  await expect(screen.getByTestId('btn.auth.signOut')).toHaveCount(0);
});
