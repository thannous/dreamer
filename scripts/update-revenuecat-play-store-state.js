#!/usr/bin/env node
'use strict';
/* global __dirname */

const path = require('path');
const { parseSnapshotArgs, readSnapshotInput, parseSnapshotJson, requireSnapshotDate, writeSnapshot } = require('./lib/qa-snapshot');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TARGET = path.join(ROOT, 'doc_web_interne/docs/revenuecat-play-store-state.local.json');
const EXPECTED = {
  projectId: 'proje6db7596',
  monthlyProductId: 'prodfce10ef2a8',
  annualProductId: 'prod98337b31be',
  monthlyBillingPeriod: 'P1M',
};

function parseArgs(argv) {
  return parseSnapshotArgs(argv, {
    file: process.env.REVENUECAT_PLAY_STORE_STATE_PATH || DEFAULT_TARGET,
    source: 'RevenueCat MCP get_product_store_state via fresh codex exec',
  }, printHelp, {
    '--input': 'input',
  });
}

function printHelp() {
  console.log(`
Usage:
  node ./scripts/update-revenuecat-play-store-state.js --input <snapshot.json>
  cat snapshot.json | node ./scripts/update-revenuecat-play-store-state.js

Options:
  --input <path>       RevenueCat MCP snapshot JSON. Defaults to stdin.
  --file <path>        Snapshot file to update. Defaults to doc_web_interne/docs/revenuecat-play-store-state.local.json
  --checked-at <iso>   Override timestamp. Defaults to now.
  --source <label>     Snapshot source label.
`.trim());
}

function getProductState(snapshot, productId) {
  if (Array.isArray(snapshot)) {
    return snapshot.find((item) => item?.product_id === productId || item?.productId === productId) ?? null;
  }
  return snapshot.store_state?.[productId] ?? snapshot.storeState?.[productId] ?? snapshot.products?.[productId] ?? null;
}

function normalizeBasePlans(productState) {
  if (!productState) return [];
  const basePlans =
    productState.base_plans ??
    productState.basePlans ??
    productState.store_state?.base_plans ??
    productState.storeState?.basePlans;
  if (Array.isArray(basePlans)) {
    return basePlans.map((plan) => ({
      base_plan_id: plan?.base_plan_id ?? plan?.basePlanId ?? 'unknown',
      billing_period_duration: plan?.billing_period_duration ?? plan?.billingPeriodDuration ?? 'unknown',
    }));
  }
  if (basePlans && typeof basePlans === 'object') {
    return Object.entries(basePlans).map(([basePlanId, plan]) => {
      const planType =
        plan?.auto_renewing_base_plan_type ??
        plan?.autoRenewingBasePlanType ??
        plan?.prepaid_base_plan_type ??
        plan?.prepaidBasePlanType ??
        plan?.installments_base_plan_type ??
        plan?.installmentsBasePlanType;
      return {
        base_plan_id: plan?.base_plan_id ?? plan?.basePlanId ?? basePlanId,
        billing_period_duration:
          plan?.billing_period_duration ??
          plan?.billingPeriodDuration ??
          planType?.billing_period_duration ??
          planType?.billingPeriodDuration ??
          'unknown',
      };
    });
  }
  const ids = productState.base_plan_ids ?? productState.basePlanIds ?? [];
  const durations = productState.billing_period_duration_values ?? productState.billingPeriodDurationValues ?? [];
  return ids.map((id, index) => ({
    base_plan_id: id,
    billing_period_duration: durations[index] ?? 'unknown',
  }));
}

function normalizeProductState(snapshot, productId) {
  const productState = getProductState(snapshot, productId);
  if (!productState) {
    throw new Error(`Snapshot is missing RevenueCat product ${productId}.`);
  }
  const basePlans = normalizeBasePlans(productState);
  if (basePlans.length === 0) {
    throw new Error(`Snapshot product ${productId} has no base plans.`);
  }
  return {
    store: productState.store ?? 'play_store',
    status: productState.status ?? productState.store_status?.status ?? productState.storeStatus?.status ?? 'unknown',
    base_plans: basePlans,
  };
}

function hasBillingPeriod(productState, expectedDuration) {
  return productState.base_plans.some((plan) => plan.billing_period_duration === expectedDuration);
}

function summarizeBasePlans(productState) {
  return productState.base_plans
    .map((plan) => `${plan.base_plan_id}/${plan.billing_period_duration}`)
    .join(', ');
}

function normalizeSnapshot(input, options) {
  requireSnapshotDate(options.checkedAt);

  const snapshot = parseSnapshotJson(input, 'Snapshot');
  const monthly = normalizeProductState(snapshot, EXPECTED.monthlyProductId);
  const annual = normalizeProductState(snapshot, EXPECTED.annualProductId);
  return {
    project_id: snapshot.project_id ?? snapshot.projectId ?? EXPECTED.projectId,
    offering: snapshot.offering ?? null,
    store_state: {
      [EXPECTED.monthlyProductId]: monthly,
      [EXPECTED.annualProductId]: annual,
    },
    checked_at: options.checkedAt,
    source: options.source,
  };
}

function updatePlayStoreState(options, input) {
  const document = normalizeSnapshot(input, options);
  writeSnapshot(options.file, document);
  return document;
}

function getMonthlyStatus(document) {
  const monthly = document.store_state[EXPECTED.monthlyProductId];
  const summary = summarizeBasePlans(monthly);
  return {
    ready: hasBillingPeriod(monthly, EXPECTED.monthlyBillingPeriod),
    summary,
  };
}

function getMonthlyFollowup(monthly) {
  if (monthly.ready) return null;
  return 'RevenueCat monthly store-state is not P1M. Run npm run subscription:qa:report to classify it as BLOCKED or LAGGING against the Google Play direct snapshot.';
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const document = updatePlayStoreState(options, readSnapshotInput(options, 'RevenueCat MCP JSON'));
    const monthly = getMonthlyStatus(document);
    console.log(`Updated ${path.relative(ROOT, options.file)}`);
    console.log(`${EXPECTED.monthlyProductId}: ${monthly.summary}; expected ${EXPECTED.monthlyBillingPeriod}`);
    const followup = getMonthlyFollowup(monthly);
    if (followup) console.log(followup);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  EXPECTED,
  getMonthlyFollowup,
  getMonthlyStatus,
  normalizeSnapshot,
  parseArgs,
  updatePlayStoreState,
};
