#!/usr/bin/env node
/* global __dirname, Buffer */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_NAME = 'com.tanuki75.noctalia';
const DEFAULT_FILE = path.join(
  ROOT_DIR,
  'doc_web_interne',
  'docs',
  'google-play-aso-performance-state.local.json'
);

function parseArgs(argv) {
  const args = { file: DEFAULT_FILE, packageName: PACKAGE_NAME };
  const valueOptions = new Set([
    'store-performance',
    'console-observation',
    'vitals',
    'baseline',
    'file',
    'checked-at',
    'package-name',
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (!arg.startsWith('--') || !valueOptions.has(arg.slice(2))) {
      throw new Error(`Option inconnue : ${arg}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Valeur manquante pour ${arg}.`);
    index += 1;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    args[key] = key === 'storePerformance' && value.startsWith('gs://')
      ? value
      : path.resolve(ROOT_DIR, value);
    if (key === 'checkedAt' || key === 'packageName') args[key] = value;
  }

  return args;
}

function decodeReportBuffer(input) {
  let buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) buffer = zlib.gunzipSync(buffer);

  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le').replace(/^\uFEFF/, '');
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    throw new Error('Les rapports UTF-16BE ne sont pas pris en charge.');
  }
  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }

  if (quoted) throw new Error('CSV invalide : guillemet non fermé.');
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((value) => value !== '')) rows.push(row);
  }
  return rows;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseNumber(value, label) {
  const normalized = String(value || '').trim().replace(/%$/, '').replace(/,/g, '');
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error(`${label} n'est pas numérique : ${value}`);
  return number;
}

function round(value, decimals = 6) {
  const scale = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function normalizeStorePerformanceCsv(text, packageName = PACKAGE_NAME) {
  const csvRows = parseCsv(text);
  if (csvRows.length < 2) throw new Error('Le rapport Store Performance ne contient aucune donnée.');

  const headers = csvRows[0].map(normalizeHeader);
  const required = {
    date: 'date',
    packageName: 'package name',
    trafficSource: 'traffic source',
    acquisitions: 'store listing acquisitions',
    visitors: 'store listing visitors',
    conversionRate: 'store listing conversion rate',
  };
  const indexes = Object.fromEntries(
    Object.entries(required).map(([key, header]) => [key, headers.indexOf(header)])
  );
  const missing = Object.entries(indexes)
    .filter(([, index]) => index === -1)
    .map(([key]) => required[key]);
  if (missing.length > 0) throw new Error(`Colonnes manquantes : ${missing.join(', ')}.`);

  const normalizedRows = csvRows.slice(1).map((row, rowIndex) => ({
    date: String(row[indexes.date] || '').trim(),
    package_name: String(row[indexes.packageName] || '').trim(),
    traffic_source: String(row[indexes.trafficSource] || 'Unknown').trim() || 'Unknown',
    acquisitions: parseNumber(row[indexes.acquisitions], `acquisitions ligne ${rowIndex + 2}`),
    visitors: parseNumber(row[indexes.visitors], `visitors ligne ${rowIndex + 2}`),
    reported_conversion_rate: parseNumber(
      row[indexes.conversionRate],
      `conversion rate ligne ${rowIndex + 2}`
    ),
  }));

  const rows = normalizedRows.filter((row) => row.package_name === packageName);
  if (rows.length === 0) throw new Error(`Aucune ligne trouvée pour ${packageName}.`);
  const invalidDate = rows.find((row) => !/^\d{4}-\d{2}-\d{2}$/.test(row.date));
  if (invalidDate) throw new Error(`Date invalide dans le rapport : ${invalidDate.date}`);

  const bySource = new Map();
  for (const row of rows) {
    const current = bySource.get(row.traffic_source) || { acquisitions: 0, visitors: 0 };
    current.acquisitions += row.acquisitions;
    current.visitors += row.visitors;
    bySource.set(row.traffic_source, current);
  }
  const summarize = ({ acquisitions, visitors }) => ({
    acquisitions,
    visitors,
    conversion_rate: visitors > 0 ? round(acquisitions / visitors) : null,
  });
  const totals = rows.reduce(
    (result, row) => ({
      acquisitions: result.acquisitions + row.acquisitions,
      visitors: result.visitors + row.visitors,
    }),
    { acquisitions: 0, visitors: 0 }
  );
  const dates = rows.map((row) => row.date).sort();

  return {
    metric_family: 'legacy_store_listing_acquisitions',
    definition: 'Anciennes métriques Google Play : acquisitions, visiteurs et taux de conversion de la fiche.',
    period: { start: dates[0], end: dates[dates.length - 1], day_count: inclusiveDayCount(dates[0], dates[dates.length - 1]) },
    row_count: rows.length,
    totals: summarize(totals),
    by_traffic_source: Object.fromEntries(
      [...bySource.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([source, values]) => [source, summarize(values)])
    ),
  };
}

function inclusiveDayCount(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) {
    return null;
  }
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
}

function readBinarySource(source, execFile = execFileSync) {
  if (source.startsWith('gs://')) {
    return execFile('gcloud', ['storage', 'cat', source], {
      encoding: null,
      maxBuffer: 100 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  return fs.readFileSync(source);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateConsoleObservation(document, packageName = PACKAGE_NAME) {
  if (document.package_name !== packageName) {
    throw new Error(`Observation Console attendue pour ${packageName}, reçue pour ${document.package_name}.`);
  }
  const period = document.period || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period.start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(period.end || '')) {
    throw new Error('L’observation Console doit définir period.start et period.end en YYYY-MM-DD.');
  }
  if (!Array.isArray(document.metrics) || document.metrics.length === 0) {
    throw new Error('L’observation Console doit contenir un tableau metrics non vide.');
  }
  const keys = new Set();
  for (const metric of document.metrics) {
    const key = `${metric.id}::${metric.segment}`;
    if (!metric.family || !metric.id || !metric.segment || !metric.unit || !Number.isFinite(metric.value)) {
      throw new Error(`Métrique Console invalide : ${key}.`);
    }
    if (keys.has(key)) throw new Error(`Métrique Console dupliquée : ${key}.`);
    keys.add(key);
  }
  return {
    ...document,
    period: { ...period, day_count: inclusiveDayCount(period.start, period.end) },
  };
}

function metricRecords(snapshot) {
  const records = [];
  const legacy = snapshot.store_performance;
  if (legacy) {
    for (const [metric, value] of Object.entries(legacy.totals)) {
      if (Number.isFinite(value)) {
        records.push({
          family: legacy.metric_family,
          id: `legacy_store_performance.${metric}`,
          segment: 'all',
          unit: metric === 'conversion_rate' ? 'ratio' : 'count',
          value,
          period_day_count: legacy.period.day_count,
        });
      }
    }
  }
  const observation = snapshot.console_observation;
  if (observation) {
    for (const metric of observation.metrics) {
      records.push({
        family: metric.family,
        id: metric.id,
        segment: metric.segment,
        unit: metric.unit,
        value: metric.value,
        period_day_count: observation.period.day_count,
      });
    }
  }
  return records;
}

function buildReportedPeriodComparison(observation) {
  if (!observation) return { status: 'not_available', metrics: [] };
  const previousStart = observation.period.comparison_start;
  const previousEnd = observation.period.comparison_end;
  const previousDayCount = inclusiveDayCount(previousStart, previousEnd);
  const comparablePeriod = Number.isFinite(previousDayCount)
    && previousDayCount === observation.period.day_count;
  const metrics = observation.metrics
    .filter((metric) => Number.isFinite(metric.change_percent_vs_previous_period))
    .map((metric) => ({
      family: metric.family,
      id: metric.id,
      segment: metric.segment,
      unit: metric.unit,
      current: metric.value,
      change_percent_vs_previous_period: metric.change_percent_vs_previous_period,
      comparable: comparablePeriod,
      reason: comparablePeriod ? null : 'period_length_mismatch_or_missing',
    }));
  return {
    status: metrics.length > 0 ? 'reported_by_play_console' : 'not_available',
    current_period: {
      start: observation.period.start,
      end: observation.period.end,
      day_count: observation.period.day_count,
    },
    previous_period: previousStart && previousEnd
      ? { start: previousStart, end: previousEnd, day_count: previousDayCount }
      : null,
    metrics,
  };
}

function compareSnapshots(current, baseline) {
  if (!baseline) return { status: 'no_baseline', metrics: [] };
  const previous = new Map(
    metricRecords(baseline).map((metric) => [`${metric.family}::${metric.id}::${metric.segment}`, metric])
  );
  const metrics = [];
  for (const currentMetric of metricRecords(current)) {
    const key = `${currentMetric.family}::${currentMetric.id}::${currentMetric.segment}`;
    const baselineMetric = previous.get(key);
    if (!baselineMetric) continue;
    const comparable = currentMetric.unit === baselineMetric.unit
      && currentMetric.period_day_count === baselineMetric.period_day_count;
    const absoluteChange = comparable ? round(currentMetric.value - baselineMetric.value) : null;
    const relativeChange = comparable && baselineMetric.value !== 0
      ? round((absoluteChange / baselineMetric.value) * 100, 2)
      : null;
    metrics.push({
      family: currentMetric.family,
      id: currentMetric.id,
      segment: currentMetric.segment,
      unit: currentMetric.unit,
      comparable,
      reason: comparable ? null : 'unit_or_period_length_mismatch',
      current: currentMetric.value,
      baseline: baselineMetric.value,
      absolute_change: absoluteChange,
      relative_change_percent: relativeChange,
    });
  }
  return { status: metrics.length > 0 ? 'compared' : 'no_matching_metrics', metrics };
}

function buildSnapshot(options, dependencies = {}) {
  const readBinary = dependencies.readBinarySource || readBinarySource;
  const snapshot = {
    schema_version: 1,
    package_name: options.packageName || PACKAGE_NAME,
    generated_at: options.checkedAt || new Date().toISOString(),
    read_only: true,
    measurement_boundaries: {
      legacy_store_performance: 'Rapport Cloud Storage historique ; ne pas confondre avec les nouveaux clics de la fiche.',
      current_store_listing_clicks: 'Observation/export Play Console séparé tant que l’API publique ne l’expose pas.',
      android_vitals: 'Métriques techniques issues de Play Developer Reporting, lorsqu’un export Vitals est fourni.',
      cross_family_comparison: 'Interdite : seules des métriques de même famille, unité, segment et durée sont comparées.',
    },
  };

  if (options.storePerformance) {
    snapshot.store_performance = normalizeStorePerformanceCsv(
      decodeReportBuffer(readBinary(options.storePerformance)),
      snapshot.package_name
    );
    snapshot.store_performance.source = options.storePerformance.startsWith('gs://')
      ? 'google_play_cloud_storage_report'
      : path.basename(options.storePerformance);
  }
  if (options.consoleObservation) {
    snapshot.console_observation = validateConsoleObservation(
      readJson(options.consoleObservation),
      snapshot.package_name
    );
    snapshot.reported_period_comparison = buildReportedPeriodComparison(snapshot.console_observation);
  }
  if (options.vitals) {
    const vitals = readJson(options.vitals);
    if (vitals.package_name !== snapshot.package_name) {
      throw new Error(`Export Vitals attendu pour ${snapshot.package_name}.`);
    }
    snapshot.android_vitals = vitals;
  }
  if (!snapshot.store_performance && !snapshot.console_observation && !snapshot.android_vitals) {
    throw new Error('Fournissez au moins --store-performance, --console-observation ou --vitals.');
  }

  const baseline = options.baseline ? readJson(options.baseline) : null;
  if (baseline && baseline.package_name !== snapshot.package_name) {
    throw new Error(`Baseline attendue pour ${snapshot.package_name}.`);
  }
  snapshot.comparison = compareSnapshots(snapshot, baseline);
  return snapshot;
}

function writeSnapshot(file, snapshot) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

function printHelp() {
  console.log(`
Usage:
  npm run aso:google-play:snapshot -- --store-performance <fichier|gs://...> \\
    --console-observation <fichier.json> [--vitals <fichier.json>] [--baseline <snapshot.json>]

Options:
  --store-performance <source>  CSV Google Play, local ou Cloud Storage (lecture seule)
  --console-observation <file>  Export/observation normalisée des métriques récentes
  --vitals <file>               Export produit par aso:google-play:vitals
  --baseline <file>             Snapshot précédent à comparer
  --file <file>                 Sortie locale. Défaut : ${path.relative(ROOT_DIR, DEFAULT_FILE)}
  --checked-at <ISO-8601>       Horodatage déterministe
  --package-name <id>           Défaut : ${PACKAGE_NAME}
`);
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) return printHelp();
    const snapshot = buildSnapshot(args);
    writeSnapshot(args.file, snapshot);
    console.log(`Snapshot Google Play écrit : ${path.relative(ROOT_DIR, args.file)}`);
    console.log(`Comparaison : ${snapshot.comparison.status}`);
  } catch (error) {
    console.error(`Erreur Google Play ASO : ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  PACKAGE_NAME,
  buildSnapshot,
  buildReportedPeriodComparison,
  compareSnapshots,
  decodeReportBuffer,
  inclusiveDayCount,
  metricRecords,
  normalizeStorePerformanceCsv,
  parseArgs,
  parseCsv,
  readBinarySource,
  validateConsoleObservation,
  writeSnapshot,
};
