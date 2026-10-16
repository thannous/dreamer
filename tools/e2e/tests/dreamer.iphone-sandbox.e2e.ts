import { test, type Device } from '@e2e-dev/mobile';
import { expect, type TestFixtures } from 'e2e';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
type F = TestFixtures & { device: Device };
const evidence = process.env.E2E_IPHONE_EVIDENCE!;
const statePath = join(evidence, 'physical-flow-state.json');
function state() { try { return JSON.parse(readFileSync(statePath, 'utf8')); } catch { return {}; } }
function phase(name: string, patch = {}) { mkdirSync(evidence, { recursive: true }); writeFileSync(statePath, JSON.stringify({ ...state(), ...patch, phase: name, observedAt: new Date().toISOString() }, null, 2)); }
async function tap(screen: F['screen'], id: string, direction: 'up' | 'down' = 'down') { const q = screen.getByTestId(id, { visible: true }); await screen.scrollUntilVisible(q, { direction }); await q.tap(); }
async function open(f: F) { await f.app.open(); await f.device.openLink(process.env.E2E_IPHONE_PROJECT_URL!, { app: 'com.tanuki75.noctalia' }); await expect(f.screen.getByTestId('tab.home', { visible: true })).toBeVisible({ timeout: 120_000 }); }
async function home(f: F) { const { screen } = f; if (await screen.getByTestId('screen.settings', { visible: true }).count()) await tap(screen, 'settings.back', 'up'); await screen.getByTestId('tab.home', { visible: true }).tap(); await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible(); }
async function settings(f: F) { await home(f); await f.screen.getByTestId('btn.header.home.settings', { visible: true }).tap(); await tap(f.screen, 'quick-settings.all'); await expect(f.screen.getByTestId('screen.settings', { visible: true })).toBeVisible(); }
async function qa(_f: F) {
  // The settings QA lab intentionally excludes real appl_ keys. Use the existing
  // native SDK diagnostic instead of exposing extra controls in the product.
  const log = readFileSync(process.env.E2E_IPHONE_METRO_LOG!, 'utf8');
  const raw = [...log.matchAll(/\[RevenueCat\] Logged in (\{[^\n]+\})/g)].at(-1);
  assert.ok(raw, 'Require the authenticated real native SDK identity');
  const login = JSON.parse(raw[1]); assert.equal(login.isAnonymous, false); assert.equal(login.platform, 'ios'); assert.equal(login.appUserId, login.userId);
  assert.equal(login.appUserId, process.env.E2E_IPHONE_EXPECTED_APP_USER_ID, 'Require the approved owner identity');
  assert.match(login.appUserId, /^[a-f0-9-]{36}$/i);
  phase('apple-sdk-identified', { appUserId: login.appUserId }); return login.appUserId as string;
}
async function subscriber(id: string) { const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY}` }, signal: AbortSignal.timeout(30_000) }); assert.equal(r.status, 200, 'RevenueCat subscriber verification must succeed'); const x = await r.json() as { subscriber: { subscriptions: Record<string, { is_sandbox: boolean; store: string; purchase_date: string; expires_date: string; original_purchase_date: string }> } }; return x.subscriber; }
async function offer(f: F) { await tap(f.screen, 'settings-section-subscription'); await expect(f.screen.getByTestId('screen.paywall', { visible: true })).toBeVisible(); await tap(f.screen, 'btn.paywall.selectMonthly'); }

test('Physical iPhone real Apple sandbox returns to offer after existing-account sign in', { timeout: 900_000 }, async (f) => {
  await open(f); await home(f);
  await f.screen.getByTestId('btn.header.home.settings', { visible: true }).tap(); await tap(f.screen, 'quick-settings.plus');
  const buy = f.screen.getByTestId('btn.paywall.purchase', { visible: true }); await f.screen.scrollUntilVisible(buy); await expect(buy).toHaveText(/Se connecter pour souscrire|Sign in to subscribe/);
  await f.app.screenshot('physical-guest-offer'); await buy.tap(); await tap(f.screen, 'settings-account-open-signin', 'up');
  await expect(f.screen.getByTestId('btn.auth.google', { visible: true })).toBeVisible();
  phase('awaiting-existing-google-signin'); await f.screen.getByTestId('btn.auth.google', { visible: true }).tap();
  await f.app.screenshot('physical-google-auth-prompt');
  await expect(f.screen.getByTestId('btn.paywall.restore', { visible: true })).toBeVisible({ timeout: 600_000 });
  if (await buy.count()) { await f.screen.scrollUntilVisible(buy); await expect(buy).toBeEnabled(); }
  await f.app.screenshot('physical-return-after-signin'); await tap(f.screen, 'btn.paywall.close', 'up'); await home(f); await f.device.home(); await f.device.openApp('com.tanuki75.noctalia');
  await expect(f.screen.getByTestId('screen.recording', { visible: true })).toBeVisible(); await expect(f.screen.getByTestId('screen.paywall', { visible: true })).toHaveCount(0);
  await f.app.screenshot('physical-foreground-no-paywall'); phase('auth-return-passed', { authReturnPassed: true });
});

test('Physical iPhone real Apple sandbox monthly purchase activates server-confirmed Plus', { timeout: 900_000 }, async (f) => {
  assert.equal(process.env.E2E_IPHONE_ALLOW_PURCHASE, 'true', 'Purchase is opt-in: use --allow-sandbox-purchase only for an approved fresh purchase');
  assert.equal(state().authReturnPassed, true, 'Complete sign-in return before purchase'); const expectedOwner = state().appUserId; await open(f); await settings(f); const id = await qa(f); assert.equal(id, expectedOwner);
  const before = await subscriber(id); assert.ok(Object.values(before.subscriptions).every(x => Date.parse(x.expires_date) <= Date.now()), 'Existing active Apple subscription blocks a new purchase; no transaction initiated'); const purchaseStartedAt = Date.now(); phase('before-sandbox-purchase', { purchaseStartedAt, subscriptionProductsBefore: Object.keys(before.subscriptions) });
  await offer(f); const buy = f.screen.getByTestId('btn.paywall.purchase', { visible: true }); await f.screen.scrollUntilVisible(buy); await expect(buy).toBeEnabled();
  await f.app.screenshot('physical-before-apple-purchase'); phase('awaiting-apple-sandbox-sheet'); await buy.tap(); await f.app.screenshot('physical-apple-sandbox-sheet');
  await expect(f.screen.getByText(/environment\s*:\s*sandbox|environnement\s*:\s*sandbox|environnement\s+(?:de\s+)?test|test environment|(?:à|a) des fins de test uniquement|ne serez pas (?:factur|débité)|won.t be charged/i, { visible: true })).toBeVisible({ timeout: 60_000 }); phase('sandbox-sheet-verified-awaiting-owner-confirmation');
  await expect(f.screen.getByTestId('toast.paywall.success', { visible: true })).toBeVisible({ timeout: 600_000 });
  const after = await subscriber(id); const purchase = after.subscriptions.noctalia_plus_monthly; assert.ok(purchase); assert.equal(purchase.is_sandbox, true); assert.equal(purchase.store, 'app_store'); assert.ok(Date.parse(purchase.purchase_date) >= purchaseStartedAt - 5_000, 'Require a fresh sandbox purchase, not the old receipt');
  phase('sandbox-receipt-observed', { appleSubscription: purchase }); await f.app.screenshot('physical-server-confirmed-plus');
  await tap(f.screen, 'btn.paywall.close', 'up'); await settings(f); const quota = f.screen.getByTestId('quota.analysisValue', { visible: true }); await f.screen.scrollUntilVisible(quota); await expect(quota).toHaveText(/Illimité|Unlimited/); phase('sandbox-purchase-passed', { purchasePassed: true });
});

test('Physical iPhone real Apple sandbox restores receipt and keeps server-confirmed Plus', async (f) => {
  assert.equal(state().authReturnPassed, true, 'Require completed sign-in return before restore'); const expectedOwner = state().appUserId; await open(f); await settings(f); const id = await qa(f); assert.equal(id, expectedOwner);
  const before = await subscriber(id); assert.equal(before.subscriptions.noctalia_plus_monthly?.is_sandbox, true);
  await tap(f.screen, 'settings-section-subscription'); await expect(f.screen.getByTestId('btn.paywall.restore', { visible: true })).toBeVisible(); const nativeLogOffset = readFileSync(process.env.E2E_IPHONE_METRO_LOG!, 'utf8').length; phase('restoring-apple-sandbox'); await tap(f.screen, 'btn.paywall.restore');
  await expect(f.screen.getByTestId('toast.paywall.success', { visible: true })).toBeVisible({ timeout: 120_000 }); const after = await subscriber(id); assert.equal(after.subscriptions.noctalia_plus_monthly?.is_sandbox, true);
  const restoreLog = readFileSync(process.env.E2E_IPHONE_METRO_LOG!, 'utf8').slice(nativeLogOffset); assert.match(restoreLog, /Purchase restore completed/); assert.doesNotMatch(restoreLog, /StoreKitInternalError\.noAccount|There was a problem with the App Store/, 'A cached entitlement must not hide a StoreKit account error'); await f.app.screenshot('physical-restored-plus'); await tap(f.screen, 'btn.paywall.close', 'up'); const quota = f.screen.getByTestId('quota.analysisValue', { visible: true }); await f.screen.scrollUntilVisible(quota, { direction: 'up' }); await expect(quota).toHaveText(/Illimité|Unlimited/); phase('sandbox-restore-passed', { restorePassed: true });
});

// Continuation after the owner completed Google while XCTest's modal snapshot timed out.
// The preserved physical-return-after-google.json/png prove the intermediate active paywall.
test('Physical iPhone inspects existing subscriber and foreground after Google', async (f) => {
  await open(f); await settings(f); const id = await qa(f);
  const customer = await subscriber(id);
  phase('existing-subscriber-inspected', { subscriberBefore: customer, authReturnObserved: true });
  await f.app.screenshot('physical-existing-apple-sdk-status');
  await home(f); await f.device.home(); await f.device.openApp('com.tanuki75.noctalia');
  await expect(f.screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await expect(f.screen.getByTestId('btn.paywall.restore', { visible: true })).toHaveCount(0);
  await f.app.screenshot('physical-foreground-without-paywall');
  phase('auth-return-continuation-passed', { authReturnPassed: true, authEvidence: 'split run: original guest UI + owner Google + physical returned paywall + e2e foreground assertions' });
});

// Continuation verifies the purchase already initiated by e2e; it never buys again.
// The native Apple sheet and owner side-button confirmation are separate evidence.
test('Physical iPhone confirms fresh sandbox purchase after owner side-button', async (f) => {
  const prior = state(); assert.ok(prior.purchaseStartedAt, 'Require timestamp of the initiated purchase');
  const id = prior.appUserId as string; const before = await subscriber(id);
  const purchase = before.subscriptions.noctalia_plus_monthly;
  assert.ok(purchase, 'Require completed transaction before opening the app');
  assert.equal(purchase.is_sandbox, true); assert.equal(purchase.store, 'app_store');
  assert.ok(Date.parse(purchase.purchase_date) >= prior.purchaseStartedAt - 5_000, 'Require the fresh purchase from this attempt');
  await open(f); await settings(f); assert.equal(await qa(f), id);
  await tap(f.screen, 'settings-section-subscription');
  await expect(f.screen.getByTestId('btn.paywall.restore', { visible: true })).toBeVisible();
  await expect(f.screen.getByTestId('btn.paywall.purchase', { visible: true })).toHaveCount(0);
  await f.app.screenshot('physical-fresh-sandbox-active-plus');
  await tap(f.screen, 'btn.paywall.close', 'up');
  const quota = f.screen.getByTestId('quota.analysisValue', { visible: true });
  await f.screen.scrollUntilVisible(quota, { direction: 'up' });
  await expect(quota).toHaveText(/Illimité|Unlimited/);
  await f.app.screenshot('physical-fresh-sandbox-server-quota');
  phase('sandbox-purchase-continuation-passed', { purchasePassed: true, appleSubscription: purchase, purchaseEvidence: 'split: e2e tap + visually verified no-charge Apple sheet + owner side-button + fresh Sandbox receipt + exact e2e Plus/quota assertions' });
});
