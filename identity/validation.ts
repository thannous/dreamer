import { PRODUCTION_HOSTS, PRODUCTION_IDENTITIES } from './constants';
import { APP_PRODUCTS, IDENTITY_ENVIRONMENTS } from './types';
import type {
  AppProduct,
  IdentityValidationIssue,
  IdentityValidationResult,
  NoctaliaIdentity,
  NoctaliaIdentityMatrix,
} from './types';

function collectRows(matrix: NoctaliaIdentityMatrix): NoctaliaIdentity[] {
  const rows: NoctaliaIdentity[] = [];
  for (const product of APP_PRODUCTS) {
    const productRows = matrix[product];
    if (!productRows) {
      continue;
    }
    for (const environment of IDENTITY_ENVIRONMENTS) {
      const row = productRows[environment];
      if (row) {
        rows.push(row);
      }
    }
  }
  return rows;
}

function productionMismatch(
  product: AppProduct,
  row: NoctaliaIdentity
): IdentityValidationIssue[] {
  const frozen = PRODUCTION_IDENTITIES[product];
  const issues: IdentityValidationIssue[] = [];
  const expectedOtaEnabled = product === 'dream';

  const checks: [string, unknown, unknown][] = [
    ['name', row.name, frozen.name],
    ['slug', row.slug, frozen.slug],
    ['androidApplicationId', row.androidApplicationId, frozen.androidApplicationId],
    ['iosBundleIdentifier', row.iosBundleIdentifier, frozen.iosBundleIdentifier],
    ['scheme', row.scheme, frozen.scheme],
    ['host', row.host, frozen.host],
    ['easProjectId', row.easProjectId, frozen.easProjectId],
    ['ota.enabled', row.ota.enabled, expectedOtaEnabled],
  ];

  if (expectedOtaEnabled && product === 'dream') {
    checks.push(
      ['ota.reference', row.ota.enabled ? row.ota.reference : null, 'production'],
      [
        'ota.updatesUrl',
        row.ota.enabled ? row.ota.updatesUrl : null,
        PRODUCTION_IDENTITIES.dream.otaUpdatesUrl,
      ]
    );
  }

  for (const [field, actual, expected] of checks) {
    if (actual !== expected) {
      issues.push({
        code: 'production-constant-mismatch',
        message: `${product}/production ${field} is ${String(actual)}, expected ${String(expected)}`,
      });
    }
  }

  return issues;
}

function uniquenessIssues(
  rows: readonly NoctaliaIdentity[],
  field: 'androidApplicationId' | 'iosBundleIdentifier' | 'scheme',
  code: IdentityValidationIssue['code']
): IdentityValidationIssue[] {
  const seen = new Map<string, string>();
  const issues: IdentityValidationIssue[] = [];

  for (const row of rows) {
    const value = row[field];
    const owner = `${row.product}/${row.environment}`;
    const previous = seen.get(value);
    if (previous) {
      issues.push({
        code,
        message: `${field} ${value} is used by ${previous} and ${owner}`,
      });
      continue;
    }
    seen.set(value, owner);
  }

  return issues;
}

export function validateNoctaliaIdentityMatrix(
  matrix: NoctaliaIdentityMatrix
): IdentityValidationResult {
  const issues: IdentityValidationIssue[] = [];

  for (const product of APP_PRODUCTS) {
    const productRows = matrix[product];
    if (!productRows) {
      issues.push({
        code: 'missing-row',
        message: `missing product ${product}`,
      });
      continue;
    }

    for (const environment of IDENTITY_ENVIRONMENTS) {
      const row = productRows[environment];
      if (!row) {
        issues.push({
          code: 'missing-row',
          message: `missing ${product}/${environment}`,
        });
        continue;
      }

      if (row.product !== product || row.environment !== environment) {
        issues.push({
          code: 'row-key-mismatch',
          message: `${product}/${environment} stores ${row.product}/${row.environment}`,
        });
      }

      if (environment === 'production') {
        issues.push(...productionMismatch(product, row));
        continue;
      }

      if (row.host !== null && (PRODUCTION_HOSTS as readonly (string | null)[]).includes(row.host)) {
        issues.push({
          code: 'non-production-has-production-host',
          message: `${product}/${environment} must not use production host ${row.host}`,
        });
      }

      if (row.ota.enabled) {
        issues.push({
          code: 'non-production-ota-enabled',
          message: `${product}/${environment} must keep OTA disabled`,
        });
      }
    }
  }

  const rows = collectRows(matrix);
  issues.push(
    ...uniquenessIssues(rows, 'androidApplicationId', 'duplicate-android-id'),
    ...uniquenessIssues(rows, 'iosBundleIdentifier', 'duplicate-ios-id'),
    ...uniquenessIssues(rows, 'scheme', 'duplicate-scheme')
  );

  if (issues.length === 0) {
    return { ok: true, issues: [] };
  }

  return { ok: false, issues };
}

export function assertValidNoctaliaIdentityMatrix(
  matrix: NoctaliaIdentityMatrix
): void {
  const result = validateNoctaliaIdentityMatrix(matrix);
  if (result.ok) {
    return;
  }

  throw new Error(
    `[NoctaliaIdentity] invalid matrix: ${result.issues
      .map((issue) => `${issue.code}: ${issue.message}`)
      .join('; ')}`
  );
}
