import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { test as base, expect, type BrowserContext, type Page } from 'playwright/test';

const status = JSON.parse(readFileSync(process.env.E2E_BACKEND_STATUS_FILE!, 'utf8'));
const url = new URL(status.API_URL);
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== '56321') {
  throw new Error('Backend E2E only accepts the disposable local Supabase API on 127.0.0.1:56321');
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url.href, status.SERVICE_ROLE_KEY, options);

export const client = () => createClient(url.href, status.ANON_KEY, options);
export type Account = { id: string; email: string; password: string };

export async function restrictNetwork(context: BrowserContext) {
  await context.route('**/*', async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === 'http://127.0.0.1:8085' ||
        (requestUrl.origin === url.origin && !requestUrl.pathname.startsWith('/functions/'))) {
      return route.continue();
    }
    // Auth and PostgREST are real. AI, analytics, OAuth and payment traffic are blocked.
    await route.abort();
  });
}

export async function login(page: Page, account: Account) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  // Continue from the completed onboarding. Reloading here races its async
  // release-notes acknowledgement and can create a modal absent on first launch.
  await page.getByTestId('btn.recording.home').click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId('input.auth.email').fill(account.email);
  await page.getByTestId('input.auth.password').fill(account.password);
  await page.getByTestId('btn.auth.signIn').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await page.getByTestId('btn.recording.home').click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByTestId('text.auth.email')).toContainText(account.email);
  await expect(page.getByTestId('screen.subscription.qaLab')).toHaveCount(0);
}

export async function journal(page: Page) {
  const back = page.getByTestId('btn.navigateJournal');
  if (await back.isVisible()) await back.click();
  else {
    const settingsBack = page.getByTestId('settings.back');
    if (await settingsBack.isVisible()) await settingsBack.click();
    const home = page.getByTestId('btn.recording.home');
    if (await home.isVisible()) await home.click();
    await page.getByRole('button', { name: 'Journal', exact: true }).click();
  }
  await expect(page.getByTestId('screen.journal').filter({ visible: true })).toHaveCount(1);
}

export const test = base.extend<{ accounts: { free: Account; other: Account; plus: Account } }>({
  accounts: async ({ context }, provide) => {
    await restrictNetwork(context);
    const created: Account[] = [];
    try {
      for (const tier of ['free', 'free', 'plus']) {
        const email = `e2e-${randomUUID()}@example.test`;
        const password = `E2e!${randomUUID()}`;
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
      for (const account of created) {
        const dreams = await admin.from('dreams').delete().eq('user_id', account.id);
        if (dreams.error) throw dreams.error;
        const result = await admin.auth.admin.deleteUser(account.id);
        if (result.error) throw result.error;
      }
    }
  },
});

export { expect };
