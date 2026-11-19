#!/usr/bin/env node
'use strict';

const path = require('path');
const { parseSnapshotArgs, readSnapshotInput, parseSnapshotJson, requireSnapshotDate, writeSnapshot } = require('./lib/qa-snapshot');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TARGET = path.join(ROOT, 'doc_web_interne/docs/google-play-subscription-state.local.json');
const EXPECTED = {
  packageName: 'com.tanuki75.noctalia',
  productId: 'noctalia_plus',
  monthlyBasePlanId: 'monthly',
  annualBasePlanId: 'annual',
  monthlyBillingPeriod: 'P1M',
  annualBillingPeriod: 'P1Y',
};

function parseArgs(argv) {
  return parseSnapshotArgs(argv, {
    file: process.env.GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH || DEFAULT_TARGET,
    source: 'Google Play Developer API subscriptions.get',
  }, printHelp, {
    '--input': 'input',
  });
}

function printHelp() {
  console.log(`
Usage:
  node ./scripts/update-google-play-subscription-state.js --input <subscriptions.get.json>
  curl .../subscriptions/noctalia_plus | node ./scripts/update-google-play-subscription-state.js

Options:
  --input <path>       Google Play Developer API subscriptions.get JSON. Defaults to stdin.
  --file <path>        Snapshot file to update. Defaults to doc_web_interne/docs/google-play-subscription-state.local.json
  --checked-at <iso>   Override timestamp. Defaults to now.
  --source <label>     Snapshot source label.
`.trim());
}

function getRegionConfig(plan, regionCode) {
  return plan.regionalConfigs?.find((config) => config?.regionCode === regionCode) ?? null;
}

function normalizePrice(price) {
  if (!price) return null;
  return {
    currency_code: price.currencyCode ?? 'unknown',
    units: price.units ?? '0',
    nanos: price.nanos ?? 0,
  };
}

function normalizePlan(plan) {
  const us = getRegionConfig(plan, 'US');
  const fr = getRegionConfig(plan, 'FR');
  return {
    state: plan.state ?? 'unknown',
    billing_period_duration: plan.autoRenewingBasePlanType?.billingPeriodDuration ?? 'unknown',
    offer_tags: (plan.offerTags ?? []).map((tag) => tag?.tag).filter(Boolean),
    legacy_compatible_subscription_offer_id:
      plan.autoRenewingBasePlanType?.legacyCompatibleSubscriptionOfferId ?? null,
    new_subscriber_availability: {
      US: us?.newSubscriberAvailability ?? null,
      FR: fr?.newSubscriberAvailability ?? null,
    },
    prices: {
      US: normalizePrice(us?.price),
      FR: normalizePrice(fr?.price),
    },
  };
}

function findBasePlan(snapshot, basePlanId) {
  return snapshot.basePlans?.find((plan) => plan?.basePlanId === basePlanId) ?? null;
}

function normalizeSnapshot(input, options) {
  requireSnapshotDate(options.checkedAt);

  const snapshot = parseSnapshotJson(input, 'Google Play');
  if (snapshot.packageName !== EXPECTED.packageName) {
    throw new Error(`Expected packageName ${EXPECTED.packageName}, got ${snapshot.packageName ?? 'missing'}.`);
  }
  if (snapshot.productId !== EXPECTED.productId) {
    throw new Error(`Expected productId ${EXPECTED.productId}, got ${snapshot.productId ?? 'missing'}.`);
  }

  const monthly = findBasePlan(snapshot, EXPECTED.monthlyBasePlanId);
  const annual = findBasePlan(snapshot, EXPECTED.annualBasePlanId);
  if (!monthly) throw new Error(`Google Play snapshot is missing base plan ${EXPECTED.monthlyBasePlanId}.`);
  if (!annual) throw new Error(`Google Play snapshot is missing base plan ${EXPECTED.annualBasePlanId}.`);

  return {
    package_name: snapshot.packageName,
    product_id: snapshot.productId,
    base_plans: {
      [EXPECTED.monthlyBasePlanId]: normalizePlan(monthly),
      [EXPECTED.annualBasePlanId]: normalizePlan(annual),
    },
    checked_at: options.checkedAt,
    source: options.source,
  };
}

function updateGooglePlaySubscriptionState(options, input) {
  const document = normalizeSnapshot(input, options);
  writeSnapshot(options.file, document);
  return document;
}

function summarizeBasePlan(document, basePlanId) {
  const plan = document.base_plans?.[basePlanId];
  if (!plan) return 'missing';
  return `${basePlanId}/${plan.billing_period_duration}/${plan.state}`;
}

function getBasePlanStatus(document, basePlanId, expectedBillingPeriod) {
  const plan = document.base_plans?.[basePlanId];
  return {
    ready:
      plan?.billing_period_duration === expectedBillingPeriod &&
      plan?.state === 'ACTIVE' &&
      plan?.new_subscriber_availability?.US === true &&
      plan?.new_subscriber_availability?.FR === true,
    summary: summarizeBasePlan(document, basePlanId),
  };
}

function getMonthlyStatus(document) {
  return getBasePlanStatus(document, EXPECTED.monthlyBasePlanId, EXPECTED.monthlyBillingPeriod);
}

function getAnnualStatus(document) {
  return getBasePlanStatus(document, EXPECTED.annualBasePlanId, EXPECTED.annualBillingPeriod);
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const document = updateGooglePlaySubscriptionState(options, readSnapshotInput(options, 'Google Play subscriptions.get JSON'));
    const monthly = getMonthlyStatus(document);
    const annual = getAnnualStatus(document);
    console.log(`Updated ${path.relative(ROOT, options.file)}`);
    console.log(`${EXPECTED.productId}:${EXPECTED.monthlyBasePlanId}: ${monthly.summary}; expected ${EXPECTED.monthlyBillingPeriod}`);
    console.log(`${EXPECTED.productId}:${EXPECTED.annualBasePlanId}: ${annual.summary}; expected ${EXPECTED.annualBillingPeriod}`);
    if (!monthly.ready) {
      console.log('Google Play monthly is not ready for new US/FR subscribers.');
    }
    if (!annual.ready) {
      console.log('Google Play annual is not ready for new US/FR subscribers.');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  EXPECTED,
  getAnnualStatus,
  getMonthlyStatus,
  normalizeSnapshot,
  parseArgs,
  updateGooglePlaySubscriptionState,
};
