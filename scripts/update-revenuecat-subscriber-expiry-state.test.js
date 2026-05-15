const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  EXPECTED,
  normalizeSnapshot,
  parseArgs,
  updateRevenueCatSubscriberExpiryState,
} = require('./update-revenuecat-subscriber-expiry-state');

const APP_USER_ID = '1239729f-7468-48c9-b26a-7aa8b4a82591';

function tmpFile(name = 'snapshot.json') {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'revenuecat-subscriber-expiry-')), name);
}

function subscriberSnapshot(overrides = {}) {
  return {
    app_user_id: APP_USER_ID,
    subscriber: {
      original_app_user_id: APP_USER_ID,
      entitlements: {
        [EXPECTED.entitlementId]: {
          product_identifier: EXPECTED.productIdentifier,
          purchase_date: '2026-05-14T23:58:07Z',
          expires_date: '2026-05-15T00:28:06Z',
        },
      },
      subscriptions: {
        [EXPECTED.productIdentifier]: {
          product_identifier: EXPECTED.productIdentifier,
          store: EXPECTED.store,
          is_sandbox: true,
          period_type: 'normal',
          purchase_date: '2026-05-14T23:58:07Z',
          expires_date: '2026-05-15T00:28:06Z',
          unsubscribe_detected_at: '2026-05-15T00:31:45Z',
          billing_issues_detected_at: null,
        },
      },
    },
    ...overrides,
  };
}

describe('RevenueCat subscriber expiry state updater', () => {
  it('normalizes RevenueCat subscriber API responses into an inactive Play sandbox snapshot', () => {
    const document = normalizeSnapshot(JSON.stringify(subscriberSnapshot()), {
      checkedAt: '2026-05-15T00:52:04.774Z',
      source: 'test',
      appUserId: APP_USER_ID,
      entitlementId: EXPECTED.entitlementId,
      productIdentifier: EXPECTED.productIdentifier,
    });

    expect(document.app_user_id).toBe(APP_USER_ID);
    expect(document.entitlement).toMatchObject({
      id: EXPECTED.entitlementId,
      product_identifier: EXPECTED.productIdentifier,
      is_active_at_check: false,
    });
    expect(document.play_subscription).toMatchObject({
      product_identifier: EXPECTED.productIdentifier,
      store: EXPECTED.store,
      is_sandbox: true,
      is_active_at_check: false,
      unsubscribe_detected_at: '2026-05-15T00:31:45Z',
    });
    expect(document.subscription_keys).toEqual([EXPECTED.productIdentifier]);
  });

  it('accepts already-sanitized snapshots', () => {
    const document = normalizeSnapshot(
      JSON.stringify({
        checkedAt: '2026-05-15T00:52:04.774Z',
        appUserId: APP_USER_ID,
        source: 'sanitized',
        entitlement: {
          id: EXPECTED.entitlementId,
          product_identifier: EXPECTED.productIdentifier,
          purchase_date: '2026-05-14T23:58:07Z',
          expires_date: '2026-05-15T00:28:06Z',
          is_active_at_check: false,
        },
        playSubscription: {
          product_identifier: EXPECTED.productIdentifier,
          store: EXPECTED.store,
          is_sandbox: true,
          period_type: 'normal',
          purchase_date: '2026-05-14T23:58:07Z',
          expires_date: '2026-05-15T00:28:06Z',
          unsubscribe_detected_at: '2026-05-15T00:31:45Z',
          billing_issues_detected_at: null,
          is_active_at_check: false,
        },
      }),
      {
        checkedAt: '2026-05-15T00:52:04.774Z',
        source: 'test',
        appUserId: APP_USER_ID,
        entitlementId: EXPECTED.entitlementId,
        productIdentifier: EXPECTED.productIdentifier,
      }
    );

    expect(document.source).toBe('sanitized');
    expect(document.play_subscription.is_active_at_check).toBe(false);
  });

  it('writes the normalized snapshot to the requested file', () => {
    const file = tmpFile();
    updateRevenueCatSubscriberExpiryState(
      {
        file,
        checkedAt: '2026-05-15T00:52:04.774Z',
        source: 'test',
        appUserId: APP_USER_ID,
        entitlementId: EXPECTED.entitlementId,
        productIdentifier: EXPECTED.productIdentifier,
      },
      JSON.stringify(subscriberSnapshot())
    );

    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written.checked_at).toBe('2026-05-15T00:52:04.774Z');
    expect(written.play_subscription.store).toBe(EXPECTED.store);
  });

  it('rejects active entitlements', () => {
    const input = subscriberSnapshot();
    input.subscriber.entitlements[EXPECTED.entitlementId].expires_date = '2026-05-15T01:28:06Z';

    expect(() =>
      normalizeSnapshot(JSON.stringify(input), {
        checkedAt: '2026-05-15T00:52:04.774Z',
        source: 'test',
        appUserId: APP_USER_ID,
        entitlementId: EXPECTED.entitlementId,
        productIdentifier: EXPECTED.productIdentifier,
      })
    ).toThrow('RevenueCat entitlement must be inactive at checked_at.');
  });

  it('rejects production purchases', () => {
    const input = subscriberSnapshot();
    input.subscriber.subscriptions[EXPECTED.productIdentifier].is_sandbox = false;

    expect(() =>
      normalizeSnapshot(JSON.stringify(input), {
        checkedAt: '2026-05-15T00:52:04.774Z',
        source: 'test',
        appUserId: APP_USER_ID,
        entitlementId: EXPECTED.entitlementId,
        productIdentifier: EXPECTED.productIdentifier,
      })
    ).toThrow('Play subscription must be a sandbox/test purchase.');
  });

  it('parses CLI options', () => {
    expect(parseArgs(['--input', 'in.json', '--file', 'out.json', '--app-user-id', APP_USER_ID])).toMatchObject({
      input: expect.stringContaining('in.json'),
      file: expect.stringContaining('out.json'),
      appUserId: APP_USER_ID,
    });
  });
});
