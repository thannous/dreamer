'use strict';

const fs = require('node:fs');

const DEFAULT_CURRENT_PATH = 'artifacts/jest-results.json';
const DEFAULT_BASELINE_PATH = 'artifacts/baseline/jest-results.json';
const DEFAULT_THRESHOLD = 0.2;

function parseArgs(argv = []) {
  const options = {
    allowMissingBaseline: false,
    baselinePath: DEFAULT_BASELINE_PATH,
    currentPath: DEFAULT_CURRENT_PATH,
    threshold: DEFAULT_THRESHOLD,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--allow-missing-baseline') {
      options.allowMissingBaseline = true;
      continue;
    }

    if (argument === '--current' || argument === '--baseline' || argument === '--threshold') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${argument}`);
      }
      index += 1;

      if (argument === '--current') options.currentPath = value;
      if (argument === '--baseline') options.baselinePath = value;
      if (argument === '--threshold') options.threshold = Number(value);
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!Number.isFinite(options.threshold) || options.threshold < 0) {
    throw new Error('--threshold must be a non-negative number');
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
  logger = console,
  threshold = DEFAULT_THRESHOLD,
} = {}) {
  const currentMs = getJestDurationMs(readJson(currentPath, fsImpl));

  if (!fsImpl.existsSync(baselinePath)) {
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

  const baselineMs = getJestDurationMs(readJson(baselinePath, fsImpl));
  const comparison = compareDurations(currentMs, baselineMs, threshold);
  const summary = `Jest duration: ${formatComparison(comparison)}`;

  if (comparison.passed) {
    logger.log(summary);
  } else if (env.GITHUB_ACTIONS === 'true') {
    logger.error(`::error title=Jest duration regression::${escapeWorkflowCommand(summary)}`);
  } else {
    logger.error(summary);
  }

  return { ...comparison, skipped: false };
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = checkJestDurationRegression(options);
    process.exitCode = result.passed ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_BASELINE_PATH,
  DEFAULT_CURRENT_PATH,
  DEFAULT_THRESHOLD,
  checkJestDurationRegression,
  compareDurations,
  escapeWorkflowCommand,
  formatComparison,
  getJestDurationMs,
  parseArgs,
};
