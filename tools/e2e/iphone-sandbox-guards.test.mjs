import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTEMPT_TTL_MS, assertCleanSource, assertMetroRoot, assertDeviceBinding, currentOwner, assertPendingAttempt, verifyPurchase } from './iphone-sandbox-guards.ts';

// These regressions cannot be exercised safely as real purchases on the personal
// phone: foreign targets, abandoned attempts, stale identity and stale receipts.
const owner = '00000000-0000-4000-8000-000000000001';
const now = Date.parse('2026-10-16T10:00:00Z');
function fixture() {
  const attempt = { id: 'attempt-a', campaignId: 'campaign-a', ownerId: owner, product: 'noctalia_plus_monthly', startedAt: now - 20_000, expiresAt: now - 20_000 + ATTEMPT_TTL_MS, sourceRevision: 'source-a' };
  const attestation = { attemptId: attempt.id, campaignId: attempt.campaignId, ownerId: owner, product: attempt.product, transactionId: 'txn-a', confirmedAt: now - 5_000, sheetObservedAt: now - 10_000, noChargeSheetVerified: true, ownerSideButtonConfirmed: true, sheetEvidence: '/private/qa-sheet.png', sheetEvidenceSha256: 'a'.repeat(64) };
  const transaction = { transactionId: 'txn-a', transactionReason: 'PURCHASE', environment: 'Sandbox', bundleId: 'com.tanuki75.noctalia', productId: attempt.product, appAccountToken: owner, purchaseDate: now - 5_000 };
  const subscription = { is_sandbox: true, store: 'app_store', store_transaction_id: 'txn-a', purchase_date: new Date(transaction.purchaseDate).toISOString(), expires_date: new Date(now + 60_000).toISOString(), original_purchase_date: new Date(transaction.purchaseDate).toISOString() };
  return { attempt, attestation, transaction, subscription };
}
const login = (id = owner) => '[RevenueCat] Logged in ' + JSON.stringify({ userId: id, appUserId: id, platform: 'ios', isAnonymous: false });

test('dirty tracked or untracked source cannot be attributed to clean HEAD', () => {
  assert.doesNotThrow(() => assertCleanSource(''));
  assert.throws(() => assertCleanSource(' M app/paywall.tsx\n'));
  assert.throws(() => assertCleanSource('?? app/experimental.tsx\n'));
});
test('another Metro worktree or an unidentified listener cannot qualify this source', () => {
  assert.doesNotThrow(() => assertMetroRoot(['/qa/ours'], '/qa/ours'));
  assert.throws(() => assertMetroRoot(['/qa/other'], '/qa/ours'));
  assert.throws(() => assertMetroRoot([], '/qa/ours'));
});
test('name/UDID mismatch, duplicate names and simulator targets are refused', () => {
  const phone = { deviceProperties: { name: 'Owned QA' }, hardwareProperties: { udid: 'owned-udid', reality: 'physical' } };
  assert.doesNotThrow(() => assertDeviceBinding([phone], 'Owned QA', 'owned-udid'));
  assert.throws(() => assertDeviceBinding([phone], 'Owned QA', 'other-udid'));
  assert.throws(() => assertDeviceBinding([phone, phone], 'Owned QA', 'owned-udid'));
  assert.throws(() => assertDeviceBinding([{ ...phone, hardwareProperties: { udid: 'owned-udid', reality: 'simulated' } }], 'Owned QA', 'owned-udid'));
});
test('fresh identity returns the owner for a previously empty auth fixture', () => {
  assert.equal(currentOwner(login(), owner), owner);
});
test('a later logout, another login or no fresh event rejects the old owner', () => {
  assert.throws(() => currentOwner(login() + '\n[RevenueCat] Logged out {"isAnonymous":true}', owner));
  assert.throws(() => currentOwner(login() + '\n' + login('other-owner'), owner));
  assert.throws(() => currentOwner('', owner));
  assert.throws(() => currentOwner(login() + '\n[RevenueCat] Logged in {broken}', owner));
});
test('pending attempt must be current, explicit, source-bound and not consumed', () => {
  const { attempt } = fixture();
  const check = value => assertPendingAttempt(value, 'attempt-a', 'campaign-a', owner, 'source-a', now);
  assert.doesNotThrow(() => check(attempt));
  for (const invalid of [undefined, { ...attempt, id: 'other-attempt' }, { ...attempt, campaignId: 'other-campaign' }, { ...attempt, sourceRevision: 'other-source' }, { ...attempt, completedAt: now - 1 }, { ...attempt, startedAt: now - 2 * ATTEMPT_TTL_MS, expiresAt: now - 1 }, { ...attempt, expiresAt: attempt.startedAt + 2 * ATTEMPT_TTL_MS }]) assert.throws(() => check(invalid));
});
test('new purchase requires recorded human observation and physical confirmation for this attempt', () => {
  const x = fixture();
  for (const patch of [{ noChargeSheetVerified: false }, { ownerSideButtonConfirmed: false }, { attemptId: 'old-attempt' }, { campaignId: 'old-campaign' }, { transactionId: 'other-txn' }, { sheetEvidenceSha256: '' }, { confirmedAt: now + 1000 }, { sheetObservedAt: x.attempt.startedAt - 1 }]) {
    assert.throws(() => verifyPurchase(x.attempt, { ...x.attestation, ...patch }, x.transaction, x.subscription, now));
  }
  assert.equal(verifyPurchase(x.attempt, x.attestation, x.transaction, x.subscription, now), x.subscription);
});
test('a renewal or unrelated later purchase cannot satisfy the pending confirmation', () => {
  const x = fixture();
  for (const patch of [{ transactionReason: 'RENEWAL' }, { transactionId: 'other-txn' }, { purchaseDate: now + 60_000 }, { appAccountToken: 'other-owner' }, { environment: 'Production' }]) {
    assert.throws(() => verifyPurchase(x.attempt, x.attestation, { ...x.transaction, ...patch }, x.subscription, now));
  }
});
test('an eventually consistent old provider receipt is rejected until the matching transaction arrives', () => {
  const x = fixture();
  assert.throws(() => verifyPurchase(x.attempt, x.attestation, x.transaction, { ...x.subscription, store_transaction_id: 'prior-txn' }, now));
  assert.throws(() => verifyPurchase(x.attempt, x.attestation, x.transaction, { ...x.subscription, purchase_date: new Date(now - 60_000).toISOString() }, now));
  assert.equal(verifyPurchase(x.attempt, x.attestation, x.transaction, x.subscription, now), x.subscription);
});
