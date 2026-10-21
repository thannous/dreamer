import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { test as base } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import type { App, Screen } from 'e2e';
import { expect, secrets } from 'e2e';
import { assertBackendTarget } from '../../scripts/lib/backend-e2e-local.cjs';

// The outer runner owns this disposable stack. Refuse any remote target before
// constructing clients; service-role credentials stay in Node, outside browser reports.
const status = JSON.parse(readFileSync(process.env.E2E_BACKEND_STATUS_FILE!, 'utf8'));
export const backendUrl = assertBackendTarget(status);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
export const admin = createClient(backendUrl.href, status.SERVICE_ROLE_KEY, options);
export const client = () => createClient(backendUrl.href, status.ANON_KEY, options);
export type Account = { id: string; email: string; password: string };
export type BackendUI = { app: App; screen: Screen; browser: Browser };

export async function login({ app, screen }: BackendUI, account: Account) {
  await app.open('/');
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  await screen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).tap();
  await screen.getByTestId('btn.header.home.settings').tap();
  await screen.getByTestId('quick-settings.all').tap();
  await screen.getByTestId('settings-account-open-signin').tap();
  await screen.getByTestId('input.auth.email').fill(account.email);
  await screen.getByTestId('input.auth.password').fill(secrets.get('backendPassword'));
  await screen.getByTestId('btn.auth.signIn').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  await screen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).tap();
  await screen.getByTestId('btn.header.home.settings').tap();
  await screen.getByTestId('quick-settings.all').tap();
  await expect(screen.getByTestId('text.auth.email')).toContainText(account.email);
  await expect(screen.getByTestId('screen.subscription.qaLab')).toHaveCount(0);
}

export async function journal({ screen }: BackendUI) {
  const back = screen.getByTestId('btn.navigateJournal', { visible: true });
  if (await back.isVisible()) await back.tap();
  else {
    const settingsBack = screen.getByTestId('settings.back', { visible: true });
    if (await settingsBack.isVisible()) await settingsBack.tap();
    const home = screen.getByTestId('btn.recording.home', { visible: true });
    if (await home.isVisible()) await home.tap();
    await screen.getByRole('button', 'Journal').tap();
  }
  await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
}

export const test = base.extend<{ accounts: { free: Account; other: Account; plus: Account } }>({
  accounts: async ({ browser, app }, provide) => {
    await browser.route('**/*', async route => {
      const url = new URL(route.request.url);
      if (url.origin === new URL(app.baseUrl!).origin ||
          (url.origin === backendUrl.origin && !url.pathname.startsWith('/functions/'))) await route.continue();
      else await route.abort();
    });
    await browser.setViewport({ width: 1280, height: 720 });
    const created: Account[] = [];
    try {
      const password = readFileSync(process.env.E2E_BACKEND_PASSWORD_FILE!, 'utf8');
      for (const tier of ['free', 'free', 'plus']) {
        const email = `e2e-${randomUUID()}@example.test`;
        const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (result.error) throw result.error;
        const account = { id: result.data.user.id, email, password };
        created.push(account);
        if (tier === 'plus') {
          const entitlement = await admin.rpc('apply_subscription_state_update', {
            p_user_id: account.id, p_tier: 'plus', p_is_active: true,
            p_source: 'local-e2e-fixture', p_source_event_id: randomUUID(),
          });
          if (entitlement.error) throw entitlement.error;
        }
      }
      await provide({ free: created[0], other: created[1], plus: created[2] });
    } finally {
      const errors: unknown[] = [];
      for (const account of created) {
        const dreams = await admin.from('dreams').delete().eq('user_id', account.id);
        if (dreams.error) errors.push(dreams.error);
        const result = await admin.auth.admin.deleteUser(account.id);
        if (result.error) errors.push(result.error);
      }
      if (errors.length) throw new AggregateError(errors, 'Disposable backend account cleanup failed');
    }
  },
});
export { expect };
