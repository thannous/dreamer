#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

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
  const options = {
    file: process.env.GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH
      ? path.resolve(ROOT, process.env.GOOGLE_PLAY_SUBSCRIPTION_STATE_PATH)
      : DEFAULT_TARGET,
    checkedAt: new Date().toISOString(),
    source: 'Google Play Developer API subscriptions.get',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') {
      options.input = path.resolve(ROOT, argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg === '--file') {
      options.file = path.resolve(ROOT, argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg === '--checked-at') {
      options.checkedAt = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--source') {
      options.source = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
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

function readInput(options, stdin = process.stdin) {
  if (options.input) {
    return fs.readFileSync(options.input, 'utf8');
  }
  if (stdin.isTTY) {
    throw new Error('Missing --input. You can also pipe Google Play subscriptions.get JSON through stdin.');
  }
  return fs.readFileSync(0, 'utf8');
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Google Play input must be valid JSON: ${error instanceof Error ? error.message : error}`);
  }
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
  if (Number.isNaN(Date.parse(options.checkedAt))) {
    throw new Error('--checked-at must be a valid date.');
  }

  const snapshot = parseJson(input);
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function updateGooglePlaySubscriptionState(options, input) {
  const document = normalizeSnapshot(input, options);
  writeJson(options.file, document);
  return document;
}

function summarizeBasePlan(document, basePlanId) {
  const plan = document.base_plans?.[basePlanId];
  if (!plan) return 'missing';
  return `${basePlanId}/${plan.billing_period_duration}/${plan.state}`;
}

function getMonthlyStatus(document) {
  const monthly = document.base_plans?.[EXPECTED.monthlyBasePlanId];
  return {
    ready:
      monthly?.billing_period_duration === EXPECTED.monthlyBillingPeriod &&
      monthly?.state === 'ACTIVE' &&
      monthly?.new_subscriber_availability?.US === true &&
      monthly?.new_subscriber_availability?.FR === true,
    summary: summarizeBasePlan(document, EXPECTED.monthlyBasePlanId),
  };
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const document = updateGooglePlaySubscriptionState(options, readInput(options));
    const monthly = getMonthlyStatus(document);
    console.log(`Updated ${path.relative(ROOT, options.file)}`);
    console.log(`${EXPECTED.productId}:${EXPECTED.monthlyBasePlanId}: ${monthly.summary}; expected ${EXPECTED.monthlyBillingPeriod}`);
    if (!monthly.ready) {
      console.log('Google Play monthly is not ready for new US/FR subscribers.');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  EXPECTED,
  getMonthlyStatus,
  normalizeSnapshot,
  parseArgs,
  updateGooglePlaySubscriptionState,
};
