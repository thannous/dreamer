'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_CURRENT_PATH = 'artifacts/jest-results.json';
const DEFAULT_BASELINE_PATH = 'artifacts/baseline/jest-results.json';
const DEFAULT_HISTORY_PATH = 'artifacts/baseline/jest-timing-history.json';
const DEFAULT_HISTORY_LIMIT = 5;
const DEFAULT_THRESHOLD = 0.2;

function parseArgs(argv = []) {
  const options = {
    allowMissingBaseline: false,
    baselinePath: DEFAULT_BASELINE_PATH,
    currentPath: DEFAULT_CURRENT_PATH,
    historyLimit: DEFAULT_HISTORY_LIMIT,
    historyPath: DEFAULT_HISTORY_PATH,
    threshold: DEFAULT_THRESHOLD,
    updateHistory: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--allow-missing-baseline') {
      options.allowMissingBaseline = true;
      continue;
    }

    if (argument === '--update-history') {
      options.updateHistory = true;
      continue;
    }

    if (
      argument === '--current' ||
      argument === '--baseline' ||
      argument === '--history' ||
      argument === '--history-limit' ||
      argument === '--threshold'
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${argument}`);
      }
      index += 1;

      if (argument === '--current') options.currentPath = value;
      if (argument === '--baseline') options.baselinePath = value;
      if (argument === '--history') options.historyPath = value;
      if (argument === '--history-limit') options.historyLimit = Number(value);
      if (argument === '--threshold') options.threshold = Number(value);
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!Number.isFinite(options.threshold) || options.threshold < 0) {
    throw new Error('--threshold must be a non-negative number');
  }

  if (!Number.isInteger(options.historyLimit) || options.historyLimit < 1) {
    throw new Error('--history-limit must be a positive integer');
  }

  return options;
}

function getJestDurationMs(result) {
  if (Number.isFinite(result?.durationMs) && result.durationMs >= 0) {
    return result.durationMs;
  }

  const startTime = result?.startTime;
  const endTimes = Array.isArray(result?.testResults)
    ? result.testResults
      .map((testResult) => testResult?.endTime)
      .filter(Number.isFinite)
    : [];

  if (!Number.isFinite(startTime) || endTimes.length === 0) {
    throw new Error('Jest JSON does not contain usable startTime/testResults endTime values');
  }

  const durationMs = Math.max(...endTimes) - startTime;
  if (durationMs < 0) {
    throw new Error('Jest JSON contains an endTime earlier than startTime');
  }

  return durationMs;
}

function readHistoryEntries(historyPath, fsImpl = fs, logger = console) {
  if (!fsImpl.existsSync(historyPath)) {
    return [];
  }

  try {
    const history = readJson(historyPath, fsImpl);
    const entries = Array.isArray(history?.entries) ? history.entries : [];
    return entries.filter(
      (entry) => Number.isFinite(entry?.durationMs) && entry.durationMs > 0
    );
  } catch (error) {
    // A corrupt cached history must not turn the duration budget into a hard
    // failure; the legacy single-run baseline below still protects the budget.
    logger.warn(
      `Ignoring unreadable timing history at ${historyPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return [];
  }
}

function averageDurationMs(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.durationMs, 0);
  return total / entries.length;
}

// Baseline = mean of the recorded master history; a pre-history cache only
// holds the single legacy jest-results.json, which stays a valid one-run baseline.
function resolveBaseline({
  baselinePath = DEFAULT_BASELINE_PATH,
  fsImpl = fs,
  historyPath = DEFAULT_HISTORY_PATH,
  logger = console,
} = {}) {
  const entries = readHistoryEntries(historyPath, fsImpl, logger);
  if (entries.length > 0) {
    return { baselineMs: averageDurationMs(entries), runCount: entries.length };
  }

  if (fsImpl.existsSync(baselinePath)) {
    return { baselineMs: getJestDurationMs(readJson(baselinePath, fsImpl)), runCount: 1 };
  }

  return null;
}

function updateTimingHistory({
  baselinePath = DEFAULT_BASELINE_PATH,
  currentPath = DEFAULT_CURRENT_PATH,
  fsImpl = fs,
  historyLimit = DEFAULT_HISTORY_LIMIT,
  historyPath = DEFAULT_HISTORY_PATH,
  logger = console,
  now = () => new Date().toISOString(),
} = {}) {
  const currentMs = getJestDurationMs(readJson(currentPath, fsImpl));
  let entries = readHistoryEntries(historyPath, fsImpl, logger);

  if (entries.length === 0 && fsImpl.existsSync(baselinePath)) {
    // First run after the rollout: seed from the restored single-run baseline
    // so the average keeps the continuity of the previous mechanism.
    try {
      entries = [
        { durationMs: getJestDurationMs(readJson(baselinePath, fsImpl)), recordedAt: null },
      ];
    } catch {
      entries = [];
    }
  }

  entries = [...entries, { durationMs: currentMs, recordedAt: now() }].slice(-historyLimit);

  fsImpl.mkdirSync?.(path.dirname(historyPath), { recursive: true });
  fsImpl.writeFileSync(historyPath, `${JSON.stringify({ entries }, null, 2)}\n`);

  const baselineMs = averageDurationMs(entries);
  logger.log(
    `Recorded Jest duration ${formatDuration(currentMs)} into ${historyPath} ` +
      `(${entries.length}/${historyLimit} runs, mean=${formatDuration(baselineMs)}).`
  );

  return { baselineMs, currentMs, entries, passed: true };
}

function compareDurations(currentMs, baselineMs, threshold = DEFAULT_THRESHOLD) {
  if (!Number.isFinite(currentMs) || currentMs < 0) {
    throw new Error('Current duration must be a non-negative number');
  }
  if (!Number.isFinite(baselineMs) || baselineMs <= 0) {
    throw new Error('Baseline duration must be a positive number');
  }
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error('Threshold must be a non-negative number');
  }

  const deltaRatio = (currentMs - baselineMs) / baselineMs;
  const limitMs = baselineMs * (1 + threshold);

  return {
    baselineMs,
    currentMs,
    deltaRatio,
    limitMs,
    passed: currentMs <= limitMs,
    threshold,
  };
}

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatComparison(comparison) {
  const delta = `${comparison.deltaRatio >= 0 ? '+' : ''}${(
    comparison.deltaRatio * 100
  ).toFixed(1)}%`;
  return [
    `current=${formatDuration(comparison.currentMs)}`,
    `baseline=${formatDuration(comparison.baselineMs)}`,
    `delta=${delta}`,
    `limit=+${(comparison.threshold * 100).toFixed(0)}%`,
  ].join(', ');
}

function escapeWorkflowCommand(value) {
  return value
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

function readJson(filePath, fsImpl = fs) {
  return JSON.parse(fsImpl.readFileSync(filePath, 'utf8'));
}

function checkJestDurationRegression({
  allowMissingBaseline = false,
  baselinePath = DEFAULT_BASELINE_PATH,
  currentPath = DEFAULT_CURRENT_PATH,
  env = process.env,
  fsImpl = fs,
  historyPath = DEFAULT_HISTORY_PATH,
  logger = console,
  threshold = DEFAULT_THRESHOLD,
} = {}) {
  const currentMs = getJestDurationMs(readJson(currentPath, fsImpl));
  const baseline = resolveBaseline({ baselinePath, fsImpl, historyPath, logger });

  if (!baseline) {
    const message =
      `No master baseline was found at ${baselinePath}; current duration is ${formatDuration(currentMs)}.`;

    if (allowMissingBaseline) {
      logger.log(`${message} Baseline bootstrap is explicitly allowed.`);
      return { currentMs, passed: true, skipped: true };
    }

    if (env.GITHUB_ACTIONS === 'true') {
      logger.error(`::error title=Jest timing baseline::${escapeWorkflowCommand(message)}`);
    } else {
      logger.error(message);
    }
    return { currentMs, passed: false, skipped: true };
  }

  const comparison = compareDurations(currentMs, baseline.baselineMs, threshold);
  const baselineLabel =
    baseline.runCount > 1 ? ` (baseline averages ${baseline.runCount} master runs)` : '';
  const summary = `Jest duration: ${formatComparison(comparison)}${baselineLabel}`;

  if (comparison.passed) {
    logger.log(summary);
  } else if (env.GITHUB_ACTIONS === 'true') {
    logger.error(`::error title=Jest duration regression::${escapeWorkflowCommand(summary)}`);
  } else {
    logger.error(summary);
  }

  return { ...comparison, baselineRunCount: baseline.runCount, skipped: false };
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = options.updateHistory
      ? updateTimingHistory(options)
      : checkJestDurationRegression(options);
    process.exitCode = result.passed ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_BASELINE_PATH,
  DEFAULT_CURRENT_PATH,
  DEFAULT_HISTORY_LIMIT,
  DEFAULT_HISTORY_PATH,
  DEFAULT_THRESHOLD,
  checkJestDurationRegression,
  compareDurations,
  escapeWorkflowCommand,
  formatComparison,
  getJestDurationMs,
  parseArgs,
  resolveBaseline,
  updateTimingHistory,
};
