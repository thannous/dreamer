const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  EXPECTED,
  getMonthlyStatus,
  normalizeSnapshot,
  parseArgs,
  updateGooglePlaySubscriptionState,
} = require('./update-google-play-subscription-state');

function tmpFile(name = 'snapshot.json') {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'google-play-state-')), name);
}

function apiSnapshot(overrides = {}) {
  return {
    packageName: EXPECTED.packageName,
    productId: EXPECTED.productId,
    basePlans: [
      {
        basePlanId: 'monthly',
        state: 'ACTIVE',
        regionalConfigs: [
          {
            regionCode: 'US',
            newSubscriberAvailability: true,
            price: { currencyCode: 'USD', units: '3', nanos: 490000000 },
          },
          {
            regionCode: 'FR',
            newSubscriberAvailability: true,
            price: { currencyCode: 'EUR', units: '3', nanos: 590000000 },
          },
        ],
        autoRenewingBasePlanType: {
          billingPeriodDuration: 'P1M',
          legacyCompatibleSubscriptionOfferId: '',
        },
        offerTags: [{ tag: 'monthy' }],
      },
      {
        basePlanId: 'annual',
        state: 'ACTIVE',
        regionalConfigs: [
          {
            regionCode: 'US',
            newSubscriberAvailability: true,
            price: { currencyCode: 'USD', units: '21', nanos: 990000000 },
          },
          {
            regionCode: 'FR',
            newSubscriberAvailability: true,
            price: { currencyCode: 'EUR', units: '22', nanos: 990000000 },
          },
        ],
        autoRenewingBasePlanType: {
          billingPeriodDuration: 'P1Y',
          legacyCompatibleSubscriptionOfferId: '',
        },
        offerTags: [{ tag: 'annual' }],
      },
    ],
    ...overrides,
  };
}

describe('Google Play subscription state updater', () => {
  it('normalizes the subscriptions.get response', () => {
    const document = normalizeSnapshot(JSON.stringify(apiSnapshot()), {
      checkedAt: '2026-05-14T12:00:00.000Z',
      source: 'test',
    });

    expect(document.base_plans.monthly.billing_period_duration).toBe('P1M');
    expect(document.base_plans.monthly.state).toBe('ACTIVE');
    expect(document.base_plans.monthly.new_subscriber_availability).toEqual({ US: true, FR: true });
    expect(document.base_plans.monthly.prices.US).toEqual({
      currency_code: 'USD',
      units: '3',
      nanos: 490000000,
    });
    expect(getMonthlyStatus(document)).toEqual({
      ready: true,
      summary: 'monthly/P1M/ACTIVE',
    });
  });

  it('keeps non-monthly billing periods blocked', () => {
    const snapshot = apiSnapshot();
    snapshot.basePlans[0].autoRenewingBasePlanType.billingPeriodDuration = 'P1Y';
    const document = normalizeSnapshot(JSON.stringify(snapshot), {
      checkedAt: '2026-05-14T12:00:00.000Z',
      source: 'test',
    });

    expect(getMonthlyStatus(document)).toEqual({
      ready: false,
      summary: 'monthly/P1Y/ACTIVE',
    });
  });

  it('writes the normalized snapshot to the requested file', () => {
    const file = tmpFile();
    updateGooglePlaySubscriptionState(
      { file, checkedAt: '2026-05-14T12:00:00.000Z', source: 'test' },
      JSON.stringify(apiSnapshot())
    );

    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written.checked_at).toBe('2026-05-14T12:00:00.000Z');
    expect(written.base_plans.monthly.billing_period_duration).toBe('P1M');
  });

  it('rejects snapshots that miss the monthly base plan', () => {
    const snapshot = apiSnapshot({ basePlans: [apiSnapshot().basePlans[1]] });
    expect(() =>
      normalizeSnapshot(JSON.stringify(snapshot), { checkedAt: '2026-05-14T12:00:00.000Z', source: 'test' })
    ).toThrow('Google Play snapshot is missing base plan monthly.');
  });

  it('rejects unexpected package names', () => {
    expect(() =>
      normalizeSnapshot(JSON.stringify(apiSnapshot({ packageName: 'com.example.other' })), {
        checkedAt: '2026-05-14T12:00:00.000Z',
        source: 'test',
      })
    ).toThrow(`Expected packageName ${EXPECTED.packageName}, got com.example.other.`);
  });

  it('rejects invalid checkedAt values', () => {
    expect(() => normalizeSnapshot('{}', { checkedAt: 'not-a-date', source: 'test' })).toThrow(
      '--checked-at must be a valid date.'
    );
  });

  it('parses CLI options', () => {
    expect(parseArgs(['--input', 'in.json', '--file', 'out.json', '--checked-at', '2026-05-14T12:00:00Z'])).toMatchObject({
      input: expect.stringContaining('in.json'),
      file: expect.stringContaining('out.json'),
      checkedAt: '2026-05-14T12:00:00Z',
    });
  });
});
