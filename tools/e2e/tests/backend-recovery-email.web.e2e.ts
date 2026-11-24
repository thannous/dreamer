import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect } from 'e2e';
import type { Browser } from '@e2e-dev/web';
import type { Page } from 'playwright/test';
import { backendOrigin, client, mailOrigin, test } from '../backend-fixtures';

type MailSummary = { ID: string; To: { Address: string }[] };

async function mailJson<T>(origin: string, path: string): Promise<T> {
  const response = await fetch(new URL(path, origin), { redirect: 'error', signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`Local mailbox returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function recoveryLink(mailOrigin: string, recipient: string, appOrigin: string) {
  const search = new URL('/api/v1/search', mailOrigin);
  search.searchParams.set('query', `to:${recipient}`);
  const deadline = Date.now() + 20_000;
  do {
    // The fixture creates a fresh account. Any matching message belongs to this attempt.
    const { messages } = await mailJson<{ messages: MailSummary[] }>(mailOrigin, search.pathname + search.search);
    const matches = (messages ?? []).filter(message => message.To.some(to => to.Address === recipient));
    if (matches.length > 1) throw new Error('The local mailbox received more than one recovery email');
    if (matches.length === 1) {
      const id = matches[0].ID;
      if (!/^[\w-]+$/.test(id)) throw new Error('Invalid local message ID');
      const message = await mailJson<MailSummary & { HTML: string }>(mailOrigin, `/api/v1/message/${id}`);
      if (!message.To.some(to => to.Address === recipient)) throw new Error('Unexpected recovery recipient');
      const links = Array.from(message.HTML.matchAll(/href=["']([^"']+)["']/gi), match =>
        URL.parse(match[1].replaceAll('&amp;', '&')));
      const valid = links.filter(link => {
        if (!link || link.origin !== backendOrigin || link.pathname !== '/auth/v1/verify' ||
          link.username || link.password || link.hash || link.searchParams.get('type') !== 'recovery' ||
          !link.searchParams.get('token')) return false;
        const callback = URL.parse(link.searchParams.get('redirect_to') ?? '');
        return callback?.origin === appOrigin && callback.pathname === '/auth/reset-password';
      });
      if (valid.length !== 1 || !valid[0]) throw new Error('Expected one recovery link to this local app');
      return valid[0].href;
    }
    await delay(250);
  } while (Date.now() < deadline);
  throw new Error('No recovery email reached the local mailbox');
}

async function openRecoveryLink(browser: Browser, page: Page, link: string, appOrigin: string) {
  const entry = '/__e2e_recovery_mail';
  const route = new URL(entry, appOrigin).href;
  // Follow the actual Auth link without exposing the verification URL to the
  // browser log. Chromium still handles the returned callback and its PKCE state.
  const response = await fetch(link, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
    .catch(() => { throw new Error('The local Auth recovery link could not be opened'); });
  const callback = URL.parse(response.headers.get('location') ?? '');
  if (response.status < 300 || response.status >= 400 || callback?.origin !== appOrigin ||
    callback.pathname !== '/auth/reset-password' || callback.username || callback.password) {
    throw new Error('The local Auth verification did not redirect to this app');
  }
  // The SDK owns the navigation to the neutral URL and suppresses intermediate URLs.
  await page.route(route, handler => handler.fulfill({
    status: 302,
    headers: { location: callback.href, 'cache-control': 'no-store' },
  }));
  try {
    await browser.goto(entry, { waitUntil: 'networkidle', timeout: 20_000 });
    await page.waitForFunction(() =>
      location.pathname === '/auth/reset-password' &&
      !/[?#&](?:code|token|token_hash|access_token|refresh_token)=/i.test(location.search + location.hash),
    undefined, { timeout: 15_000 });
  } catch {
    await page.goto('about:blank', { timeout: 2_000 }).catch(() => undefined);
    throw new Error('The local recovery link did not reach the password reset screen');
  } finally {
    await page.unroute(route);
  }
}

describe('Password recovery through local email', { tags: ['auth-mail'] }, () => {
  test('the recovery email changes the password once for its owner', {
    skip: mailOrigin ? false : 'Start the owned mailbox with npm run test:e2e:backend -- --mail --tag auth-mail',
    timeout: 180_000,
  }, async ({ accounts, browser, page, screen }) => {
    const account = accounts.free;
    const newPassword = `E2e!${randomUUID()}`;
    const appOrigin = new URL(page.url()).origin;
    await screen.getByTestId('btn.onboarding.intro.next').tap();
    await screen.getByTestId('btn.onboarding.skip').tap();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await screen.getByTestId('btn.recording.home', { visible: true })
      .or(screen.getByTestId('tab.home', { visible: true })).tap();
    await screen.getByTestId('btn.header.home.settings').tap();
    await screen.getByTestId('quick-settings.signin').tap();
    await screen.getByTestId('btn.auth.forgotPassword').tap();
    await screen.getByTestId('input.auth.forgotPasswordEmail').fill(account.email);
    await screen.getByTestId('btn.auth.sendPasswordReset').tap();
    await expect(screen.getByTestId('text.auth.forgotPasswordStatus')).toBeVisible();

    const link = await recoveryLink(mailOrigin!, account.email, appOrigin);
    await openRecoveryLink(browser, page, link, appOrigin);
    const reset = screen.getByTestId('screen.auth.resetPassword');
    await reset.getByTestId('input.auth.recoveryEmail').fill(account.email);
    await page.getByTestId('input.auth.newPassword').fill(newPassword);
    await page.getByTestId('input.auth.confirmPassword').fill(newPassword);
    await reset.getByTestId('btn.auth.updatePassword').tap();
    await expect(reset.getByTestId('btn.auth.resetContinue')).toBeVisible();

    const verifier = client();
    try {
      const { data: oldSession, error: oldError } = await verifier.auth.signInWithPassword(account);
      expect(oldError?.code).toBe('invalid_credentials');
      expect(oldSession.session).toBeNull();
      const { data: newSession, error: newError } = await verifier.auth.signInWithPassword({
        email: account.email, password: newPassword,
      });
      expect(newError).toBeNull();
      expect(newSession.user?.id).toBe(account.id);
    } finally {
      await verifier.auth.signOut({ scope: 'local' });
    }
    await openRecoveryLink(browser, page, link, appOrigin);
    await expect(reset).toContainText('This link is no longer valid');
    await expect(reset.getByTestId('input.auth.newPassword')).toHaveCount(0);
  });
});
