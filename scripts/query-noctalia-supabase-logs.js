#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');

const PROJECT_REF = 'usuyppgsmmowzizhaoqj';
const KEYCHAIN_SERVICE = 'com.openai.codex.noctalia.supabase.management-api';
const KEYCHAIN_ACCOUNT = PROJECT_REF;
const LOGS_ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs`;
const REQUEST_TIMEOUT_MS = 20_000;

const CHAIN_PATTERN = '(?i)(sync_dream_mutations|analysis-job-worker|image-job-worker|gemini)';

const OVERVIEW_QUERY = `
select
  countIf(source = 'edge_logs') as edge_events,
  countIf(source = 'postgres_logs') as postgres_events,
  countIf(source = 'function_edge_logs') as function_edge_events,
  countIf(source = 'function_logs') as function_runtime_events,
  countIf(source = 'edge_logs' and match(event_message, '(?i)sync_dream_mutations')) as sync_requests,
  countIf(
    source = 'edge_logs'
    and match(event_message, '(?i)sync_dream_mutations')
    and toInt32OrZero(log_attributes['response.status_code']) between 400 and 499
  ) as sync_4xx,
  countIf(
    source = 'edge_logs'
    and match(event_message, '(?i)sync_dream_mutations')
    and toInt32OrZero(log_attributes['response.status_code']) between 500 and 599
  ) as sync_5xx,
  countIf(
    match(event_message, '${CHAIN_PATTERN}')
    and (
      toInt32OrZero(log_attributes['response.status_code']) = 429
      or match(event_message, '(?i)(resource exhausted|rate[ -]?limit|too many requests)')
    )
  ) as rate_limit_events,
  countIf(
    match(event_message, '${CHAIN_PATTERN}')
    and match(event_message, '(?i)(timeout|timed out|abort|network error|connection reset)')
  ) as timeout_network_events,
  countIf(
    match(event_message, '${CHAIN_PATTERN}')
    and match(event_message, '(?i)((missing|invalid|expired).{0,40}(key|credential|token)|unauthorized|forbidden)')
  ) as auth_config_events,
  countIf(
    match(event_message, '${CHAIN_PATTERN}')
    and match(event_message, '(?i)(model.{0,40}(invalid|removed|not found|unknown)|unsupported model)')
  ) as model_events,
  countIf(
    match(event_message, '${CHAIN_PATTERN}')
    and match(event_message, '(?i)(retr(y|ies).{0,40}(exhausted|failed)|failed after.{0,20}attempt)')
  ) as retry_exhausted_events,
  countIf(
    match(event_message, '${CHAIN_PATTERN}')
    and match(event_message, '(?i)(fallback.{0,40}(activated|enabled|used)|using fallback)')
  ) as fallback_activated_events,
  countIf(
    match(event_message, '${CHAIN_PATTERN}')
    and match(event_message, '(?i)(queue.{0,40}(full|saturated|capacity)|backlog limit)')
  ) as queue_saturation_events,
  countIf(
    match(event_message, '${CHAIN_PATTERN}')
    and match(event_message, '(?i)(persist.{0,40}(failed|error)|database write failed)')
  ) as persistence_events,
  countIf(
    match(event_message, '${CHAIN_PATTERN}')
    and match(event_message, '(?i)(content.{0,40}(blocked|filtered)|safety block)')
  ) as content_blocked_events,
  countIf(
    source = 'postgres_logs'
    and match(log_attributes['parsed.error_severity'], 'ERROR|FATAL|PANIC')
    and match(event_message, '${CHAIN_PATTERN}')
  ) as postgres_chain_errors,
  countIf(
    source = 'function_logs'
    and match(event_message, '${CHAIN_PATTERN}')
    and (
      match(severity_text, '(?i)(error|fatal|panic)')
      or match(event_message, '(?i)(error|exception|failed)')
    )
  ) as runtime_chain_errors
from logs
where source in ('edge_logs', 'postgres_logs', 'function_edge_logs', 'function_logs')
`.trim();

const INVOCATIONS_QUERY = `
select
  multiIf(
    match(event_message, '(?i)analysis-job-worker'), 'analysis-job-worker',
    match(event_message, '(?i)image-job-worker'), 'image-job-worker',
    match(event_message, '(?i)(/functions/v1/api|function.{0,20}api)'), 'api',
    'other'
  ) as component,
  toInt32OrZero(log_attributes['response.status_code']) as status,
  count() as events
from logs
where source = 'function_edge_logs'
group by component, status
order by component, status
`.trim();

const OVERVIEW_KEYS = new Set([
  'edge_events',
  'postgres_events',
  'function_edge_events',
  'function_runtime_events',
  'sync_requests',
  'sync_4xx',
  'sync_5xx',
  'rate_limit_events',
  'timeout_network_events',
  'auth_config_events',
  'model_events',
  'retry_exhausted_events',
  'fallback_activated_events',
  'queue_saturation_events',
  'persistence_events',
  'content_blocked_events',
  'postgres_chain_errors',
  'runtime_chain_errors',
]);
const INVOCATION_KEYS = new Set(['component', 'status', 'events']);

class SafeFailure extends Error {
  constructor(code, exitCode) {
    super(code);
    this.code = code;
    this.exitCode = exitCode;
  }
}

function readKeychainToken() {
  let token;
  try {
    token = execFileSync(
      '/usr/bin/security',
      [
        'find-generic-password',
        '-w',
        '-s',
        KEYCHAIN_SERVICE,
        '-a',
        KEYCHAIN_ACCOUNT,
      ],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
  } catch {
    throw new SafeFailure('credential_missing', 2);
  }

  if (!/^sbp_[A-Za-z0-9_-]{20,}$/u.test(token)) {
    throw new SafeFailure('credential_invalid_format', 2);
  }
  return token;
}

function normalizeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/u.test(value)) return Number(value);
  throw new SafeFailure('unexpected_logs_response', 4);
}

function sanitizeRows(rows, allowedKeys) {
  if (!Array.isArray(rows)) throw new SafeFailure('unexpected_logs_response', 4);

  return rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new SafeFailure('unexpected_logs_response', 4);
    }
    const keys = Object.keys(row);
    if (keys.some((key) => !allowedKeys.has(key))) {
      throw new SafeFailure('unexpected_logs_response', 4);
    }

    const sanitized = {};
    for (const key of keys) {
      if (key === 'component') {
        if (!['analysis-job-worker', 'image-job-worker', 'api', 'other'].includes(row[key])) {
          throw new SafeFailure('unexpected_logs_response', 4);
        }
        sanitized[key] = row[key];
      } else {
        sanitized[key] = normalizeNumber(row[key]);
      }
    }
    return sanitized;
  });
}

async function queryLogs({ token, sql, start, end, allowedKeys, fetchFn = fetch }) {
  const url = new URL(LOGS_ENDPOINT);
  url.searchParams.set('sql', sql);
  url.searchParams.set('iso_timestamp_start', start.toISOString());
  url.searchParams.set('iso_timestamp_end', end.toISOString());

  let response;
  try {
    response = await fetchFn(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new SafeFailure('logs_network_error', 3);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new SafeFailure('credential_rejected', 3);
    }
    if (response.status === 429) throw new SafeFailure('logs_rate_limited', 3);
    throw new SafeFailure(`logs_http_${response.status}`, 3);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new SafeFailure('unexpected_logs_response', 4);
  }
  return sanitizeRows(payload?.result, allowedKeys);
}

async function collectWindow({ token, hours, end, fetchFn }) {
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  const [overviewRows, invocationRows] = await Promise.all([
    queryLogs({
      token,
      sql: OVERVIEW_QUERY,
      start,
      end,
      allowedKeys: OVERVIEW_KEYS,
      fetchFn,
    }),
    queryLogs({
      token,
      sql: INVOCATIONS_QUERY,
      start,
      end,
      allowedKeys: INVOCATION_KEYS,
      fetchFn,
    }),
  ]);

  if (overviewRows.length !== 1) throw new SafeFailure('unexpected_logs_response', 4);
  return { overview: overviewRows[0], invocations: invocationRows };
}

async function runAudit({
  readToken = readKeychainToken,
  fetchFn = fetch,
  now = () => new Date(),
} = {}) {
  const token = readToken();
  const end = now();
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
    throw new SafeFailure('invalid_clock', 4);
  }

  const [oneHour, twentyFourHours] = await Promise.all([
    collectWindow({ token, hours: 1, end, fetchFn }),
    collectWindow({ token, hours: 24, end, fetchFn }),
  ]);

  return {
    status: 'ok',
    project_ref: PROJECT_REF,
    observed_at: end.toISOString(),
    windows: {
      '1h': oneHour,
      '24h': twentyFourHours,
    },
  };
}

function printHelp() {
  process.stdout.write([
    'Usage: npm run supabase:health:logs',
    '       npm run supabase:health:logs:credential',
    '',
    'One-time credential setup (paste the scoped PAT only at the secure prompt):',
    `security add-generic-password -U -a ${KEYCHAIN_ACCOUNT} -s ${KEYCHAIN_SERVICE} -w`,
    '',
    `Keychain service: ${KEYCHAIN_SERVICE}`,
    `Keychain account: ${KEYCHAIN_ACCOUNT}`,
    '',
  ].join('\n'));
}

async function main(argv = process.argv.slice(2)) {
  try {
    if (argv.includes('--help')) {
      printHelp();
      return;
    }
    if (argv.includes('--credential-status')) {
      readKeychainToken();
      process.stdout.write(`${JSON.stringify({ status: 'configured' })}\n`);
      return;
    }
    const result = await runAudit();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    const safe = error instanceof SafeFailure
      ? error
      : new SafeFailure('unexpected_failure', 5);
    process.stdout.write(`${JSON.stringify({ status: 'blocked', reason: safe.code })}\n`);
    process.exitCode = safe.exitCode;
  }
}

if (require.main === module) void main();

module.exports = {
  INVOCATIONS_QUERY,
  KEYCHAIN_ACCOUNT,
  KEYCHAIN_SERVICE,
  LOGS_ENDPOINT,
  OVERVIEW_QUERY,
  SafeFailure,
  queryLogs,
  readKeychainToken,
  runAudit,
  sanitizeRows,
};
