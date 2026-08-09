#!/usr/bin/env node
/* global __dirname, fetch */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_NAME = 'com.tanuki75.noctalia';
const API_ROOT = 'https://playdeveloperreporting.googleapis.com/v1beta1';
const REPORTING_SCOPE = 'https://www.googleapis.com/auth/playdeveloperreporting';
const TIME_ZONE = 'America/Los_Angeles';
const DEFAULT_FILE = path.join(
  ROOT_DIR,
  'doc_web_interne',
  'docs',
  'google-play-vitals-state.local.json'
);
const METRIC_SETS = Object.freeze({
  crashes: {
    resource: 'crashRateMetricSet',
    metrics: ['crashRate', 'userPerceivedCrashRate', 'distinctUsers'],
  },
  anrs: {
    resource: 'anrRateMetricSet',
    metrics: ['anrRate', 'userPerceivedAnrRate', 'distinctUsers'],
  },
});

function assertDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    throw new Error(`${label} doit utiliser YYYY-MM-DD.`);
  }
}

function dateParts(value) {
  assertDate(value, 'date');
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day, timeZone: { id: TIME_ZONE } };
}

function buildMetricQuery(start, end, metrics, pageToken) {
  assertDate(start, '--start');
  assertDate(end, '--end');
  if (start >= end) throw new Error('--start doit précéder --end (borne de fin exclusive).');
  const body = {
    timelineSpec: {
      aggregationPeriod: 'DAILY',
      startTime: dateParts(start),
      endTime: dateParts(end),
    },
    metrics,
    pageSize: 1000,
  };
  if (pageToken) body.pageToken = pageToken;
  return body;
}

function parseArgs(argv) {
  const endDefault = new Date().toISOString().slice(0, 10);
  const startDefault = new Date(`${endDefault}T00:00:00Z`);
  startDefault.setUTCDate(startDefault.getUTCDate() - 28);
  const args = {
    packageName: PACKAGE_NAME,
    start: startDefault.toISOString().slice(0, 10),
    end: endDefault,
    file: DEFAULT_FILE,
  };
  const names = new Set(['package-name', 'start', 'end', 'file', 'checked-at']);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (!arg.startsWith('--') || !names.has(arg.slice(2))) throw new Error(`Option inconnue : ${arg}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Valeur manquante pour ${arg}.`);
    index += 1;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    args[key] = key === 'file' ? path.resolve(ROOT_DIR, value) : value;
  }
  assertDate(args.start, '--start');
  assertDate(args.end, '--end');
  if (args.start >= args.end) throw new Error('--start doit précéder --end.');
  return args;
}

function getAccessToken(environment = process.env, execFile = execFileSync) {
  if (environment.GOOGLE_PLAY_REPORTING_ACCESS_TOKEN) {
    return environment.GOOGLE_PLAY_REPORTING_ACCESS_TOKEN.trim();
  }
  try {
    return String(
      execFile('gcloud', ['auth', 'application-default', 'print-access-token'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    ).trim();
  } catch (_error) {
    throw new Error(
      `Authentification absente. Définissez GOOGLE_PLAY_REPORTING_ACCESS_TOKEN ou créez des ADC avec le scope ${REPORTING_SCOPE}.`
    );
  }
}

function readMetricValue(metric) {
  const typedValue = metric.decimalValue
    ?? metric.decimal_value
    ?? metric.integerValue
    ?? metric.integer_value
    ?? metric.value;
  const raw = typedValue && typeof typedValue === 'object' ? typedValue.value : typedValue;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function normalizeTime(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const year = String(value.year).padStart(4, '0');
  const month = String(value.month).padStart(2, '0');
  const day = String(value.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeMetricRows(rows) {
  return (rows || []).map((row) => {
    const values = {};
    for (const metric of row.metrics || []) {
      values[metric.metric] = readMetricValue(metric);
    }
    return {
      start_time: normalizeTime(row.startTime ?? row.start_time),
      end_time: normalizeTime(row.endTime ?? row.end_time),
      aggregation_period: row.aggregationPeriod ?? row.aggregation_period ?? 'DAILY',
      metrics: values,
    };
  });
}

async function postMetricQuery(url, body, accessToken, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let document = {};
  try {
    document = text ? JSON.parse(text) : {};
  } catch (_error) {
    throw new Error(`Réponse Google Play non JSON (${response.status}).`);
  }
  if (!response.ok) {
    const message = document.error?.message || response.statusText || 'requête refusée';
    const authHint = response.status === 401 || response.status === 403
      ? ` Vérifiez le scope ${REPORTING_SCOPE} et l’accès Play Console « Afficher les informations sur l’application ».`
      : '';
    throw new Error(`Play Developer Reporting ${response.status}: ${message}.${authHint}`);
  }
  return document;
}

async function queryMetricSet(options, definition, accessToken, fetchImpl = fetch) {
  const url = `${API_ROOT}/apps/${encodeURIComponent(options.packageName)}/${definition.resource}:query`;
  const rows = [];
  let pageToken;
  do {
    const response = await postMetricQuery(
      url,
      buildMetricQuery(options.start, options.end, definition.metrics, pageToken),
      accessToken,
      fetchImpl
    );
    rows.push(...normalizeMetricRows(response.rows));
    pageToken = response.nextPageToken;
  } while (pageToken);
  return rows;
}

async function exportVitals(options, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || fetch;
  const accessToken = dependencies.accessToken || getAccessToken();
  const entries = await Promise.all(
    Object.entries(METRIC_SETS).map(async ([id, definition]) => [id, {
      metrics: definition.metrics,
      rows: await queryMetricSet(options, definition, accessToken, fetchImpl),
    }])
  );
  const metricSets = Object.fromEntries(entries);
  return {
    schema_version: 1,
    package_name: options.packageName,
    generated_at: options.checkedAt || new Date().toISOString(),
    read_only: true,
    source: 'play_developer_reporting_v1beta1',
    period: {
      start: options.start,
      end_exclusive: options.end,
      aggregation_period: 'DAILY',
      time_zone: TIME_ZONE,
    },
    metric_sets: metricSets,
    limitations: [
      'distinctUsers est arrondi par Google et ne doit pas être additionné entre les jours.',
      'Une absence de ligne peut refléter la confidentialité ou un volume insuffisant ; elle ne prouve pas un taux nul.',
    ],
  };
}

function writeJson(file, document) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

function printHelp() {
  console.log(`
Usage:
  npm run aso:google-play:vitals -- --start 2026-07-12 --end 2026-08-09

La date --end est exclusive. L’export est strictement en lecture seule.
Auth : GOOGLE_PLAY_REPORTING_ACCESS_TOKEN ou ADC avec ${REPORTING_SCOPE}
Sortie par défaut : ${path.relative(ROOT_DIR, DEFAULT_FILE)}
`);
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) return printHelp();
    const document = await exportVitals(args);
    writeJson(args.file, document);
    console.log(`Vitals Google Play écrits : ${path.relative(ROOT_DIR, args.file)}`);
  } catch (error) {
    console.error(`Erreur Vitals Google Play : ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  API_ROOT,
  METRIC_SETS,
  REPORTING_SCOPE,
  TIME_ZONE,
  buildMetricQuery,
  exportVitals,
  getAccessToken,
  normalizeMetricRows,
  parseArgs,
  postMetricQuery,
  queryMetricSet,
  readMetricValue,
  writeJson,
};
