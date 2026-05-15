#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TARGET = path.join(ROOT, 'doc_web_interne/docs/revenuecat-subscriber-expiry-state.local.json');
const EXPECTED = {
  entitlementId: 'Noctalia Plus',
  productIdentifier: 'noctalia_plus',
  store: 'play_store',
};

function parseArgs(argv) {
  const options = {
    file: process.env.REVENUECAT_SUBSCRIBER_EXPIRY_STATE_PATH
      ? path.resolve(ROOT, process.env.REVENUECAT_SUBSCRIBER_EXPIRY_STATE_PATH)
      : DEFAULT_TARGET,
    checkedAt: new Date().toISOString(),
    source: 'RevenueCat subscriber API v1',
    entitlementId: EXPECTED.entitlementId,
    productIdentifier: EXPECTED.productIdentifier,
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
    if (arg === '--app-user-id') {
      options.appUserId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--entitlement-id') {
      options.entitlementId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--product-id') {
      options.productIdentifier = argv[i + 1];
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
  node ./scripts/update-revenuecat-subscriber-expiry-state.js --input <subscriber.json> --app-user-id <uuid>
  curl https://api.revenuecat.com/v1/subscribers/<uuid> | node ./scripts/update-revenuecat-subscriber-expiry-state.js --app-user-id <uuid>

Options:
  --input <path>            RevenueCat subscriber JSON. Defaults to stdin.
  --file <path>             Snapshot file to update. Defaults to doc_web_interne/docs/revenuecat-subscriber-expiry-state.local.json
  --checked-at <iso>        Override timestamp. Defaults to now.
  --source <label>          Snapshot source label.
  --app-user-id <uuid>      RevenueCat app user id.
  --entitlement-id <id>     Entitlement to inspect. Defaults to Noctalia Plus.
  --product-id <id>         Store product identifier to inspect. Defaults to noctalia_plus.

This snapshot confirms RevenueCat direct subscriber expiry only. It does not replace the
play_cancellation_and_expiry gate, which must still prove webhook/backend convergence.
`.trim());
}

function readInput(options, stdin = process.stdin) {
  if (options.input) {
    return fs.readFileSync(options.input, 'utf8');
  }
  if (stdin.isTTY) {
    throw new Error('Missing --input. You can also pipe RevenueCat subscriber JSON through stdin.');
  }
  return fs.readFileSync(0, 'utf8');
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`RevenueCat subscriber input must be valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function normalizeText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function isActiveAt(expiresDate, checkedAt) {
  const expires = normalizeText(expiresDate);
  if (!expires) return true;
  const expiresMs = Date.parse(expires);
  const checkedMs = Date.parse(checkedAt);
  if (Number.isNaN(expiresMs) || Number.isNaN(checkedMs)) return true;
  return expiresMs > checkedMs;
}

function getSubscriberEnvelope(snapshot) {
  if (snapshot?.subscriber && typeof snapshot.subscriber === 'object') {
    return snapshot.subscriber;
  }
  return null;
}

function normalizeFromSanitized(snapshot, options) {
  return {
    checked_at: normalizeText(snapshot.checked_at ?? snapshot.checkedAt) ?? options.checkedAt,
    app_user_id: normalizeText(snapshot.app_user_id ?? snapshot.appUserId ?? options.appUserId),
    source: normalizeText(snapshot.source) ?? options.source,
    entitlement: {
      id: normalizeText(snapshot.entitlement?.id) ?? options.entitlementId,
      product_identifier: normalizeText(snapshot.entitlement?.product_identifier),
      purchase_date: normalizeText(snapshot.entitlement?.purchase_date),
      expires_date: normalizeText(snapshot.entitlement?.expires_date),
      is_active_at_check: Boolean(snapshot.entitlement?.is_active_at_check),
    },
    play_subscription: {
      product_identifier: normalizeText(snapshot.play_subscription?.product_identifier ?? snapshot.playSubscription?.product_identifier),
      store: normalizeText(snapshot.play_subscription?.store ?? snapshot.playSubscription?.store),
      is_sandbox: Boolean(snapshot.play_subscription?.is_sandbox ?? snapshot.playSubscription?.is_sandbox),
      period_type: normalizeText(snapshot.play_subscription?.period_type ?? snapshot.playSubscription?.period_type),
      purchase_date: normalizeText(snapshot.play_subscription?.purchase_date ?? snapshot.playSubscription?.purchase_date),
      expires_date: normalizeText(snapshot.play_subscription?.expires_date ?? snapshot.playSubscription?.expires_date),
      unsubscribe_detected_at: normalizeText(
        snapshot.play_subscription?.unsubscribe_detected_at ?? snapshot.playSubscription?.unsubscribe_detected_at
      ),
      billing_issues_detected_at: normalizeText(
        snapshot.play_subscription?.billing_issues_detected_at ?? snapshot.playSubscription?.billing_issues_detected_at
      ),
      is_active_at_check: Boolean(snapshot.play_subscription?.is_active_at_check ?? snapshot.playSubscription?.is_active_at_check),
    },
    subscription_keys: snapshot.subscription_keys ?? snapshot.subscriptionKeys ?? [],
    entitlement_keys: snapshot.entitlement_keys ?? snapshot.entitlementKeys ?? [],
  };
}

function normalizeFromRevenueCat(snapshot, options) {
  const subscriber = getSubscriberEnvelope(snapshot);
  if (!subscriber) {
    return normalizeFromSanitized(snapshot, options);
  }

  const entitlements = subscriber.entitlements ?? {};
  const subscriptions = subscriber.subscriptions ?? {};
  const entitlement = entitlements[options.entitlementId];
  const subscription =
    subscriptions[options.productIdentifier] ??
    Object.values(subscriptions).find((item) => item?.store === EXPECTED.store && item?.product_identifier === options.productIdentifier) ??
    Object.values(subscriptions).find((item) => item?.store === EXPECTED.store);

  return {
    checked_at: options.checkedAt,
    app_user_id: normalizeText(snapshot.app_user_id ?? snapshot.appUserId ?? subscriber.original_app_user_id ?? options.appUserId),
    source: options.source,
    entitlement: {
      id: options.entitlementId,
      product_identifier: normalizeText(entitlement?.product_identifier),
      purchase_date: normalizeText(entitlement?.purchase_date),
      expires_date: normalizeText(entitlement?.expires_date),
      is_active_at_check: isActiveAt(entitlement?.expires_date, options.checkedAt),
    },
    play_subscription: {
      product_identifier: normalizeText(subscription?.product_identifier ?? options.productIdentifier),
      store: normalizeText(subscription?.store),
      is_sandbox: Boolean(subscription?.is_sandbox),
      period_type: normalizeText(subscription?.period_type),
      purchase_date: normalizeText(subscription?.purchase_date),
      expires_date: normalizeText(subscription?.expires_date),
      unsubscribe_detected_at: normalizeText(subscription?.unsubscribe_detected_at),
      billing_issues_detected_at: normalizeText(subscription?.billing_issues_detected_at),
      is_active_at_check: isActiveAt(subscription?.expires_date, options.checkedAt),
    },
    subscription_keys: Object.keys(subscriptions).sort(),
    entitlement_keys: Object.keys(entitlements).sort(),
  };
}

function validateSnapshot(document, options) {
  if (Number.isNaN(Date.parse(document.checked_at))) {
    throw new Error('--checked-at must be a valid date.');
  }
  if (!isUuid(document.app_user_id)) {
    throw new Error('--app-user-id must be a valid RevenueCat app user UUID.');
  }
  if (options.appUserId && document.app_user_id !== options.appUserId.trim()) {
    throw new Error(`Subscriber app user id mismatch: expected ${options.appUserId}, got ${document.app_user_id}.`);
  }
  if (document.entitlement.id !== options.entitlementId) {
    throw new Error(`Snapshot is missing entitlement ${options.entitlementId}.`);
  }
  if (document.entitlement.product_identifier !== options.productIdentifier) {
    throw new Error(`Entitlement product must be ${options.productIdentifier}.`);
  }
  if (document.entitlement.is_active_at_check !== false) {
    throw new Error('RevenueCat entitlement must be inactive at checked_at.');
  }
  if (document.play_subscription.product_identifier !== options.productIdentifier) {
    throw new Error(`Play subscription product must be ${options.productIdentifier}.`);
  }
  if (document.play_subscription.store !== EXPECTED.store) {
    throw new Error(`Play subscription store must be ${EXPECTED.store}.`);
  }
  if (document.play_subscription.is_sandbox !== true) {
    throw new Error('Play subscription must be a sandbox/test purchase.');
  }
  if (document.play_subscription.is_active_at_check !== false) {
    throw new Error('Play subscription must be inactive at checked_at.');
  }
}

function normalizeSnapshot(input, options) {
  const snapshot = parseJson(input);
  const document = normalizeFromRevenueCat(snapshot, options);
  validateSnapshot(document, options);
  return document;
}

function updateRevenueCatSubscriberExpiryState(options, input) {
  const document = normalizeSnapshot(input, options);
  fs.mkdirSync(path.dirname(options.file), { recursive: true });
  fs.writeFileSync(options.file, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return document;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const input = readInput(options);
    const document = updateRevenueCatSubscriberExpiryState(options, input);
    console.log('[revenuecat-subscriber-expiry-state] Snapshot updated');
    console.log(`[revenuecat-subscriber-expiry-state] file: ${path.relative(ROOT, options.file)}`);
    console.log(
      `[revenuecat-subscriber-expiry-state] ${document.app_user_id}: ${document.play_subscription.product_identifier}/${document.play_subscription.store}/sandbox=${document.play_subscription.is_sandbox}/inactive`
    );
  } catch (error) {
    console.error(`[revenuecat-subscriber-expiry-state] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  EXPECTED,
  normalizeSnapshot,
  parseArgs,
  updateRevenueCatSubscriberExpiryState,
};
