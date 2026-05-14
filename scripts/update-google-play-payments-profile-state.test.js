const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  getOpenPaymentProfileRequirements,
  isPaymentsProfileReady,
  normalizeSnapshot,
  parseArgs,
  updateGooglePlayPaymentsProfileState,
} = require('./update-google-play-payments-profile-state');

function tmpFile(name = 'payments-profile.json') {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'google-play-payments-profile-state-')), name);
}

function validOptions(overrides = {}) {
  return {
    checkedAt: '2026-05-14T20:00:00.000Z',
    source: 'test',
    accountName: 'Google Wallet Merchant Account - tester@example.com',
    developerName: 'Cloudtech',
    currency: 'eur',
    monthlyPayoutThreshold: 1,
    currentPeriodEarnings: 2.52,
    requirements: {
      tax_information: { status: 'complete', message: '' },
      payout_method: { status: 'complete', message: '' },
      ireland_tax_information: { status: 'not_required', message: '' },
    },
    ...overrides,
  };
}

describe('Google Play payments profile state updater', () => {
  it('normalizes a ready payments profile snapshot', () => {
    const document = normalizeSnapshot(validOptions());

    expect(document.currency).toBe('EUR');
    expect(document.monthly_payout_threshold).toBe(1);
    expect(document.current_period_earnings).toBe(2.52);
    expect(getOpenPaymentProfileRequirements(document)).toEqual([]);
    expect(isPaymentsProfileReady(document)).toBe(true);
  });

  it('reports open critical and warning requirements', () => {
    const document = normalizeSnapshot(
      validOptions({
        requirements: {
          tax_information: { status: 'missing', message: 'Provide tax information.' },
          payout_method: { status: 'missing', message: 'Add a payout method.' },
          ireland_tax_information: { status: 'pending', message: 'Provide Ireland tax information.' },
        },
      })
    );

    expect(isPaymentsProfileReady(document)).toBe(false);
    expect(getOpenPaymentProfileRequirements(document)).toEqual([
      expect.objectContaining({ key: 'tax_information', status: 'missing', severity: 'critical' }),
      expect.objectContaining({ key: 'payout_method', status: 'missing', severity: 'critical' }),
      expect.objectContaining({ key: 'ireland_tax_information', status: 'pending', severity: 'warning' }),
    ]);
  });

  it('writes the normalized snapshot to the requested file', () => {
    const file = tmpFile();
    updateGooglePlayPaymentsProfileState(validOptions({ file }));

    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written.developer_name).toBe('Cloudtech');
    expect(written.requirements.payout_method.status).toBe('complete');
  });

  it('rejects unknown requirement statuses', () => {
    expect(() =>
      normalizeSnapshot(
        validOptions({
          requirements: {
            tax_information: { status: 'strange' },
          },
        })
      )
    ).toThrow('Unsupported requirement status: strange.');
  });

  it('parses CLI options', () => {
    const parsed = parseArgs([
      '--account-name',
      'Merchant',
      '--developer-name',
      'Cloudtech',
      '--currency',
      'EUR',
      '--monthly-payout-threshold',
      '1.00',
      '--current-period-earnings',
      '2,52',
      '--tax-information',
      'missing',
      '--tax-information-message',
      'Provide tax info.',
      '--payout-method',
      'complete',
      '--ireland-tax-information',
      'not_required',
      '--checked-at',
      '2026-05-14T20:00:00Z',
      '--file',
      'out.json',
    ]);

    expect(parsed).toMatchObject({
      accountName: 'Merchant',
      developerName: 'Cloudtech',
      currency: 'EUR',
      monthlyPayoutThreshold: 1,
      currentPeriodEarnings: 2.52,
      checkedAt: '2026-05-14T20:00:00Z',
      file: expect.stringContaining('out.json'),
    });
    expect(parsed.requirements.tax_information.message).toBe('Provide tax info.');
  });
});
