/* global describe, expect, it */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  EXPECTED,
  getMonthlyFollowup,
  getMonthlyStatus,
  normalizeSnapshot,
  parseArgs,
  updatePlayStoreState,
} = require('./update-revenuecat-play-store-state');

function tmpFile(name = 'snapshot.json') {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'revenuecat-play-state-')), name);
}

describe('RevenueCat Play store state updater', () => {
  it('normalizes compact MCP product arrays', () => {
    const document = normalizeSnapshot(
      JSON.stringify([
        {
          product_id: EXPECTED.monthlyProductId,
          store: 'play_store',
          status: 'ok',
          base_plan_ids: ['monthly'],
          billing_period_duration_values: ['P1M'],
        },
        {
          product_id: EXPECTED.annualProductId,
          store: 'play_store',
          status: 'ok',
          base_plan_ids: ['annual'],
          billing_period_duration_values: ['P1Y'],
        },
      ]),
      { checkedAt: '2026-05-14T12:00:00.000Z', source: 'test' }
    );

    expect(document.store_state[EXPECTED.monthlyProductId].base_plans).toEqual([
      { base_plan_id: 'monthly', billing_period_duration: 'P1M' },
    ]);
    expect(getMonthlyStatus(document)).toEqual({ ready: true, summary: 'monthly/P1M' });
  });

  it('normalizes the current MCP store_state.base_plans object shape', () => {
    const liveStoreState = {
      store: 'play_store',
      store_status: { status: 'ok' },
      store_state: {
        base_plans: {
          annual: {
            state: 'ACTIVE',
            auto_renewing_base_plan_type: { billing_period_duration: 'P1Y' },
          },
          monthly: {
            state: 'ACTIVE',
            auto_renewing_base_plan_type: { billing_period_duration: 'P1M' },
          },
        },
      },
    };
    const document = normalizeSnapshot(
      JSON.stringify([
        { product_id: EXPECTED.monthlyProductId, ...liveStoreState },
        { product_id: EXPECTED.annualProductId, ...liveStoreState },
      ]),
      { checkedAt: '2026-07-10T06:00:00.000Z', source: 'live MCP shape' }
    );

    expect(document.store_state[EXPECTED.monthlyProductId]).toEqual({
      store: 'play_store',
      status: 'ok',
      base_plans: [
        { base_plan_id: 'annual', billing_period_duration: 'P1Y' },
        { base_plan_id: 'monthly', billing_period_duration: 'P1M' },
      ],
    });
    expect(getMonthlyStatus(document)).toEqual({
      ready: true,
      summary: 'annual/P1Y, monthly/P1M',
    });
  });

  it('preserves blocked annual snapshots for the monthly product', () => {
    const document = normalizeSnapshot(
      JSON.stringify({
        store_state: {
          [EXPECTED.monthlyProductId]: {
            store: 'play_store',
            status: 'ok',
            base_plans: [{ base_plan_id: 'annual', billing_period_duration: 'P1Y' }],
          },
          [EXPECTED.annualProductId]: {
            store: 'play_store',
            status: 'ok',
            base_plans: [{ base_plan_id: 'annual', billing_period_duration: 'P1Y' }],
          },
        },
      }),
      { checkedAt: '2026-05-14T12:00:00.000Z', source: 'test' }
    );

    expect(getMonthlyStatus(document)).toEqual({ ready: false, summary: 'annual/P1Y' });
  });

  it('uses the QA report as the source of truth for non-P1M followup', () => {
    expect(getMonthlyFollowup({ ready: true, summary: 'monthly/P1M' })).toBeNull();
    expect(getMonthlyFollowup({ ready: false, summary: 'annual/P1Y' })).toContain(
      'Run npm run subscription:qa:report to classify it as BLOCKED or LAGGING'
    );
  });

  it('writes the normalized snapshot to the requested file', () => {
    const file = tmpFile();
    updatePlayStoreState(
      { file, checkedAt: '2026-05-14T12:00:00.000Z', source: 'test' },
      JSON.stringify({
        store_state: {
          [EXPECTED.monthlyProductId]: {
            base_plans: [{ base_plan_id: 'monthly', billing_period_duration: 'P1M' }],
          },
          [EXPECTED.annualProductId]: {
            base_plans: [{ base_plan_id: 'annual', billing_period_duration: 'P1Y' }],
          },
        },
      })
    );

    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written.checked_at).toBe('2026-05-14T12:00:00.000Z');
    expect(written.store_state[EXPECTED.monthlyProductId].base_plans[0].billing_period_duration).toBe('P1M');
  });

  it('rejects snapshots that miss the monthly product', () => {
    expect(() =>
      normalizeSnapshot(
        JSON.stringify({
          store_state: {
            [EXPECTED.annualProductId]: {
              base_plans: [{ base_plan_id: 'annual', billing_period_duration: 'P1Y' }],
            },
          },
        }),
        { checkedAt: '2026-05-14T12:00:00.000Z', source: 'test' }
      )
    ).toThrow(`Snapshot is missing RevenueCat product ${EXPECTED.monthlyProductId}.`);
  });

  it('rejects invalid checkedAt values', () => {
    expect(() => normalizeSnapshot('{}', { checkedAt: 'not-a-date', source: 'test' })).toThrow(
      '--checked-at must be a valid date.'
    );
  });

  it('parses CLI output options', () => {
    expect(parseArgs(['--input', 'in.json', '--file', 'out.json', '--checked-at', '2026-05-14T12:00:00Z'])).toMatchObject({
      input: expect.stringContaining('in.json'),
      file: expect.stringContaining('out.json'),
      checkedAt: '2026-05-14T12:00:00Z',
    });
  });
});
