#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TARGET = path.join(ROOT, 'doc_web_interne/docs/google-play-payments-profile-state.local.json');

const REQUIREMENTS = {
  tax_information: {
    option: 'tax-information',
    severity: 'critical',
    label: 'Tax information',
  },
  payout_method: {
    option: 'payout-method',
    severity: 'critical',
    label: 'Payout method',
  },
  ireland_tax_information: {
    option: 'ireland-tax-information',
    severity: 'warning',
    label: 'Ireland tax information',
  },
};

const OPEN_STATUSES = new Set(['missing', 'required', 'open', 'invalid', 'pending']);
const CLOSED_STATUSES = new Set(['complete', 'completed', 'valid', 'resolved', 'not_required', 'not-applicable']);

function parseNumber(value, label) {
  if (value === undefined) return null;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a number.`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    file: process.env.GOOGLE_PLAY_PAYMENTS_PROFILE_STATE_PATH
      ? path.resolve(ROOT, process.env.GOOGLE_PLAY_PAYMENTS_PROFILE_STATE_PATH)
      : DEFAULT_TARGET,
    checkedAt: new Date().toISOString(),
    source: 'Google Play Console payments profile read-only check',
    requirements: {},
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
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
    if (arg === '--account-name') {
      options.accountName = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--developer-name') {
      options.developerName = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--currency') {
      options.currency = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--monthly-payout-threshold') {
      options.monthlyPayoutThreshold = parseNumber(argv[i + 1], '--monthly-payout-threshold');
      i += 1;
      continue;
    }
    if (arg === '--current-period-earnings') {
      options.currentPeriodEarnings = parseNumber(argv[i + 1], '--current-period-earnings');
      i += 1;
      continue;
    }

    const requirementEntry = Object.entries(REQUIREMENTS).find(([, config]) => arg === `--${config.option}`);
    if (requirementEntry) {
      const [key] = requirementEntry;
      options.requirements[key] = {
        ...(options.requirements[key] ?? {}),
        status: argv[i + 1],
      };
      i += 1;
      continue;
    }

    const messageEntry = Object.entries(REQUIREMENTS).find(
      ([, config]) => arg === `--${config.option}-message`
    );
    if (messageEntry) {
      const [key] = messageEntry;
      options.requirements[key] = {
        ...(options.requirements[key] ?? {}),
        message: argv[i + 1],
      };
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
  node ./scripts/update-google-play-payments-profile-state.js \\
    --account-name "Google Wallet Merchant Account - <email>" \\
    --developer-name Cloudtech \\
    --currency EUR \\
    --monthly-payout-threshold 1.00 \\
    --current-period-earnings 2.52 \\
    --tax-information missing \\
    --tax-information-message "Please provide tax information." \\
    --payout-method missing \\
    --payout-method-message "Please select a valid payout method." \\
    --ireland-tax-information missing \\
    --ireland-tax-information-message "Please provide Ireland tax information."

Options:
  --file <path>                         Snapshot file to update. Defaults to doc_web_interne/docs/google-play-payments-profile-state.local.json
  --checked-at <iso>                    Override timestamp. Defaults to now.
  --source <label>                      Snapshot source label.
  --account-name <name>                 Payments profile account label from Play Console.
  --developer-name <name>               Developer or merchant display name.
  --currency <code>                     Payment currency code.
  --monthly-payout-threshold <amount>   Payment threshold shown by Play Console.
  --current-period-earnings <amount>    Current period earnings shown by Play Console.
  --tax-information <status>            complete, missing, pending, invalid, or not_required.
  --tax-information-message <message>   Visible Play Console message.
  --payout-method <status>              complete, missing, pending, invalid, or not_required.
  --payout-method-message <message>     Visible Play Console message.
  --ireland-tax-information <status>    complete, missing, pending, invalid, or not_required.
  --ireland-tax-information-message <message>
`.trim());
}

function normalizeStatus(value) {
  const status = String(value || 'missing').trim().toLowerCase().replace(/\s+/g, '_');
  if (!OPEN_STATUSES.has(status) && !CLOSED_STATUSES.has(status)) {
    throw new Error(`Unsupported requirement status: ${value}.`);
  }
  return status;
}

function normalizeSnapshot(options) {
  if (Number.isNaN(Date.parse(options.checkedAt))) {
    throw new Error('--checked-at must be a valid date.');
  }
  const requirements = {};
  for (const [key, config] of Object.entries(REQUIREMENTS)) {
    const input = options.requirements[key] ?? {};
    requirements[key] = {
      label: config.label,
      severity: config.severity,
      status: normalizeStatus(input.status),
      message: String(input.message || '').trim(),
    };
  }

  return {
    checked_at: options.checkedAt,
    source: options.source,
    account_name: String(options.accountName || '').trim(),
    developer_name: String(options.developerName || '').trim(),
    currency: String(options.currency || '').trim().toUpperCase(),
    monthly_payout_threshold: options.monthlyPayoutThreshold ?? null,
    current_period_earnings: options.currentPeriodEarnings ?? null,
    requirements,
  };
}

function getOpenPaymentProfileRequirements(snapshot) {
  return Object.entries(snapshot?.requirements ?? {})
    .map(([key, requirement]) => ({
      key,
      label: requirement?.label || key,
      severity: requirement?.severity || 'warning',
      status: normalizeStatus(requirement?.status),
      message: String(requirement?.message || '').trim(),
    }))
    .filter((requirement) => OPEN_STATUSES.has(requirement.status));
}

function isPaymentsProfileReady(snapshot) {
  return getOpenPaymentProfileRequirements(snapshot).length === 0;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function updateGooglePlayPaymentsProfileState(options) {
  const document = normalizeSnapshot(options);
  writeJson(options.file, document);
  return document;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const document = updateGooglePlayPaymentsProfileState(options);
    const openRequirements = getOpenPaymentProfileRequirements(document);
    console.log(`Updated ${path.relative(ROOT, options.file)}`);
    console.log(
      `${openRequirements.length} open payment profile requirement(s): ${
        openRequirements.map((item) => `${item.key}/${item.status}`).join(', ') || 'none'
      }`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  getOpenPaymentProfileRequirements,
  isPaymentsProfileReady,
  normalizeSnapshot,
  parseArgs,
  updateGooglePlayPaymentsProfileState,
};
