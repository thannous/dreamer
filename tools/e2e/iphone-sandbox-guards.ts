import assert from 'node:assert/strict';

export const ATTEMPT_TTL_MS = 15 * 60_000;
export type Attempt = {
  id: string; campaignId: string; ownerId: string; product: string;
  startedAt: number; expiresAt: number; sourceRevision: string; completedAt?: number;
};
export type Attestation = {
  attemptId: string; campaignId: string; ownerId: string; product: string;
  transactionId: string; confirmedAt: number; sheetObservedAt: number;
  noChargeSheetVerified: boolean; ownerSideButtonConfirmed: boolean;
  sheetEvidence: string; sheetEvidenceSha256: string;
};
export type AppleTransaction = {
  environment: string; bundleId: string; productId: string; appAccountToken: string;
  transactionId: string; transactionReason: string; purchaseDate: number;
};
export type Subscription = {
  is_sandbox: boolean; store: string; purchase_date: string; expires_date: string;
  original_purchase_date: string; store_transaction_id?: string;
};
export function assertCleanSource(status: string) {
  assert.equal(status.trim(), '', 'Require a clean source worktree; commit changes before qualifying Metro behavior.');
}
export function assertMetroRoot(actual: string[], expected: string) {
  assert.ok(actual.length > 0 && actual.every(cwd => cwd === expected), 'Metro listener must serve this exact worktree.');
}
export function assertDeviceBinding(devices: { deviceProperties?: { name?: string }; hardwareProperties?: { udid?: string; reality?: string } }[], name: string, udid: string) {
  const matches = devices.filter(d => d.deviceProperties?.name === name);
  assert.equal(matches.length, 1, 'The engine device name must identify exactly one device.');
  assert.equal(matches[0].hardwareProperties?.reality, 'physical', 'Require a physical iPhone.');
  assert.equal(matches[0].hardwareProperties?.udid, udid, 'Engine name and inspected UDID must identify the same iPhone.');
}
export function currentOwner(log: string, expected: string): string {
  const events = [...log.matchAll(/\[RevenueCat\] (Logged in|Logged out) (\{[^\n]+\})/g)];
  const last = events.at(-1);
  assert.ok(last, 'Require a fresh native identity event since app.open().');
  assert.equal(last[1], 'Logged in', 'A later logout invalidates the previous owner login.');
  const login = JSON.parse(last[2]);
  assert.equal(login.isAnonymous, false); assert.equal(login.platform, 'ios');
  assert.equal(login.appUserId, expected, 'Require the approved current owner.');
  assert.equal(login.userId, expected);
  return expected;
}
export function assertPendingAttempt(attempt: Attempt | undefined, id: string, campaignId: string, ownerId: string, sourceRevision: string, now = Date.now()): asserts attempt is Attempt {
  assert.ok(attempt, 'Require an explicit pending purchase attempt, not retained legacy state.');
  assert.equal(attempt.id, id); assert.equal(attempt.campaignId, campaignId);
  assert.equal(attempt.ownerId, ownerId); assert.equal(attempt.sourceRevision, sourceRevision);
  assert.ok(!attempt.completedAt, 'This attempt has already been consumed.');
  assert.ok(Number.isFinite(attempt.startedAt) && attempt.startedAt <= now, 'Invalid attempt start.');
  assert.ok(attempt.expiresAt > now && attempt.expiresAt <= attempt.startedAt + ATTEMPT_TTL_MS, 'Pending purchase attempt expired.');
}
export function verifyPurchase(attempt: Attempt, attestation: Attestation, transaction: AppleTransaction, subscription: Subscription, now = Date.now()) {
  assertPendingAttempt(attempt, attestation.attemptId, attestation.campaignId, attestation.ownerId, attempt.sourceRevision, now);
  assert.equal(attestation.product, attempt.product);
  assert.equal(attestation.noChargeSheetVerified, true, 'Require recorded no-charge sheet observation.');
  assert.equal(attestation.ownerSideButtonConfirmed, true, 'Require recorded owner physical confirmation.');
  assert.match(attestation.sheetEvidenceSha256, /^[a-f0-9]{64}$/);
  assert.ok(attestation.sheetEvidence, 'Require the retained native sheet evidence.');
  assert.ok(attestation.sheetObservedAt >= attempt.startedAt && attestation.sheetObservedAt <= attestation.confirmedAt);
  assert.ok(attestation.confirmedAt <= now && attestation.confirmedAt < attempt.expiresAt);
  assert.equal(transaction.environment, 'Sandbox'); assert.equal(transaction.bundleId, 'com.tanuki75.noctalia');
  assert.equal(transaction.productId, attempt.product); assert.equal(transaction.appAccountToken.toLowerCase(), attempt.ownerId.toLowerCase());
  assert.equal(transaction.transactionReason, 'PURCHASE', 'A renewal is not the pending new purchase.');
  assert.equal(transaction.transactionId, attestation.transactionId);
  assert.ok(transaction.purchaseDate >= attempt.startedAt - 5_000 && transaction.purchaseDate <= attestation.confirmedAt + 5_000, 'Transaction outside the pending confirmation window.');
  assert.equal(subscription.is_sandbox, true); assert.equal(subscription.store, 'app_store');
  assert.equal(subscription.store_transaction_id, transaction.transactionId, 'Provider receipt must match the attested native transaction.');
  assert.ok(Math.abs(Date.parse(subscription.purchase_date) - transaction.purchaseDate) < 1_000);
  return subscription;
}
export function nativeTransactions(log: string): AppleTransaction[] {
  return [...log.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)].flatMap(match => {
    try { return [JSON.parse(Buffer.from(match[1], 'base64url').toString()) as AppleTransaction]; }
    catch { return []; }
  });
}
