// e2e (0.23.1) starts the slowest files first from `<output>/timings.json`, a
// small history it smooths over recent runs, and each run here gets a new
// output directory. run.mjs keeps that file, and the report of the last run
// with no selection, in the clone's git directory, and seeds the timings into
// the next output directory. These helpers only move those files: the history
// orders files, it never decides whether a run passes. The kept report is what
// timings.mjs reads; nothing seeds it back, so an output directory only ever
// holds its own run's report.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** The timings history kept beside a campaign's kept report (`<campaign>.report.json`). */
export const timingsHistory = history => history.replace(/\.report\.json$/, '.timings.json');

// Without a history, or with an unreadable one, files start in collection
// order and nothing else changes. e2e ignores an invalid timings file.
export function seedDurations(history, output) {
  if (!history) return false;
  try {
    copyFileSync(timingsHistory(history), join(output, 'timings.json'), 1 /* COPYFILE_EXCL */);
    return true;
  } catch { return false; }
}

// Only a run that reached the app measured its files: a blocked one (the app
// never answered) fails every test in milliseconds and would start the slowest last.
export function measuredDurations(report) {
  try {
    const { run } = JSON.parse(report);
    return run.status !== 'blocked' && run.summary.passed > 0;
  } catch { return false; }
}

function replace(file, bytes, suffix) {
  writeFileSync(`${file}.${suffix}`, bytes);
  renameSync(`${file}.${suffix}`, file);
}

// A selected or budgeted run times only part of its files, so neither its
// report nor the timings e2e folded it into replace the history of a full run.
export function keepDurations(history, selected, output, suffix = process.pid) {
  const report = join(output, 'report.json');
  if (!history || selected || !existsSync(report)) return;
  const written = readFileSync(report);
  if (!measuredDurations(written)) return;
  try {
    mkdirSync(dirname(history), { recursive: true });
    replace(history, written, suffix);
    const timings = join(output, 'timings.json');
    if (existsSync(timings)) replace(timingsHistory(history), readFileSync(timings), suffix);
  } catch {}
}
